#!/usr/bin/env node

const readline = require('readline');
const { execSync } = require('child_process');
const fs = require('fs');
const memoryManager = require('./memory.js');
const { AGENT_TOOLS, executeTool } = require('./tools.js');

const OLLAMA_API = 'http://127.0.0.1:11434/api';
let chatHistory = [];
let numCtx = 4096;
let currentModel = "";

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
    output: process.stdout
});
const question = (query) => new Promise(resolve => rl.question(query, resolve));

// Gemini-like Spinner
const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerInterval;
function startSpinner(text) {
    let i = 0;
    process.stdout.write('\x1b[?25l'); // hide cursor
    spinnerInterval = setInterval(() => {
        process.stdout.write(`\r\x1b[36m${frames[i]}\x1b[0m \x1b[90m${text}\x1b[0m`);
        i = (i + 1) % frames.length;
    }, 80);
}

function stopSpinner() {
    clearInterval(spinnerInterval);
    process.stdout.write('\r\x1b[K\x1b[?25h'); // clear line, show cursor
}

// Simple Markdown Formatter
function formatMarkdown(text) {
    if (!text) return "";
    let formatted = text;
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '\x1b[1m$1\x1b[0m'); // bold
    formatted = formatted.replace(/\*(.*?)\*/g, '\x1b[3m$1\x1b[0m'); // italic
    formatted = formatted.replace(/```([\s\S]*?)```/g, '\n\x1b[36m$1\x1b[0m\n'); // code block (cyan)
    formatted = formatted.replace(/`(.*?)`/g, '\x1b[33m$1\x1b[0m'); // inline code (yellow)
    return formatted;
}

async function selectConfiguration() {
    console.clear();
    console.log('\x1b[1m\x1b[36m✧ XAGENT CLI \x1b[0m\x1b[90mv1.1.0\x1b[0m\n');
    
    let models = [];
    try {
        const res = await fetch(`${OLLAMA_API}/tags`);
        const data = await res.json();
        if (data.models && data.models.length > 0) {
            models = data.models.map(m => m.name);
        }
    } catch (e) {
        console.log('\x1b[31mError connecting to Ollama. Make sure it is running.\x1b[0m');
        process.exit(1);
    }

    if (models.length === 0) {
        console.log('\x1b[31mNo Ollama models found.\x1b[0m');
        process.exit(1);
    }

    console.log('\x1b[1mAvailable Models:\x1b[0m');
    models.forEach((m, i) => console.log(`  \x1b[36m${i + 1}.\x1b[0m ${m}`));
    
    let selected = -1;
    while (selected < 0 || selected >= models.length) {
        const ans = await question('\n\x1b[1mSelect a model (1-' + models.length + '):\x1b[0m ');
        selected = parseInt(ans.trim()) - 1;
    }
    currentModel = models[selected];

    const ctxAns = await question('\x1b[1mSet context length (num_ctx) [default: 4096]:\x1b[0m ');
    const parsedCtx = parseInt(ctxAns.trim());
    numCtx = isNaN(parsedCtx) ? 4096 : parsedCtx;

    console.log(`\n\x1b[32m✔ Configuration Saved:\x1b[0m Model: \x1b[1m${currentModel}\x1b[0m | Context: \x1b[1m${numCtx}\x1b[0m\n`);
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

const SYSTEM_PROMPT = "You are xagent, a powerful CLI autonomous agent (AMD Optimized). You have access to persistent vector memory and system tools. IMPORTANT: Use the `mem_store` tool to save ANY important facts. Do not wait to be asked. CRITICAL: NEVER re-save a fact that was mentioned in an older message. ONLY save facts if they were introduced in the VERY LAST user message. If asked about past facts or preferences you do not know, actively use the `memory_search` tool to retrieve them. Use tools to execute tasks. \n\nWEB SEARCH GUIDELINES:\nWhen you use the `web_search` tool, you must provide the findings to the user as clean, natural language. Explain the information from a first-person perspective (e.g., 'I found that...'). Avoid using bullet points, numbered lists, or cluttered responses. Instead, present the search results as a cohesive, conversational narrative.";

async function chat(promptText) {
    if (chatHistory.length === 0) {
        chatHistory.push({ role: 'system', content: SYSTEM_PROMPT });
    }

    let finalPrompt = promptText;
    
    // Memory search
    startSpinner('Searching Memory...');
    const [mems] = await Promise.all([
        memoryManager.queryVectors(promptText),
        pageOutModel(currentModel)
    ]);
    stopSpinner();
    
    if (mems && mems.length > 0) {
        finalPrompt += "\n\n[MEMORY]:\n" + mems.map(m => `- ${m.text}`).join('\n');
    }

    chatHistory.push({ role: 'user', content: finalPrompt });

    let finished = false;
    let loopCount = 0;
    const MAX_LOOPS = 5;

    while (!finished) {
        startSpinner('Thinking...');
        
        const body = {
            model: currentModel,
            messages: chatHistory,
            stream: false,
            options: { num_ctx: numCtx },
            tools: AGENT_TOOLS
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

            const res = await fetch(`${OLLAMA_API}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            stopSpinner();

            if (!res.ok) {
                console.log(`\n\x1b[31mError: Ollama returned ${res.status}\x1b[0m`);
                break;
            }

            const data = await res.json();
            const msg = data.message;
            
            if (msg.tool_calls && msg.tool_calls.length > 0) {
                loopCount++;
                if (loopCount >= MAX_LOOPS) {
                    console.log(`\x1b[33m\n[Agent Safety]: Maximum tool execution limit reached to prevent loops. Aborting tool sequence.\x1b[0m`);
                    finished = true;
                    break;
                }
                
                chatHistory.push(msg);
                for (const t of msg.tool_calls) {
                    console.log(`\x1b[35m⚡ Executing:\x1b[0m ${t.function.name}`);
                    const result = await executeTool(t.function.name, t.function.arguments);
                    chatHistory.push({ role: 'tool', content: String(result) });
                }
            } else {
                chatHistory.push(msg);
                console.log(`\n${formatMarkdown(msg.content)}\n`);
                finished = true;
            }
        } catch (e) {
            stopSpinner();
            console.log(`\n\x1b[31mError connecting to Ollama: ${e.message}\x1b[0m`);
            break;
        }
    }
}

function promptUser() {
    rl.question('\x1b[1m\x1b[36m>\x1b[0m ', async (line) => {
        const text = line.trim();
        if (text === 'exit' || text === 'quit') {
            console.log('\x1b[90mExiting xagent.\x1b[0m');
            process.exit(0);
        }
        if (text) {
            await chat(text);
        }
        promptUser();
    });
}

async function start() {
    await selectConfiguration();
    promptUser();
}

start();
