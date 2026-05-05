#!/usr/bin/env node

const readline = require('readline');
const { execSync } = require('child_process');
const fs = require('fs');
const memoryManager = require('./memory.js');
const { AGENT_TOOLS, executeTool } = require('./tools.js');

const OLLAMA_API = 'http://127.0.0.1:11434/api';
let chatHistory = [];

// Hardware Optimization
function applyHardwareOptimizations() {
    try {
        const cpuInfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
        const isAMD = cpuInfo.toLowerCase().includes('authenticamd');
        if (isAMD) {
            const cores = require('os').cpus().length;
            process.env.OMP_NUM_THREADS = Math.floor(cores / 2).toString();
        }
        const gpuOut = execSync('lspci | grep -i "3d\\|display\\|vga"', { encoding: 'utf-8' });
        if (gpuOut.toLowerCase().includes('amd') && (gpuOut.includes('Strix') || gpuOut.includes('880M') || gpuOut.includes('890M'))) {
            process.env.HSA_OVERRIDE_GFX_VERSION = '11.0.0';
        }
    } catch (e) {}
}
applyHardwareOptimizations();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\x1b[36mxagent>\x1b[0m '
});

async function checkModel() {
    try {
        const res = await fetch(`${OLLAMA_API}/tags`);
        const data = await res.json();
        if (data.models && data.models.length > 0) {
            return data.models[0].name;
        }
        return null;
    } catch (e) {
        return null;
    }
}

async function pageOutModel(modelName) {
    if (!modelName) return;
    try {
        await fetch(`${OLLAMA_API}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelName, messages: [], keep_alive: 0 })
        });
    } catch(e) {}
}

const SYSTEM_PROMPT = "You are xagent, a powerful CLI autonomous agent (AMD Optimized). You have access to persistent vector memory and system tools. IMPORTANT: Use the `mem_store` tool to save ANY important facts. Do not wait to be asked. Use tools to execute tasks.";

async function chat(promptText, model) {
    if (chatHistory.length === 0) {
        chatHistory.push({ role: 'system', content: SYSTEM_PROMPT });
    }

    let finalPrompt = promptText;
    
    // Memory search
    process.stdout.write('\x1b[90m[Searching Memory...]\x1b[0m\r');
    const [mems] = await Promise.all([
        memoryManager.queryVectors(promptText),
        pageOutModel(model)
    ]);
    
    if (mems && mems.length > 0) {
        finalPrompt += "\n\n[MEMORY]:\n" + mems.map(m => `- ${m.text}`).join('\n');
    }

    chatHistory.push({ role: 'user', content: finalPrompt });

    let finished = false;
    while (!finished) {
        process.stdout.write('\x1b[90m[Thinking...]\x1b[0m\r');
        
        const body = {
            model: model,
            messages: chatHistory,
            stream: false,
            tools: AGENT_TOOLS
        };

        try {
            const res = await fetch(`${OLLAMA_API}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                console.log(`\n\x1b[31mError: Ollama returned ${res.status}\x1b[0m`);
                break;
            }

            const data = await res.json();
            const msg = data.message;
            
            if (msg.tool_calls && msg.tool_calls.length > 0) {
                chatHistory.push(msg);
                for (const t of msg.tool_calls) {
                    process.stdout.write(`\r\x1b[35m⚡ Executing: ${t.function.name}\x1b[0m\n`);
                    const result = await executeTool(t.function.name, t.function.arguments);
                    chatHistory.push({ role: 'tool', content: String(result) });
                }
            } else {
                chatHistory.push(msg);
                process.stdout.write('\r\x1b[K'); // clear line
                console.log(`\x1b[32mAgent:\x1b[0m ${msg.content}`);
                finished = true;
            }
        } catch (e) {
            console.log(`\n\x1b[31mError connecting to Ollama: ${e.message}\x1b[0m`);
            break;
        }
    }
}

async function start() {
    console.log('\x1b[36m=== xagent CLI initialized ===\x1b[0m');
    const model = await checkModel();
    if (!model) {
        console.log('\x1b[31mError: No Ollama models found or Ollama is not running.\x1b[0m');
        process.exit(1);
    }
    console.log(`\x1b[90mUsing model: ${model}\x1b[0m\n`);
    
    rl.prompt();
    rl.on('line', async (line) => {
        const text = line.trim();
        if (text === 'exit' || text === 'quit') process.exit(0);
        if (text) {
            await chat(text, model);
        }
        rl.prompt();
    }).on('close', () => {
        console.log('\nExiting xagent.');
        process.exit(0);
    });
}

start();
