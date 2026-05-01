# Xkaliber Agent v29 🚀

this supports lmstudio and ollama only. 

(required : ollama pull all-minilm  )

Xkaliber Agent is a modern, dark-themed autonomous agent desktop client built with Electron. It connects seamlessly to local **Ollama** neural models and equips them with system-level access, persistent vector memory, web scraping, and multimodal capabilities. 

## 🌟 Key Features

### 🧠 Neuro-Core (Intelligent Persistent Memory)
The agent features a robust "Clawbot-style" long-term memory engine powered by local embeddings.
*   **Embedding Smart Learning & VRAM Management**: Automatically handles VRAM congestion during memory retrieval and storage. If the embedding model fails to load due to full VRAM, the agent autonomously suspends/unloads idle models to free up GPU resources, ensuring memory functions remain operational under heavy system load.
*   **Intelligent Storage**: The agent does not blindly record all chatter. It autonomously decides when to use the `mem_store` tool to vectorize and save important user preferences, facts, or project details.
*   **Embeddings Engine**: Utilizes the `all-minilm` model. If Ollama doesn't have it installed, Xkaliber Agent will securely stream and auto-download it on startup.
*   **Main Process Storage**: Memory vector databases are safely written to the user's local disk (`~/.config/xkaliber-agent/xkaliber_vectors_v21.json`) via IPC, bypassing browser sandbox restrictions.
*   **UI Feedback**: Features a real-time `[X MEMS]` counter and a flashing `[ NEURO-CORE SAVING... ]` indicator whenever a new memory is successfully committed to disk.
*   **Memory Wipe**: A dedicated WIPE MEMORY button completely flushes the UI context, active session JSON, and the physical vector database.

### 🛡️ System Access & Sudo Override
*   **Shell Execution**: The agent can run bash commands directly on your host machine to navigate, modify files, and manage the system.
*   **Secure Sudo Injection**: A password field in the UI allows you to provide your sudo password. When the agent attempts a command requiring root privileges (e.g., `sudo apt install...`), the application dynamically intercepts and pipes your password (`echo "pass" | sudo -S`) without ever logging the password in the chat history or neural memory.

### 🛠️ Autonomous Agent Tools
The UI provides transparent execution logs (`⚡ Exec: function_name`) followed by exact, formatted JSON arguments so you can always see what the agent is doing under the hood. Available tools include:
*   `run_shell_command`
*   `read_file`, `write_file`, `list_directory`, `delete_file`
*   `mem_store`, `memory_search`
*   `dynamic_schema_generate` (for creating structured JSON data)
*   `web_search`
*   `send_whatsapp_message`

### 🌐 Netrunner (Web Access)
*   Equips the agent with real-time web search capabilities using a secure DuckDuckGo HTML scraper to bypass CORS and API key requirements.

### 📱 WhatsApp Integration
*   Scan a QR code directly inside the application to link your WhatsApp account.
*   The agent can autonomously send notifications and messages to numbers via the `send_whatsapp_message` tool.

### 🔊 Audio Uplink (TTS) & Multimodal
*   **Piper TTS**: High-quality, offline Text-to-Speech integration (`en_US-lessac-medium`).
*   **File Attachments**: Drop text files or images directly into the chat for context injection or vision-model analysis.

## ⚙️ Development & Build Instructions

### Prerequisites
*  lmstudio
*   Ollama running locally (`ollama serve`)


### 🚀 NVIDIA & AMD GPU Support



