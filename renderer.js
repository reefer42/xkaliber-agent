// --- Polyfill for Non-Electron Environments (Mobile/Web) ---
const isWebMode = window.location.protocol.startsWith('http');

if (!window.api) {
    window.api = {
        invoke: async (channel, ...args) => {
            try {
                const response = await fetch('/api/invoke', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channel, args })
                });
                return await response.json();
            } catch (e) {
                return { error: e.message };
            }
        },
        on: () => {},
        send: () => {}
    };
}

if (!window.markedParse) {
    window.markedParse = (text) => {
        if (typeof marked !== 'undefined' && marked.parse) {
            return marked.parse(text);
        }
        return text; // Fallback to raw text if marked is not available
    };
}

if (isWebMode) {
    const originalFetch = window.fetch;
    window.fetch = async (input, init = {}) => {
        let urlStr = typeof input === 'string' ? input : input.url;
        // Proxy ALL absolute HTTP requests through the Node host proxy to bypass CORS
        if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
            // Mobile devices can't hit localhost directly, so we tell the host to route to 127.0.0.1
            if (urlStr.includes('localhost')) {
                urlStr = urlStr.replace('localhost', '127.0.0.1');
            }
            const targetUrl = urlStr;
            urlStr = '/api/proxy/';
            init.headers = { ...init.headers, 'x-target-url': targetUrl };
        }
        return originalFetch(urlStr, init);
    };
}

// DOM Elements
const modelSelect = document.getElementById('model-select');
const tempSlider = document.getElementById('temp-slider');
const tempVal = document.getElementById('temp-val');
const ctxSlider = document.getElementById('ctx-slider');
const ctxVal = document.getElementById('ctx-val');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const stopBtn = document.getElementById('stop-btn');
const attachBtn = document.getElementById('attach-btn');
const attachmentsBar = document.getElementById('attachments-bar');
const memoryToggle = document.getElementById('memory-toggle');
const sudoInput = document.getElementById('sudo-input');
const memoryIndicator = document.getElementById('memory-indicator');
const memoryCountBadge = document.getElementById('memory-count-badge');
const clearBtn = document.getElementById('clear-btn');
const ttsToggle = document.getElementById('tts-toggle');
const testAudioBtn = document.getElementById('test-audio-btn');
const netrunnerToggle = document.getElementById('netrunner-toggle');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');

// --- Uplink Mode & Server Config ---
const uplinkMode = document.getElementById('uplink-mode');
const lmsServerContainer = document.getElementById('lms-server-container');
const lmsServerInput = document.getElementById('lms-server-input');

const OLLAMA_API = 'http://127.0.0.1:11434/api';
let currentApiBase = OLLAMA_API;

if (uplinkMode) {
    uplinkMode.addEventListener('change', () => {
        lmsServerContainer.style.display = uplinkMode.checked ? 'block' : 'none';
        updateApiBase();
        fetchModels();
    });
}

if (lmsServerInput) {
    lmsServerInput.addEventListener('change', () => {
        if (uplinkMode.checked) {
            updateApiBase();
            fetchModels();
        }
    });
}

function updateApiBase() {
    if (uplinkMode.checked) {
        let server = lmsServerInput.value.trim();
        if (server.endsWith('/')) server = server.slice(0, -1);
        currentApiBase = server;
        // Notify host of URL change (for any host-side features)
        window.api.invoke('set-lms-url', [currentApiBase]);
    } else {
        currentApiBase = OLLAMA_API;
    }
}

let attachedFiles = [];
let abortController = null;
let chatHistory = [];

// --- WhatsApp wiring ---
const waLinkBtn = document.getElementById('wa-link-btn');
const qrModal = document.getElementById('qr-modal');
const qrImage = document.getElementById('qr-image');
const closeQr = document.getElementById('close-qr');

if (waLinkBtn) {
    waLinkBtn.addEventListener('click', async () => {
        waLinkBtn.disabled = true;
        waLinkBtn.textContent = 'CONNECTING...';
        const res = await window.api.invoke('whatsapp-init');
        if (res?.error) {
            addMessage('system', `**WhatsApp Error:** ${res.error}`);
            waLinkBtn.disabled = false;
            waLinkBtn.textContent = 'LINK WHATSAPP';
        }
    });
}

window.api.on('whatsapp-qr', (dataUrl) => {
    if (qrModal && qrImage) {
        qrImage.src = dataUrl;
        qrModal.style.display = 'flex';
    }
});

window.api.on('whatsapp-ready', () => {
    if (qrModal) qrModal.style.display = 'none';
    if (waLinkBtn) { waLinkBtn.textContent = 'WHATSAPP LINKED'; waLinkBtn.disabled = true; }
    addMessage('system', 'WhatsApp linked successfully.');
});

