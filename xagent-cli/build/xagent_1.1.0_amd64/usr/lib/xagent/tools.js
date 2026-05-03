const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const memoryManager = require('./memory.js');

const AGENT_TOOLS = [
    {
        type: "function",
        function: {
            name: "run_shell_command",
            description: "Execute a bash shell command. Sudo is not supported interactively.",
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
            name: "mem_store",
            description: "Store a fact, detail, or important information about the user or project into your long-term persistent memory.",
            parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] }
        }
    },
    {
        type: "function",
        function: {
            name: "memory_search",
            description: "Search long-term vector memory for past learned knowledge.",
            parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
        }
    }
];

async function executeTool(name, args) {
    if (name === 'run_shell_command') {
        try {
            const out = execSync(args.command, { encoding: 'utf-8', stdio: 'pipe' });
            return out || "Command executed successfully with no output.";
        } catch (e) {
            return `Error: ${e.message}\nStderr: ${e.stderr}`;
        }
    }
    if (name === 'read_file') {
        try {
            return fs.readFileSync(path.resolve(args.filepath), 'utf-8');
        } catch (e) {
            return `Error reading file: ${e.message}`;
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
