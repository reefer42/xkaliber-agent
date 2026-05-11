# Xkaliber Agent v34 🚀

Xkaliber Agent is a modern, dark-themed autonomous agent desktop client built with Electron. It connects seamlessly to local **Ollama** and **LM Studio** neural models and equips them with system-level access, persistent vector memory, web scraping, and multimodal capabilities. 

<img width="2560" height="1600" alt="Screenshot_20260506_115900" src="https://github.com/user-attachments/assets/d41ecc3d-404b-4ad2-b4a4-81718e09a884" />

[![Watch the video](https://img.youtube.com/vi/cSRlGK5HWvI/maxresdefault.jpg)](https://www.youtube.com/watch?v=cSRlGK5HWvI)
video demo
## 🌟 Key Features

### 🤖 Autonomous "Plan-Execute-Verify" Workflow (v34)
The agent now supports a sophisticated multi-turn autonomous loop designed for complex system tasks and research.
*   **Contextual Tool-Chaining**: Instead of linear execution, the agent uses a `task_begin` tool to formally declare a high-level goal and a structured multi-step plan.
*   **Plan-Execute-Verify**: The agent executes steps sequentially, analyzes outputs, and automatically decides the next action. It finishes with a `task_complete` call to summarize results and verify the goal was achieved.
*   **Extended Reasoning**: Supports up to **20 autonomous turns** per user message, providing the depth needed for multi-file audits, deep research, or complex troubleshooting.
*   **System Stability**: Built-in 1-second "cool-down" delays between turns prevent VRAM/CPU exhaustion and system lockups during long reasoning chains.
*   **Live Feedback**: The UI remains interactive and transparent, showing exactly which step the agent is on (`Thinking (Step X/20)...`) without clearing previous context.

### 🧠 Neuro-Core (Intelligent Persistent Memory)
The agent features a robust long-term memory engine powered by local embeddings.
*   **Low-VRAM Optimization (v31.3):** The `all-minilm` embedding model is now strictly forced to run on the **CPU**, preventing VRAM contention and application hangs on systems with limited GPU memory.
*   **Zero-Swap Performance:** By offloading embeddings to the CPU, Xkaliber Agent no longer needs to unload your primary chat model to perform memory searches, resulting in significantly faster and more stable retrieval.
*   **Strict Fact Retention**: The agent is heavily constrained to avoid saving casual conversation. It autonomously decides to use the `save_new_user_fact_only` tool to vectorize and save only *highly important, permanent* user preferences, facts, or project details.
*   **Embeddings Engine**: Utilizes the `all-minilm` model. If Ollama doesn't have it installed, Xkaliber Agent will securely stream and auto-download it on startup.
*   **Main Process Storage**: Memory vector databases are safely written to the user's local disk via IPC.
*   **UI Feedback**: Features a real-time `[X MEMS]` counter and a flashing `[ NEURO-CORE SAVING... ]` indicator.

### 👻 GhostTrace Diagnostics System
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
**Secure Authentication System:** Implemented a full user authentication system to control access to the application and backend APIs.
  - **First-Run Setup:** The first user to register an account is automatically designated as the Administrator.
  - **Default-Deny Access:** All subsequent new user registrations default to having zero access (both App and Tool access disabled) until approved by an admin.
  - **Admin Control Panel:** Added a dedicated overlay for the Administrator to view registered users and dynamically toggle their App Access and Tool Access privileges.
- **Remote Access Protection:** The web server (port 3000) now requires a valid session token for all API endpoints, preventing unauthorized remote usage via the mobile web view or external integrations.
- **Secure Storage:** User passwords are encrypted using `bcryptjs` before being stored.

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
