const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn, exec, execSync } = require('child_process');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

// NVIDIA Linux GPU compatibility — must run before app.whenReady()
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// AMD & Hardware Optimizations
function applyHardwareOptimizations() {
    try {
        // Detect CPU
        const cpuInfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
        const isAMD = cpuInfo.toLowerCase().includes('authenticamd');
        
        if (isAMD) {
            console.log('Hardware: AMD CPU Detected. Applying performance tweaks...');
            app.commandLine.appendSwitch('enable-accelerated-mjpeg-decode');
            app.commandLine.appendSwitch('enable-accelerated-video-decode');
            app.commandLine.appendSwitch('enable-gpu-rasterization');
            app.commandLine.appendSwitch('enable-zero-copy');
            
            // Optimize threading for TTS and other sub-processes
            const cores = require('os').cpus();
            const physicalCores = cores.length > 4 ? cores.length / 2 : cores.length;
            process.env.OMP_NUM_THREADS = Math.floor(physicalCores).toString();
        }

        // Detect GPU via lspci
        exec('lspci | grep -i "3d\\|display\\|vga"', (err, stdout) => {
            if (!err && stdout.toLowerCase().includes('amd')) {
                const gpuInfo = stdout.trim();
                console.log(`Hardware: AMD GPU Detected (${gpuInfo})`);
                
                // Newer AMD RDNA3/3.5 (Strix Point) often need GFX override for ROCm
                if (gpuInfo.includes('Strix') || gpuInfo.includes('880M') || gpuInfo.includes('890M')) {
                    console.log('Hardware: Applying HSA_OVERRIDE_GFX_VERSION=11.0.0 for Strix Point compatibility.');
                    process.env.HSA_OVERRIDE_GFX_VERSION = '11.0.0';
                }
            }
        });
    } catch (e) {
        console.warn('Hardware detection notice:', e.message);
    }
}
applyHardwareOptimizations();

// Optional: Force discrete GPU if available
app.commandLine.appendSwitch('force_high_performance_gpu');

if (process.env.XKALIBER_NO_GPU === '1') {
    app.disableHardwareAcceleration();
}

// Clear GPU Cache on startup to prevent NVIDIA corruption issues
const initUserDataPath = app.getPath('userData');
const gpuCachePath = path.join(initUserDataPath, 'GPUCache');
try {
    if (fs.existsSync(gpuCachePath)) {
        fs.rmSync(gpuCachePath, { recursive: true, force: true });
        console.log('Cleared GPUCache to prevent NVIDIA driver issues.');
    }
} catch (err) {
    console.error('Failed to clear GPUCache:', err);
}

// WhatsApp Client Setup
let whatsappClient = null;

// Wrap ipcMain.handle to save a copy for the web UI
const originalHandle = ipcMain.handle.bind(ipcMain);
const webHandlers = new Map();
ipcMain.handle = (channel, listener) => {
    webHandlers.set(channel, listener);
    return originalHandle(channel, listener);
};

// ... existing code ...

