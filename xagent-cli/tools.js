const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const memoryManager = require('./memory.js');

const AGENT_TOOLS = [
    {
        type: "function",
        function: {
            name: "run_shell_command",
            description: "Execute a bash shell command. USE THIS to check system state, running processes (e.g., 'ps aux', 'top'), network, or execute scripts. Sudo is not supported interactively.",
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
            name: "list_directory",
            description: "List contents (files and folders) of a directory on the file system. DO NOT use this to find running applications; use run_shell_command with 'ps' instead.",
            parameters: { type: "object", properties: { dirpath: { type: "string" } }, required: ["dirpath"] }
        }
    },
    {
        type: "function",
        function: {
            name: "mem_store",
            description: "Store a fact, detail, or important information about the user or project into your long-term persistent memory. CRITICAL: ONLY evaluate the VERY LAST user message. NEVER save information from older messages in the chat history.",
            parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] }
        }
    },
    {
        type: "function",
        function: {
            name: "web_search",
            description: "Search the web for real-time information, technical documentation, or news. Use this tool actively when the user asks questions that require up-to-date knowledge or deep research.",
            parameters: { type: "object", properties: { query: { type: "string", description: "The search query to look up on the web." } }, required: ["query"] }
        }
    },
    {
        type: "function",
        function: {
            name: "memory_search",
            description: "Search long-term vector memory to recall past learned knowledge, user preferences, or facts. USE THIS TOOL actively if you are asked a question about the user or past context that you do not know the answer to. Formulate a targeted search query.",
            parameters: { type: "object", properties: { query: { type: "string", description: "The specific topic or keywords to search for in memory." } }, required: ["query"] }
        }
    }
];

async function performWebSearch(query) {
    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (!response.ok) return "Search failed.";
        const html = await response.text();
        const results = [];
        const bodies = html.split('result__body');
        for (let i = 1; i < Math.min(bodies.length, 7); i++) {
            const block = bodies[i];
            const titleMatch = block.match(/result__a[^>]*>(.*?)<\/a>/);
            const snippetMatch = block.match(/result__snippet[^>]*>(.*?)<\/a>/);
            const urlMatch = block.match(/href="([^"]+)"/);
            if (titleMatch && urlMatch) {
                results.push({
                    title: titleMatch[1].replace(/<[^>]*>/g, ''),
                    snippet: (snippetMatch ? snippetMatch[1] : "").replace(/<[^>]*>/g, ''),
                    url: urlMatch[1]
                });
            }
        }
        return results.length > 0 ? "I've conducted a web search and found several relevant pieces of information. " + results.map(r => `From a site titled "${r.title}" at ${r.url}, I learned that ${r.snippet}`).join(' Additionally, ') : "I searched the web but couldn't find any relevant results for that query.";
    } catch (e) {
        return `I encountered an error while trying to search the web: ${e.message}`;
    }
}

const MAX_OUTPUT_LENGTH = 10000;
function truncate(text) {
    if (text.length <= MAX_OUTPUT_LENGTH) return text;
    return text.substring(0, MAX_OUTPUT_LENGTH) + "\n\n[Output truncated for context length...]";
}

async function executeTool(name, args) {
    if (name === 'web_search') {
        return await performWebSearch(args.query);
    }
    if (name === 'run_shell_command') {
        try {
            const out = execSync(args.command, { encoding: 'utf-8', stdio: 'pipe' });
            return truncate(out || "Command executed successfully with no output.");
        } catch (e) {
            return truncate(`Error: ${e.message}\nStderr: ${e.stderr}`);
        }
    }
    if (name === 'read_file') {
        try {
            return truncate(fs.readFileSync(path.resolve(args.filepath), 'utf-8'));
        } catch (e) {
            return `Error reading file: ${e.message}`;
        }
    }
    if (name === 'list_directory') {
        try {
            const files = fs.readdirSync(path.resolve(args.dirpath || '.'));
            return truncate(files.join('\n'));
        } catch (e) {
            return `Error listing directory: ${e.message}`;
        }
    }
    if (name === 'mem_store') {
        const res = await memoryManager.storeVector(args.text);
        return res.success ? "Memory stored successfully." : `Error: ${res.error}`;
    }
    if (name === 'memory_search') {
        const mems = await memoryManager.queryVectors(args.query);
        return mems.length > 0 ? mems.map(m => m.text).join('\n') : "No memory found";
    }
    return `Unknown tool: ${name}`;
}

module.exports = { AGENT_TOOLS, executeTool };