window.api.on('whatsapp-error', (msg) => {
    addMessage('system', `**WhatsApp Auth Error:** ${msg}`);
    if (waLinkBtn) { waLinkBtn.disabled = false; waLinkBtn.textContent = 'LINK WHATSAPP'; }
});

window.api.on('whatsapp-disconnected', () => {
    addMessage('system', 'WhatsApp disconnected.');
    if (waLinkBtn) { waLinkBtn.disabled = false; waLinkBtn.textContent = 'LINK WHATSAPP'; }
});

if (closeQr) {
    closeQr.addEventListener('click', () => { if (qrModal) qrModal.style.display = 'none'; });
}

// --- TTS controls ---
if (testAudioBtn) {
    testAudioBtn.addEventListener('click', () => {
        window.api.send('tts-speak', 'Xkaliber Agent audio uplink is operational.');
    });
}

window.api.on('tts-error', (msg) => addMessage('system', `**TTS Error:** ${msg}`));

// --- Attachment Handling ---
if (attachBtn) {
    attachBtn.addEventListener('click', async () => {
        const file = await window.api.invoke('open-file-dialog');
        if (file && !file.error) {
            attachedFiles.push(file);
            renderAttachments();
        } else if (file?.error) {
            addMessage('system', `**ATTACHMENT ERROR**: ${file.error}`);
        }
    });
}

function renderAttachments() {
    attachmentsBar.innerHTML = '';
    attachedFiles.forEach((file, index) => {
        const tag = document.createElement('div');
        tag.className = 'attachment-tag';
        tag.innerHTML = `${file.isImage ? '🖼️' : '📎'} ${file.fileName} <span class="remove-attach" data-index="${index}">×</span>`;
        attachmentsBar.appendChild(tag);
    });
    document.querySelectorAll('.remove-attach').forEach(btn => {
        btn.onclick = (e) => {
            attachedFiles.splice(parseInt(e.target.dataset.index), 1);
            renderAttachments();
        };
    });
}

// --- Param Displays ---
[tempSlider, ctxSlider].forEach(s => s && s.addEventListener('input', () => {
    if (tempVal) tempVal.textContent = parseFloat(tempSlider.value).toFixed(1);
    if (ctxVal) ctxVal.textContent = ctxSlider.value;
}));

// --- Agent Tool Definitions ---
const AGENT_TOOLS = [
    {
        type: "function",
        function: {
            name: "run_shell_command",
            description: "Execute a bash shell command. USE THIS to check system state, running processes (e.g., 'ps aux', 'top'), network, or execute scripts. If sudo is needed, it will be automatically handled.",
            parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] }
        }
    },
    {
        type: "function",
        function: {
            name: "read_file",
            description: "Read a file from the host system.",
            parameters: { type: "object", properties: { filepath: { type: "string" } }, required: ["filepath"] }
        }
    },
    {
        type: "function",
        function: {
            name: "write_file",
            description: "Write content to a file.",
            parameters: { type: "object", properties: { filepath: { type: "string" }, content: { type: "string" } }, required: ["filepath", "content"] }
        }
    },
    {
        type: "function",
        function: {
            name: "list_directory",
            description: "List contents (files and folders) of a directory on the file system. DO NOT use this to find running applications; use run_shell_command with 'ps' instead.",
            parameters: { type: "object", properties: { dirpath: { type: "string" } }, required: ["dirpath"] }
        }
    },
    {
        type: "function",
        function: {
            name: "delete_file",
            description: "Delete a file or directory from the host system.",
            parameters: { type: "object", properties: { filepath: { type: "string" } }, required: ["filepath"] }
        }
    },
    {
        type: "function",
        function: {
            name: "save_new_user_fact_only",
            description: "Appends a single fact to memory. CRITICAL: ONLY evaluate the VERY LAST user message. NEVER save information from older messages in the chat history. If the last message is just a question, DO NOT use this tool.",
            parameters: { type: "object", properties: { exact_new_fact: { type: "string", description: "The distinct fact extracted ONLY from the latest message." } }, required: ["exact_new_fact"] }
        }
    },
    {
        type: "function",
        function: {
            name: "memory_search",
            description: "Search long-term vector memory to recall past learned knowledge, user preferences, or facts. USE THIS TOOL actively if you are asked a question about the user or past context that you do not know the answer to. Formulate a targeted search query.",
            parameters: { type: "object", properties: { query: { type: "string", description: "The specific topic or keywords to search for in memory." } }, required: ["query"] }
        }
    },
    {
        type: "function",
        function: {
            name: "dynamic_schema_generate",
            description: "Generate a dynamic JSON schema for a task.",
            parameters: { type: "object", properties: { task: { type: "string" }, fields: { type: "array", items: { type: "string" } } }, required: ["task", "fields"] }
        }
    },
    {
        type: "function",
        function: {
            name: "web_search",
            description: "Search the web.",
            parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
        }
    },
    {
        type: "function",
        function: {
            name: "send_whatsapp_message",
            description: "Send a WhatsApp message.",
            parameters: { type: "object", properties: { number: { type: "string" }, message: { type: "string" } }, required: ["number", "message"] }
        }
    }
];