ipcMain.handle('whatsapp-init', async (event) => {
    if (whatsappClient) return { status: 'already_init' };

    whatsappClient = new Client({
        authStrategy: new LocalAuth({ dataPath: path.join(app.getPath('userData'), 'wa_auth') }),
        puppeteer: {
            handleSIGINT: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    whatsappClient.on('qr', async (qr) => {
        const qrImage = await qrcode.toDataURL(qr);
        if (mainWindow) mainWindow.webContents.send('whatsapp-qr', qrImage);
    });

    whatsappClient.on('ready', () => {
        if (mainWindow) mainWindow.webContents.send('whatsapp-ready');
        console.log('WhatsApp is ready!');
    });

    whatsappClient.on('authenticated', () => {
        console.log('WhatsApp Authenticated');
    });

    whatsappClient.on('auth_failure', (msg) => {
        if (mainWindow) mainWindow.webContents.send('whatsapp-error', msg);
    });

    whatsappClient.on('disconnected', () => {
        if (mainWindow) mainWindow.webContents.send('whatsapp-disconnected');
        whatsappClient = null;
    });

    try {
        await whatsappClient.initialize();
        return { success: true };
    } catch (err) {
        return { error: err.message };
    }
});

ipcMain.handle('whatsapp-send', async (event, { number, message }) => {
    if (!whatsappClient) return { error: 'WhatsApp not initialized' };
    try {
        const sanitizedNum = number.includes('@') ? number : `${number.replace(/\D/g, '')}@c.us`;
        await whatsappClient.sendMessage(sanitizedNum, message);
        return { success: true };
    } catch (err) {
        return { error: err.message };
    }
});

// File Attachment Handler
ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        title: 'Select File to Attach'
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        try {
            const stats = await fsPromises.stat(filePath);
            const fileName = path.basename(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const imageExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
            const isImage = imageExts.includes(ext);

            if (isImage) {
                if (stats.size > 50 * 1024 * 1024) {
                    return { error: 'Image file is too large (over 50MB limit).' };
                }
                const fileBuffer = await fsPromises.readFile(filePath);
                const base64 = fileBuffer.toString('base64');
                return { filePath, fileName, isImage: true, base64, size: stats.size };
            } else {
                let content;
                if (stats.size < 1024 * 1024) {
                    content = await fsPromises.readFile(filePath, 'utf-8');
                } else {
                    content = `[FILE TOO LARGE TO AUTO-READ: ${stats.size} bytes. Use read_file tool to access specific parts.]`;
                }
                return { filePath, fileName, isImage: false, content, size: stats.size };
            }
        } catch (err) {
            return { error: err.message };
        }
    }
    return null;
});

// Persistent Session Memory Paths
const userDataPath = app.getPath('userData');
const historyFile = path.join(userDataPath, 'xkaliber_agent_session_v29.json');
const legacyHistoryFile = path.join(userDataPath, 'xkaliber_agent_session_v26.json');

ipcMain.handle('load-history', async () => {
    try {
        if (fs.existsSync(historyFile)) {
            const data = await fsPromises.readFile(historyFile, 'utf-8');
            return JSON.parse(data);
        } else if (fs.existsSync(legacyHistoryFile)) {
            // Migrate from previous version (v26)
            const data = await fsPromises.readFile(legacyHistoryFile, 'utf-8');
            const history = JSON.parse(data);
            // Save it to the new path immediately to complete migration
            await fsPromises.writeFile(historyFile, JSON.stringify(history), 'utf-8');
            console.log('Migrated legacy v26 history to v29.');
            return history;
        }
    } catch (e) {
        console.error('Failed to load history', e);
    }
    return [];
});

ipcMain.handle('save-history', async (event, history) => {
    try {
        await fsPromises.writeFile(historyFile, JSON.stringify(history), 'utf-8');
        return true;
    } catch (e) {
        console.error('Failed to save history', e);
        return false;
    }
});

ipcMain.handle('clear-history', async () => {
    try {
        if (fs.existsSync(historyFile)) {
            await fsPromises.unlink(historyFile);
        }
        return true;
    } catch (e) {
        return false;
    }
});

// Session Export/Import
ipcMain.handle('export-session', async (event, data) => {
    const result = await dialog.showSaveDialog({
        title: 'Export Session',
        defaultPath: `xkaliber-session-${Date.now()}.json`,
        filters: [
            { name: 'JSON', extensions: ['json'] },
            { name: 'Markdown', extensions: ['md'] }
        ]
    });
    if (result.canceled || !result.filePath) return null;

    const ext = path.extname(result.filePath).toLowerCase();
    if (ext === '.md') {
        let md = `# Xkaliber Agent Session\n\nExported: ${new Date().toISOString()}\n\n---\n\n`;
        for (const msg of data) {
            if (msg.role === 'user') md += `## User\n\n${msg.content}\n\n`;
            else if (msg.role === 'assistant' && msg.content) md += `## Assistant\n\n${msg.content}\n\n`;
            else if (msg.role === 'system') md += `> **System:** ${msg.content}\n\n`;
        }
        await fsPromises.writeFile(result.filePath, md, 'utf-8');
    } else {
        await fsPromises.writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
    }
    return { success: true, filePath: result.filePath };
});

ipcMain.handle('import-session', async () => {
    const result = await dialog.showOpenDialog({
        title: 'Import Session',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    try {
        const data = await fsPromises.readFile(result.filePaths[0], 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return { error: e.message };
    }
});

// Agent Harness IPC Handlers
ipcMain.handle('agent-run-command', async (event, command) => {
    return new Promise((resolve) => {
        exec(command, { cwd: process.env.HOME || process.cwd() }, (error, stdout, stderr) => {
            resolve({ error: error ? error.message : null, stdout, stderr });
        });
    });
});

ipcMain.handle('agent-read-file', async (event, filepath) => {
    try {
        const content = await fsPromises.readFile(filepath, 'utf-8');
        return { content };
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('agent-write-file', async (event, filepath, content) => {
    try {
        await fsPromises.writeFile(filepath, content, 'utf-8');
        return { success: true };
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('agent-delete-file', async (event, filepath) => {
    try {
        const stats = await fsPromises.stat(filepath);
        if (stats.isDirectory()) {
            await fsPromises.rm(filepath, { recursive: true, force: true });
        } else {
            await fsPromises.unlink(filepath);
        }
        return { success: true };
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('agent-list-directory', async (event, dirpath) => {
    try {
        const files = await fsPromises.readdir(dirpath, { withFileTypes: true });
        const list = files.map(f => `${f.isDirectory() ? '[DIR] ' : '[FILE]'} ${f.name}`);
        return { files: list.join('\n') };
    } catch (error) {
        return { error: error.message };
    }
});

let mainWindow;

// Cross-platform Linux audio player detection
let cachedAudioPlayer = undefined;

function detectAudioPlayer() {
    if (cachedAudioPlayer !== undefined) return cachedAudioPlayer;

    const players = [
        { cmd: 'aplay',  args: ['-r', '22050', '-f', 'S16_LE', '-t', 'raw', '-'] },
        { cmd: 'paplay', args: ['--raw', '--rate=22050', '--channels=1', '--format=s16le'] },
        { cmd: 'ffplay', args: ['-nodisp', '-autoexit', '-f', 's16le', '-ar', '22050', '-ac', '1', '-'] }
    ];

    for (const p of players) {
        try {
            execSync(`which ${p.cmd}`, { stdio: 'ignore' });
            console.log(`TTS: Detected audio player: ${p.cmd}`);
            cachedAudioPlayer = p;
            return p;
        } catch (e) { /* not found, try next */ }
    }

    console.warn('TTS: No audio player found (tried aplay, paplay, ffplay)');
    cachedAudioPlayer = null;
    return null;
}

// Determine paths for Piper TTS and prevent AppImage EACCES by copying to userData
const getPiperPaths = () => {
    let sourceBasePath = path.join(process.resourcesPath, 'piper');
    if (!fs.existsSync(path.join(sourceBasePath, 'piper'))) {
        sourceBasePath = path.join(__dirname, 'resources', 'piper');
    }

    const userDataPiperPath = path.join(app.getPath('userData'), 'piper_env');
    
    // If not copied yet, copy it to bypass read-only AppImage restrictions
    if (!fs.existsSync(path.join(userDataPiperPath, 'piper'))) {
        console.log('TTS: Copying Piper binaries to writable directory to prevent EACCES...');
        try {
            fs.cpSync(sourceBasePath, userDataPiperPath, { recursive: true });
        } catch (err) {
            console.error('TTS Copy Error:', err);
        }
    }

    // Fix potentially broken absolute symlinks from AppImage mounts
    try {
        const libs = [
            { link: 'libespeak-ng.so.1', target: 'libespeak-ng.so.1.52.0.1' },
            { link: 'libonnxruntime.so.1', target: 'libonnxruntime.so.1.14.1' },
            { link: 'libpiper_phonemize.so.1', target: 'libpiper_phonemize.so.1.2.0' }
        ];
        for (const l of libs) {
            const linkPath = path.join(userDataPiperPath, l.link);
            try {
                let shouldCreate = false;
                if (fs.existsSync(linkPath)) {
                    const stats = fs.lstatSync(linkPath);
                    if (stats.isSymbolicLink()) {
                        const currentTarget = fs.readlinkSync(linkPath);
                        if (path.isAbsolute(currentTarget) || !fs.existsSync(linkPath)) {
                            fs.unlinkSync(linkPath);
                            shouldCreate = true;
                        }
                    }
                } else {
                    shouldCreate = true;
                }
                
                if (shouldCreate) {
                    fs.symlinkSync(l.target, linkPath);
                    console.log(`TTS: Fixed symlink ${l.link} -> ${l.target}`);
                }
            } catch (e) {
                console.error(`TTS: Failed to fix symlink ${l.link}:`, e.message);
            }
        }
    } catch (err) {
        console.error('TTS Symlink Fix Error:', err);
    }

    // Enforce execution permissions
    try {
        const executables = ['piper', 'piper_phonemize', 'espeak-ng'];
        for (const exe of executables) {
            const exePath = path.join(userDataPiperPath, exe);
            if (fs.existsSync(exePath)) fs.chmodSync(exePath, 0o755);
        }
    } catch (err) {
        console.error('TTS Chmod Error:', err);
    }

    return { 
        piperExec: path.join(userDataPiperPath, 'piper'), 
        modelFile: path.join(userDataPiperPath, 'en_US-lessac-medium.onnx'), 
        basePath: userDataPiperPath 
    };
};

let currentTTSProcess = null;
let audioPlayerProcess = null;

function killTTS() {
    if (currentTTSProcess) { currentTTSProcess.kill(); currentTTSProcess = null; }
    if (audioPlayerProcess) { audioPlayerProcess.kill(); audioPlayerProcess = null; }
}

function speakText(text) {
    if (!text) return;
    try {
        killTTS();

        const { piperExec, modelFile, basePath } = getPiperPaths();

        if (!fs.existsSync(piperExec)) {
            console.error(`TTS Error: Piper executable not found at ${piperExec}`);
            if (mainWindow) mainWindow.webContents.send('tts-error', `Piper not found at ${piperExec}`);
            return;
        }

        const audioPlayer = detectAudioPlayer();
        if (!audioPlayer) {
            if (mainWindow) mainWindow.webContents.send('tts-error', 'No audio player found. Install aplay, paplay, or ffplay.');
            return;
        }

        console.log(`TTS: Speaking "${text.substring(0, 40)}..." via ${audioPlayer.cmd}`);

        const piper = spawn(piperExec, ['--model', modelFile, '--output_raw'], { 
            cwd: basePath,
            env: { ...process.env, LD_LIBRARY_PATH: basePath }
        });
        const player = spawn(audioPlayer.cmd, audioPlayer.args);

        // Robust stream handling
        if (piper.stdout && player.stdin) {
            piper.stdout.pipe(player.stdin);
            
            piper.stdout.on('error', (e) => console.error('Piper stdout error:', e));
            player.stdin.on('error', (e) => {
                if (e.code === 'EPIPE') {
                    console.warn('TTS: Audio player stdin closed prematurely (EPIPE).');
                } else {
                    console.error('Player stdin error:', e);
                }
            });
        }

        piper.stderr.on('data', (data) => console.error(`Piper stderr: ${data}`));

        piper.on('error', (err) => {
            console.error('Piper process error:', err);
            if (mainWindow) mainWindow.webContents.send('tts-error', `Piper error: ${err.message}`);
        });

        player.on('error', (err) => {
            console.error('Audio player error:', err);
            if (mainWindow) mainWindow.webContents.send('tts-error', `Audio player error: ${err.message}`);
        });

        piper.on('close', (code) => {
            if (code !== 0 && code !== null) console.log(`Piper exited with code ${code}`);
            if (player.stdin && !player.stdin.destroyed) {
                try { player.stdin.end(); } catch (e) {}
            }
        });

        player.on('close', () => {
            if (mainWindow) mainWindow.webContents.send('tts-finished');
        });

        if (piper.stdin) {
            piper.stdin.on('error', (e) => {
                if (e.code === 'EPIPE') {
                    console.warn('TTS: Piper stdin closed prematurely (EPIPE).');
                } else {
                    console.error('Piper stdin error:', e);
                }
            });

            if (!piper.stdin.destroyed) {
                piper.stdin.write(text);
                piper.stdin.end();
            }
        }

        currentTTSProcess = piper;
        audioPlayerProcess = player;
    } catch (globalErr) {
        console.error('TTS Global Error:', globalErr);
        if (mainWindow) mainWindow.webContents.send('tts-error', `Critical TTS Error: ${globalErr.message}`);
    }
}

// Search Handler (Netrunner Mode)
ipcMain.handle('perform-search', async (event, query) => {
    try {
        console.log(`Searching for: ${query}`);
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://html.duckduckgo.com/'
            }
        });

        if (!response.ok) throw new Error(`Search failed: ${response.statusText}`);

        const html = await response.text();
        const results = [];
        const bodies = html.split('result__body');

        for (let i = 1; i < bodies.length; i++) {
            if (results.length >= 5) break;
            const block = bodies[i];

            const linkMatch = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
            const snippetMatch = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(block);

            if (linkMatch) {
                let url = linkMatch[1];
                let title = linkMatch[2];
                let snippet = snippetMatch ? snippetMatch[1] : '';

                if (url.startsWith('//duckduckgo.com/l/?uddg=')) {
                    try {
                        const urlObj = new URL('https:' + url);
                        const uddg = urlObj.searchParams.get('uddg');
                        if (uddg) url = decodeURIComponent(uddg);
                    } catch (e) { /* keep original */ }
                }

                const cleanText = (str) => str
                    .replace(/<[^>]+>/g, '')
                    .replace(/&quot;/g, '"')
                    .replace(/&#x27;/g, "'")
                    .replace(/&amp;/g, '&')
                    .trim();

                title = cleanText(title);
                snippet = cleanText(snippet);

                if (url && title) results.push({ url, title, snippet });
            }
        }

        return results;
    } catch (error) {
        console.error('Search error:', error);
        return { error: error.message };
    }
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        backgroundColor: '#0d1117',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        },
        autoHideMenuBar: true
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    ipcMain.on('tts-speak', (event, text) => speakText(text));
    ipcMain.on('tts-stop', () => killTTS());

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Vector Memory Integration (via memory.js)
const memoryManager = require('./memory.js');

ipcMain.handle('mem-store', async (event, { text, metadata }) => {
    return await memoryManager.storeVector(text, metadata);
});

ipcMain.handle('mem-query', async (event, { query, limit }) => {
    return await memoryManager.queryVectors(query, limit);
});

ipcMain.handle('mem-count', async () => {
    return { count: memoryManager.getCount() };
});

ipcMain.handle('mem-clear', async () => {
    return memoryManager.clearMemory();
});

// --- Web Hosting (Mobile Access) ---
const http = require('http');
const os = require('os');
const WEB_PORT = 3000;

// Host state for LM Studio proxying
let lmsHostUrl = 'http://127.0.0.1:1234';

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const webServer = http.createServer((req, res) => {
    // CORS Headers for Mobile Web Mode
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-target-url');
    if (req.method === 'OPTIONS') return res.end();

    const url = req.url.split('?')[0];

    // API Proxy for Ollama and LM Studio (Solves CORS and localhost binding issues)
    if (url.startsWith('/api/proxy/')) {
        const targetUrl = req.headers['x-target-url'];
        if (!targetUrl) {
            res.writeHead(400); return res.end('Missing x-target-url header');
        }
        try {
            const parsed = new URL(targetUrl);
            const transport = parsed.protocol === 'https:' ? require('https') : require('http');
            const options = {
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                path: parsed.pathname + parsed.search,
                method: req.method,
                headers: { ...req.headers, host: parsed.host }
            };
            
            delete options.headers['origin'];
            delete options.headers['referer'];
            delete options.headers['x-target-url'];
            delete options.headers['accept-encoding']; 
            
            const proxyReq = transport.request(options, (proxyRes) => {
                // Merge target headers with our required CORS headers
                const mergedHeaders = { ...proxyRes.headers };
                mergedHeaders['Access-Control-Allow-Origin'] = '*';
                // Remove some headers that might conflict with the browser's security model
                delete mergedHeaders['content-security-policy'];
                delete mergedHeaders['x-frame-options'];

                res.writeHead(proxyRes.statusCode, mergedHeaders);
                proxyRes.pipe(res);
            });
            
            proxyReq.on('error', e => {
                if (!res.headersSent) {
                    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                }
                res.end(JSON.stringify({ error: 'Proxy failed to connect: ' + e.message }));
            });
            
            req.pipe(proxyReq);
        } catch (e) {
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            }
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // IPC Proxy for Web Clients
    if (url === '/api/invoke' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { channel, args } = JSON.parse(body);
                
                // Special trap to let host know LMS server changed from web UI
                if (channel === 'set-lms-url') {
                    lmsHostUrl = args[0];
                    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    return res.end(JSON.stringify({ success: true }));
                }

                const handler = webHandlers.get(channel);
                if (handler) {
                    const val = await handler({ sender: { send: () => {} } }, ...args);
                    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify(val));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ error: 'No handler for ' + channel }));
                }
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // Static File Serving
    let filePath = path.join(__dirname, url === '/' ? 'index.html' : url);
    fs.promises.readFile(filePath)
        .then(content => {
            const ext = path.extname(filePath);
            const contentType = {
                '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                '.png': 'image/png', '.jpg': 'image/jpeg'
            }[ext] || 'text/plain';
            res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
            res.end(content);
        })
        .catch(e => {
            res.writeHead(404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
            res.end('Not Found');
        });
});

webServer.listen(WEB_PORT, '0.0.0.0', () => {
    console.log('\n=========================================');
    console.log(' Web Interface hosted at: http://' + getLocalIP() + ':' + WEB_PORT);
    console.log('=========================================\n');
});

ipcMain.handle('get-host-url', async () => {
    return { url: 'http://' + getLocalIP() + ':' + WEB_PORT };
});

ipcMain.handle('get-env-info', async () => {
    return {
        platform: os.platform(),
        arch: os.arch(),
        homedir: os.homedir(),
        username: os.userInfo().username,
        cwd: process.cwd()
    };
});
