# Xkaliber Agent v30.5 🚀

Xkaliber Agent is a modern, dark-themed autonomous agent desktop client built with Electron. It connects seamlessly to local **Ollama** and **LM Studio** neural models and equips them with system-level access, persistent vector memory, web scraping, and multimodal capabilities. 

## 🌟 Key Features

### 🌐 Natural Language Web Search
*   **Conversational Narrative**: Web search results are processed and presented as a cohesive, first-person narrative (e.g., "I searched the web and found that...").
*   **Anti-Clutter Design**: Explicit directives and tool schemas prevent the use of bullet points, numbered lists, or markdown tables when conveying search information, ensuring a natural conversational flow.

### 🧠 Neuro-Core (Intelligent Persistent Memory)
The agent features a robust long-term memory engine powered by local embeddings.
*   **Embedding Smart Learning & VRAM Management**: Automatically handles VRAM congestion during memory retrieval and storage. If the embedding model fails to load due to full VRAM, the agent autonomously suspends/unloads idle models to free up GPU resources.
*   **Strict Fact Retention**: The agent is heavily constrained to avoid saving casual conversation. It autonomously decides to use the `save_new_user_fact_only` tool to vectorize and save only *highly important, permanent* user preferences, facts, or project details.
*   **Embeddings Engine**: Utilizes the `all-minilm` model. If Ollama doesn't have it installed, Xkaliber Agent will securely stream and auto-download it on startup.
*   **Main Process Storage**: Memory vector databases are safely written to the user's local disk via IPC.
*   **UI Feedback**: Features a real-time `[X MEMS]` counter and a flashing `[ NEURO-CORE SAVING... ]` indicator.

### 🛡️ System Access & Sudo Override
*   **Shell Execution**: The agent can run bash commands directly on your host machine to navigate, modify files, and manage the system.
*   **Secure Sudo Injection**: A password field in the UI allows you to provide your sudo password. When the agent attempts a command requiring root privileges, the application dynamically intercepts and pipes your password.
*   **Guard Rails**: Strict system prompts prevent the agent from modifying files or configurations unprompted.

### 🛠️ Autonomous Agent Tools
The UI provides transparent execution logs (`⚡ Exec: function_name`). Available tools include:
*   `run_shell_command`
*   `read_file`, `write_file`, `list_directory`, `delete_file`
*   `save_new_user_fact_only`, `memory_search`
*   `web_search`

### 🌐 Netrunner (Web Access)
*   Equips the agent with real-time web search capabilities using a secure DuckDuckGo HTML scraper (bypassing CORS and API key requirements).
*   **Conversational Synthesis**: Web data is injected securely into the prompt, forcing the LLM to read the data and respond with a natural, flowing, first-person narrative essay, strictly avoiding bulleted lists or markdown tables.

### 🔊 Audio Uplink (TTS) & Multimodal
*   **Piper TTS**: High-quality, offline Text-to-Speech integration (`en_US-lessac-medium`).
*   **File Attachments**: Drop text files or images directly into the chat for context injection or vision-model analysis.

## ⚙️ Development & Build Instructions

### Prerequisites
*   Node.js (v18+)
*   Ollama running locally (`ollama serve`)

### Setup
```bash
# Install dependencies
npm install

# Start in development mode
npm start
```

### 🚀 NVIDIA & Linux GPU Support
This version includes enhanced compatibility for NVIDIA hardware on Linux.




### Building Binaries (AppImage & Debian)
```bash
# Build production binaries
npm run dist
```
The output files will be in the `dist/` directory.

this tool can be dangerous if used irresponsibly. not responcible for anything if you so choose to use this application