// --- Memory helpers ---
async function pageOutModel(modelName) {
    if (!modelName || uplinkMode.checked) return;
    console.log(`[PAGING] Paging out model: ${modelName} to free VRAM.`);
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        await fetch(`${OLLAMA_API}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelName, messages: [], keep_alive: 0 }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
    } catch(e) { console.warn(`[PAGING] Failed to page out ${modelName}`, e.message); }
}

async function updateMemoryCount() {
    if (memoryCountBadge) {
        try {
            const countRes = await window.api.invoke('mem-count');
            // Backend returns raw number on desktop, but might be wrapped or error in proxy
            let finalCount = 0;
            if (typeof countRes === 'number') finalCount = countRes;
            else if (countRes && typeof countRes.count === 'number') finalCount = countRes.count;
            else if (countRes && !countRes.error) finalCount = parseInt(countRes) || 0;
            
            memoryCountBadge.textContent = `[${finalCount} MEMS]`;
        } catch (e) {
            console.warn('Failed to update memory count:', e);
        }
    }
}

async function saveToMemory(text) {
    if (!memoryToggle.checked || !text) return { error: "Memory disabled" };
    memoryIndicator.style.display = 'block';
    const res = await window.api.invoke('mem-store', { text });
    setTimeout(() => { memoryIndicator.style.display = 'none'; }, 2000);
    return res;
}

async function searchMemory(query) {
    const res = await window.api.invoke('mem-query', { query, limit: 5 });
    if (res?.success) return res.data.filter(r => r.similarity > 0.15);
    return [];
}

// --- Clear / Export / Import ---
if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
        await window.api.invoke('clear-history');
        await window.api.invoke('mem-clear');
        chatHistory = [];
        messagesContainer.innerHTML = '<div class="message bot-message"><strong>SYSTEM:</strong> Neural memory wiped.</div>';
        updateMemoryCount();
    });
}

if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
        if (chatHistory.length === 0) { addMessage('system', 'Nothing to export.'); return; }
        const result = await window.api.invoke('export-session', chatHistory);
        if (result?.success) addMessage('system', `Session exported to **${result.filePath}**`);
    });
}

if (importBtn) {
    importBtn.addEventListener('click', async () => {
        const data = await window.api.invoke('import-session');
        if (data?.error) { addMessage('system', `**Import Error:** ${data.error}`); return; }
        if (data && Array.isArray(data)) {
            chatHistory = data;
            messagesContainer.innerHTML = '';
            renderHistory();
            await window.api.invoke('save-history', chatHistory);
            addMessage('system', 'Session imported successfully.');
        }
    });
}

// --- Init & Connection ---
async function init() {
    try {
        const urlDispContainer = document.getElementById('host-url-container');
        const urlDisp = document.getElementById('host-url-display');
        if (isWebMode) {
            if (urlDispContainer) urlDispContainer.style.display = 'none';
        } else {
            const hostInfo = await window.api.invoke('get-host-url');
            if (hostInfo && hostInfo.url && urlDisp) urlDisp.textContent = hostInfo.url;
        }
    } catch(e) {}

    try {
        await fetchModels();
        checkConnection();
        chatHistory = await window.api.invoke('load-history');
        
        if (chatHistory && chatHistory.error) {
            console.error("Backend error loading history:", chatHistory.error);
            chatHistory = [];
        } else if (!Array.isArray(chatHistory)) {
            chatHistory = [];
        }

        let envContext = "";
        try {
            const envInfo = await window.api.invoke('get-env-info');
            if (envInfo && !envInfo.error) {
                envContext = `\n\n[SYSTEM ENVIRONMENT]:\nOS: ${envInfo.platform} (${envInfo.arch})\nUser: ${envInfo.username}\nHome Dir: ${envInfo.homedir}\nCurrent Dir: ${envInfo.cwd}\n`;
            }
        } catch (e) {}

        const baseSystemPrompt = `You are Xkaliber Agent v29 (AMD Optimized). You now have LM Studio support alongside Ollama. You have access to dynamic schemas, robust vector memory, and system tools. Sudo is handled implicitly if a password is provided by the user. 

GUARD RAILS:
1. STRICT ACTION LIMITS: NEVER use 'write_file', 'delete_file', or 'run_shell_command' to modify the system or create files UNLESS the user explicitly requested that exact action.
2. NO UNPROMPTED SETUP: Do not create configuration files, scripts, or examples unprompted. If asked to "look", "read", or "list", ONLY use read-only tools and DO NOT follow up with write actions.
3. If you are unsure about intent or lack context, DO NOT guess or hallucinate a tool call. Instead, ask the user for clarification.
4. You MUST use tools to interact with the world, but only when you are certain of the intent.

IMPORTANT: Use the \`save_new_user_fact_only\` tool to explicitly save important facts, preferences, or details about the user or project into your persistent memory. CRITICAL: NEVER re-save a fact that was mentioned in an older message. ONLY save facts if they were introduced in the VERY LAST user message. If asked about past facts or preferences you do not know, actively use the \`memory_search\` tool to retrieve them.${envContext}`;

        if (!chatHistory || chatHistory.length === 0) {
            chatHistory = [{ role: "system", content: baseSystemPrompt }];
        } else if (chatHistory.length > 0 && chatHistory[0].role === 'system') {
            chatHistory[0].content = baseSystemPrompt;
        }

        if (chatHistory.length > 0) {
            messagesContainer.innerHTML = '';
            renderHistory();
        }
        updateMemoryCount();

    } catch (err) {
        setStatus(false, 'OFFLINE');
    }
}

async function fetchModels() {
    try {
        if (uplinkMode.checked) {
            // LM Studio / OpenAI Format
            const res = await fetch(`${currentApiBase}/v1/models`, {
                headers: { 'Authorization': 'Bearer lm-studio' }
            });
            if (!res.ok) throw new Error('LMS Offline or Incorrect URL');
            const data = await res.json();
            const models = data.data || data; 
            if (Array.isArray(models)) {
                modelSelect.innerHTML = models.map(m => `<option value="${m.id || m}">${m.id || m}</option>`).join('');
            } else {
                throw new Error('Unexpected models format');
            }
        } else {
            // Ollama Format
            const res = await fetch(`${currentApiBase}/tags`);
            if (!res.ok) throw new Error('Ollama Offline');
            const data = await res.json();
            modelSelect.innerHTML = data.models.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
        }
    } catch (err) {
        console.error('Fetch Models Error:', err);
        modelSelect.innerHTML = '<option value="" disabled selected>Error Loading Models</option>';
    }
}

function setStatus(online, text) {
    statusText.textContent = text;
    statusDot.className = `dot ${online ? 'connected' : ''}`;
    if (!isSending) {
        userInput.disabled = !online;
        sendBtn.disabled = !online;
    }
}

function checkConnection() {
    const endpoint = uplinkMode.checked ? `${currentApiBase}/v1/models` : `${currentApiBase}/tags`;
    fetch(endpoint)
        .then(r => setStatus(r.ok, r.ok ? 'ONLINE' : 'OFFLINE'))
        .catch(() => setStatus(false, 'OFFLINE'));
    
    // Periodically sync memory count
    updateMemoryCount();
}
setInterval(checkConnection, 5000);

function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role === 'user' ? 'user-message' : role === 'system' ? 'system-message' : 'bot-message'}`;
    div.innerHTML = role === 'user' ? text : window.markedParse(text);
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return div;
}

function renderHistory() {
    chatHistory.forEach(m => {
        if (m.role === 'user') addMessage('user', m.content);
        else if (m.role === 'assistant' && m.content) addMessage('bot', m.content);
        else if (m.role === 'assistant' && m.tool_calls) {
            m.tool_calls.forEach(t => {
                const l = document.createElement('div');
                l.className = 'agent-log';
                l.textContent = `⚡ Exec: ${t.function.name}\nArgs: ${JSON.stringify(t.function.arguments, null, 2)}`;
                messagesContainer.appendChild(l);
            });
        }
    });
}

// --- Tool executor (agent mode) ---
async function executeTool(name, args) {
    if (name === 'run_shell_command') {
        let cmd = args.command;
        const sudoPass = sudoInput.value;
        if (cmd.includes('sudo') && sudoPass) {
            cmd = cmd.replace(/sudo\s+/g, `echo "${sudoPass}" | sudo -S `);
        }
        const res = await window.api.invoke('agent-run-command', cmd);
        let out = "";
        if (res.error) out += `Error: ${res.error}\n`;
        if (res.stderr) out += `Stderr: ${res.stderr}\n`;
        if (res.stdout) out += `Stdout:\n${res.stdout}`;
        return out || "Success";
    }
    if (name === 'read_file') return (await window.api.invoke('agent-read-file', args.filepath)).content || "Error reading";
    if (name === 'write_file') return (await window.api.invoke('agent-write-file', args.filepath, args.content)).success ? "Success" : "Error";
    if (name === 'list_directory') return (await window.api.invoke('agent-list-directory', args.dirpath)).files || "Error";
    if (name === 'delete_file') return (await window.api.invoke('agent-delete-file', args.filepath)).success ? "Success" : "Error";
    if (name === 'mem_store' || name === 'save_new_user_fact_only') {
        const factToStore = args.exact_new_fact || args.new_fact || args.text;
        const res = await saveToMemory(factToStore);
        if (res?.success) {
            updateMemoryCount();
            return "Memory stored successfully.";
        }
        return `Error: ${res?.error || "Failed to store memory"}`;
    }
    if (name === 'memory_search') {
        const mems = await searchMemory(args.query);
        return mems.length > 0 ? mems.map(m => m.text).join('\n') : "No memory found";
    }
    if (name === 'dynamic_schema_generate') {
        return JSON.stringify({ task: args.task, schema: { type: "object", properties: args.fields.reduce((a, f) => ({ ...a, [f]: { type: "string" } }), {}) } });
    }
    if (name === 'web_search') return JSON.stringify(await window.api.invoke('perform-search', args.query));
    if (name === 'send_whatsapp_message') return (await window.api.invoke('whatsapp-send', { number: args.number, message: args.message })).success ? "Success" : "Error";
    return `Unknown tool: ${name}`;
}

function stripMarkdown(text) {
    return text.replace(/[#*`_~\[\]()>]/g, '');
}

// --- Main send logic (unified streaming) ---
let isSending = false;

stopBtn.addEventListener('click', () => {
    if (abortController) {
        abortController.abort();
        addMessage('system', 'Neural link terminated.');
    }
});

async function sendMessage() {
    if (isSending) return;
    
    const text = userInput.value.trim();
    if (!text) return;
    
    const model = modelSelect.value;
    if (!model || model === "Scanning...") {
        addMessage('system', '**System Error:** No model selected. Please wait for model list or check connection.');
        return;
    }

    isSending = true;
    userInput.value = '';
    userInput.disabled = true;
    sendBtn.disabled = true;
    
    // Mobile reliable clear: force blur and small delay
    userInput.blur();
    setTimeout(() => { userInput.value = ''; }, 10);
    
    abortController = new AbortController();
    sendBtn.style.display = 'none';
    stopBtn.style.display = 'block';

    let finalPrompt = text;
    let images = [];

    if (attachedFiles.length > 0) {
        finalPrompt += "\n\n[ATTACHMENTS]:\n" + attachedFiles.map(f => {
            if (f.isImage) { images.push(f.base64); return `[IMAGE: ${f.fileName}]`; }
            return `--- ${f.fileName} ---\n${f.content}`;
        }).join('\n');
        attachedFiles = [];
        renderAttachments();
    }

    let transientMemoryContext = "";
    if (memoryToggle.checked) {
        try {
            // SPEED OPTIMIZATION: Run page-out and search in parallel
            const [mem] = await Promise.all([
                searchMemory(text),
                pageOutModel(model)
            ]);
            if (mem && mem.length > 0) {
                transientMemoryContext = "\n\n[READ-ONLY BACKGROUND DATABASE]\n" + mem.map(m => `- ${m.text}`).join('\n') + "\n(END OF READ-ONLY DATABASE. DO NOT re-save any of the above facts into memory. You MUST ONLY save completely new facts from the user's latest input.)";
            }
        } catch (err) {
            console.warn('Memory search failed/timed out:', err);
            addMessage('system', '**Neural-Core Warning:** Memory search failed.');
        }
    }

    const agentEnabled = document.getElementById('agent-toggle')?.checked;

    if (netrunnerToggle?.checked && !agentEnabled) {
        try {
            const searchResults = await window.api.invoke('perform-search', text);
            if (searchResults && !searchResults.error && searchResults.length > 0) {
                const webCtx = searchResults.map(r => `- ${r.title}: ${r.snippet} (${r.url})`).join('\n');
                finalPrompt += "\n\n[WEB SEARCH RESULTS]:\n" + webCtx;
                const searchLog = document.createElement('div');
                searchLog.className = 'search-results-log';
                searchLog.innerHTML = `<strong>NETRUNNER:</strong> Found ${searchResults.length} results<ul>${searchResults.map(r => `<li><a href="${r.url}" target="_blank">${r.title}</a></li>`).join('')}</ul>`;
                messagesContainer.appendChild(searchLog);
            }
        } catch (e) { console.error('Netrunner search failed:', e); }
    }

    addMessage('user', text);
    chatHistory.push({ role: 'user', content: finalPrompt, ...(images.length > 0 ? { images } : {}) });

    const botDiv = addMessage('bot', '<span class="loading-pulse">Thinking...</span>');

    try {
        // SPEED OPTIMIZATION: Check if system prompt exists, otherwise create it with stronger memory directives
        if (!chatHistory || chatHistory.length === 0 || chatHistory[0].role !== 'system') {
            let envContext = "";
            try {
                const envInfo = await window.api.invoke('get-env-info');
                if (envInfo && !envInfo.error) {
                    envContext = `\n\n[SYSTEM ENVIRONMENT]:\nOS: ${envInfo.platform} (${envInfo.arch})\nUser: ${envInfo.username}\nHome Dir: ${envInfo.homedir}\nCurrent Dir: ${envInfo.cwd}\n`;
                }
            } catch (e) {}
            
            const systemPrompt = `You are Xkaliber Agent v29 (AMD Optimized). You now have LM Studio support alongside Ollama. You have access to persistent vector memory and system tools. 

GUARD RAILS:
1. STRICT ACTION LIMITS: NEVER use 'write_file', 'delete_file', or 'run_shell_command' to modify the system or create files UNLESS the user explicitly requested that exact action.
2. NO UNPROMPTED SETUP: Do not create configuration files, scripts, or examples unprompted. If asked to "look", "read", or "list", ONLY use read-only tools and DO NOT follow up with write actions.
3. If you are unsure about intent or lack context, DO NOT guess or hallucinate a tool call. Instead, ask the user for clarification.
4. You MUST use tools to interact with the world, but only when you are certain of the intent.

IMPORTANT: Use the \`save_new_user_fact_only\` tool to explicitly save important facts, preferences, or details about the user or project into your persistent memory. CRITICAL: NEVER re-save a fact that was mentioned in an older message. ONLY save facts if they were introduced in the VERY LAST user message. If asked about past facts or preferences you do not know, actively use the \`memory_search\` tool to retrieve them.${envContext}`;
            if (!chatHistory) chatHistory = [];
            chatHistory.unshift({ role: "system", content: systemPrompt });
        }

        console.log(`Connecting to Uplink at ${currentApiBase}...`);
        let finished = false;
        let turnCount = 0;
        while (!finished && turnCount < 10) {
            turnCount++;
            let body, endpoint;
            
            let activeTools = [];
            if (agentEnabled) {
                activeTools = AGENT_TOOLS;
            } else if (memoryToggle?.checked) {
                activeTools = AGENT_TOOLS.filter(t => t.function.name === 'save_new_user_fact_only' || t.function.name === 'memory_search');
            }

            if (uplinkMode.checked) {
                // LM Studio / OpenAI Format
                endpoint = `${currentApiBase}/v1/chat/completions`;
                
                const messages = [];
                const pendingToolCalls = []; 

                for (let i = 0; i < chatHistory.length; i++) {
                    const m = chatHistory[i];
                    if (!m.role) continue;

                    let msg = { role: m.role };

                    if (m.role === 'system') {
                        msg.content = String(m.content || "You are a helpful assistant.");
                        if (transientMemoryContext) {
                            msg.content += transientMemoryContext;
                        }
                    } 
                    else if (m.role === 'user') {
                        msg.content = String(m.content || "");

                        if (m.images && m.images.length > 0) {
                            msg.content = [
                                { type: "text", text: msg.content },
                                ...m.images.map(img => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${img}` } }))
                            ];
                        }
                    } 
                    else if (m.role === 'assistant') {
                        // Ensure content is at least an empty string if tool_calls exist, some models fail on null
                        msg.content = (m.content && m.content.trim()) ? String(m.content) : "";
                        
                        if (m.tool_calls && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
                            msg.tool_calls = m.tool_calls.map(tc => {
                                // Preserve ID if it exists in history, otherwise generate once
                                if (!tc.id) tc.id = `call_${Math.random().toString(36).substring(2, 10)}`;
                                return {
                                    id: tc.id,
                                    type: 'function',
                                    function: {
                                        name: tc.function?.name || 'unknown_function',
                                        arguments: typeof tc.function?.arguments === 'string' 
                                            ? tc.function.arguments 
                                            : JSON.stringify(tc.function?.arguments || {})
                                    }
                                };
                            });
                        } else if (!msg.content) {
                            // Assistant message must have content or tool_calls
                            continue; 
                        }
                    } 
                    else if (m.role === 'tool' || m.role === 'function') {
                        msg.role = 'tool';
                        msg.content = String(m.content || "Success");
                        msg.tool_call_id = m.tool_call_id || `call_${Math.random().toString(36).substring(2, 10)}`;
                    }

                    messages.push(msg);
                }

                if (messages.length === 0) {
                    messages.push({ role: 'user', content: finalPrompt });
                }

                body = {
                    model,
                    messages,
                    stream: true,
                    temperature: (tempSlider && !isNaN(parseFloat(tempSlider.value))) ? parseFloat(tempSlider.value) : 0.7
                };
                
                // LM Studio strictly enforces tool payload schemas
                if (activeTools.length > 0) {
                    body.tools = activeTools.map(t => ({
                        type: "function",
                        function: {
                            name: t.function.name,
                            description: t.function.description || "",
                            parameters: t.function.parameters || { type: "object", properties: {} }
                        }
                    }));
                }
            } else {
                // Ollama Format
                endpoint = `${currentApiBase}/chat`;
                
                // Deep copy chatHistory to inject transient context
                const messagesForOllama = chatHistory.map(m => {
                    let msg = { role: m.role, content: m.content || "" };
                    if (m.images) msg.images = m.images;
                    if (m.role === 'assistant' && m.tool_calls) {
                        msg.tool_calls = m.tool_calls.map(tc => ({
                            function: {
                                name: tc.function.name,
                                arguments: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments
                            }
                        }));
                    }
                    return msg;
                });

                if (transientMemoryContext && messagesForOllama.length > 0) {
                    const systemIdx = messagesForOllama.findIndex(m => m.role === 'system');
                    if (systemIdx !== -1) {
                        messagesForOllama[systemIdx].content += transientMemoryContext;
                    }
                }

                body = {
                    model,
                    messages: messagesForOllama,
                    stream: true,
                    options: { temperature: parseFloat(tempSlider.value), num_ctx: parseInt(ctxSlider.value) }
                };
                if (activeTools.length > 0) body.tools = activeTools;
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer lm-studio'
                },
                body: JSON.stringify(body),
                signal: abortController.signal
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error("Payload that failed:", JSON.stringify(body, null, 2));
                throw new Error(`Uplink Error (${res.status}): ${errorText || res.statusText}`);
            }

            console.log("Neural link established. Receiving stream...");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';
            let toolCalls = null;
            botDiv.innerHTML = '';

            const readWithTimeout = (reader, timeoutMs) => {
                return new Promise((resolve, reject) => {
                    const timeoutId = setTimeout(() => reject(new Error('Stream timeout: Uplink is hung')), timeoutMs);
                    reader.read().then((result) => {
                        clearTimeout(timeoutId);
                        resolve(result);
                    }).catch(err => {
                        clearTimeout(timeoutId);
                        reject(err);
                    });
                });
            };

            let leftover = '';
            while (true) {
                const { done, value } = await readWithTimeout(reader, 120000);
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = (leftover + chunk).split('\n');
                leftover = lines.pop();

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    if (uplinkMode.checked) {
                        // OpenAI / LM Studio Format: "data: {...}"
                        if (trimmed === 'data: [DONE]') continue;
                        if (trimmed.startsWith('data:')) {
                            try {
                                const jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5);
                                const json = JSON.parse(jsonStr);
                                const delta = json.choices?.[0]?.delta;
                                if (delta?.content) {
                                    fullContent += delta.content;
                                    botDiv.innerHTML = window.markedParse(fullContent);
                                }
                                if (delta?.tool_calls) {
                                    if (!toolCalls) toolCalls = [];
                                    delta.tool_calls.forEach(tc => {
                                        const idx = tc.index;
                                        if (idx !== undefined) {
                                            if (!toolCalls[idx]) {
                                                toolCalls[idx] = tc;
                                                if (!toolCalls[idx].id) toolCalls[idx].id = `call_${Math.random().toString(36).substring(2, 10)}`;
                                                if (toolCalls[idx].function && !toolCalls[idx].function.arguments) {
                                                    toolCalls[idx].function.arguments = '';
                                                }
                                            } else {
                                                if (tc.function?.arguments) {
                                                    toolCalls[idx].function.arguments += tc.function.arguments;
                                                }
                                                if (tc.id) toolCalls[idx].id = tc.id;
                                                if (tc.function?.name) toolCalls[idx].function.name = tc.function.name;
                                            }
                                        }
                                    });
                                }
                            } catch (e) { console.warn('Failed to parse LMS chunk:', trimmed, e); }
                        }
                    } else {
                        // Ollama Format
                        try {
                            const json = JSON.parse(trimmed);
                            if (json.message?.content) {
                                fullContent += json.message.content;
                                botDiv.innerHTML = window.markedParse(fullContent);
                            }
                            if (json.message?.tool_calls?.length > 0) {
                                toolCalls = json.message.tool_calls.map(tc => {
                                    if (!tc.id) tc.id = `call_${Math.random().toString(36).substring(2, 10)}`;
                                    return tc;
                                });
                            }
                        } catch (e) { console.warn('Failed to parse Ollama chunk:', trimmed, e); }
                    }
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            if (toolCalls?.length > 0) {
                // For OpenAI format, tool_calls arguments might be strings that need parsing
                toolCalls = toolCalls.map(tc => {
                    if (typeof tc.function.arguments === 'string') {
                        try {
                            tc.function.arguments = JSON.parse(tc.function.arguments);
                        } catch (e) { console.warn('Failed to parse tool arguments:', tc.function.arguments); }
                    }
                    return tc;
                });

                // --- V29 GUARD RAILS: Validation ---
                let validToolCalls = [];
                let hallucinations = [];

                for (const tc of toolCalls) {
                    const toolName = tc.function?.name;
                    const toolExists = activeTools.some(t => t.function.name === toolName);
                    
                    if (!toolExists) {
                        console.warn(`Hallucination detected: Tool "${toolName}" does not exist.`);
                        hallucinations.push(`Unknown tool: ${toolName}`);
                        continue;
                    }

                    // Simple argument check - if it's supposed to be an object but isn't
                    if (!tc.function.arguments || typeof tc.function.arguments !== 'object') {
                         console.warn(`Hallucination detected: Tool "${toolName}" has invalid arguments.`);
                         hallucinations.push(`Invalid arguments for ${toolName}`);
                         continue;
                    }

                    validToolCalls.push(tc);
                }

                if (hallucinations.length > 0) {
                    console.log("Blocking suspected hallucination and asking for clarification...");
                    chatHistory.push({ role: 'assistant', content: fullContent || "I attempted to perform a task but got confused." });
                    chatHistory.push({ role: 'user', content: `[GUARD RAIL]: I noticed you tried to use tools that don't exist or provided invalid parameters: ${hallucinations.join(', ')}. If you are unsure of how to proceed, please ask me for clarification instead of guessing.` });
                    botDiv.innerHTML = window.markedParse(fullContent + "\n\n*(Neural-Core intercepted a suspected hallucination. Nudging model for clarification...)*");
                    continue; 
                }

                // Anti-looping guard
                const currentSig = JSON.stringify(validToolCalls.map(t => ({ name: t.function?.name, args: t.function?.arguments })));
                if (window._lastToolCallSignature === currentSig && turnCount > 1) {
                    console.warn("Tool loop detected! Model generated exact same tool call. Nudging.");
                    chatHistory.push({ role: 'user', content: "You just requested the exact same tool call again. Please use the results already provided above to answer the user's question directly." });
                    continue; 
                }
                window._lastToolCallSignature = currentSig;

                chatHistory.push({ role: 'assistant', content: fullContent, tool_calls: validToolCalls });

                const needsVRAMSwap = validToolCalls.some(t => t.function.name === 'mem_store' || t.function.name === 'memory_search' || t.function.name === 'save_new_user_fact_only');
                if (needsVRAMSwap) {
                    await pageOutModel(model); 
                }

                for (const t of validToolCalls) {
                    const logDiv = document.createElement('div');
                    logDiv.className = 'agent-log';
                    logDiv.textContent = `⚡ Exec: ${t.function.name}\nArgs: ${JSON.stringify(t.function.arguments, null, 2)}`;
                    messagesContainer.insertBefore(logDiv, botDiv);

                    let result;
                    try {
                        result = await executeTool(t.function.name, t.function.arguments);
                    } catch (e) {
                        result = `Error: ${e.message}`;
                    }
                    chatHistory.push({ role: 'tool', content: String(result), tool_call_id: t.id });
                }

                botDiv.innerHTML = '<span class="loading-pulse">Processing...</span>';
            } else {
                window._lastToolCallSignature = null; // Clear on success
                // BUG FIX: If model is silent after tool results, nudge it.
                if (turnCount > 1 && (!fullContent || fullContent.trim().length < 2)) {
                    console.log("Neural link active but model is silent after tool results. Nudging for final response...");
                    chatHistory.push({ role: 'user', content: "Please summarize the results above and provide the final answer." });
                    continue; 
                }

                chatHistory.push({ role: 'assistant', content: fullContent });
                window.api.invoke('save-history', chatHistory);
                if (ttsToggle?.checked && fullContent) {
                    window.api.send('tts-speak', stripMarkdown(fullContent));
                }
                finished = true;
            }
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            botDiv.innerHTML = `<span style="color:#ff4444">Error: Request aborted by user.</span>`;
            // Remove the user message we just added since it was cancelled
            if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
                chatHistory.pop();
            }
        } else if (e.message.includes('timeout')) {
            botDiv.innerHTML = `<span style="color:#ff4444">Error: Model timed out. VRAM may be heavily congested. Try clearing memory or restarting Ollama.</span>`;
        } else {
            botDiv.innerHTML = `<span style="color:#ff4444">Error: ${e.message}</span>`;
        }
    } finally {
        sendBtn.style.display = 'block';
        stopBtn.style.display = 'none';
        abortController = null;
        isSending = false;
        userInput.disabled = false;
        sendBtn.disabled = false;
        // Focus back to input on desktop
        if (!isWebMode) userInput.focus();
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
init();
