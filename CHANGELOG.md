# Xkaliber Agent v29 Changelog

## [29.0.0] - 2026-04-30

### Added
- **Neural-Core Guard Rails:** Implemented advanced protection against tool call hallucinations.
  - Added real-time validation of tool names and argument schemas before execution.
  - Implemented an interception layer that detects unknown or malformed tool calls and automatically nudges the model to ask the user for clarification.
  - Updated System Prompt with strict directives to prioritize user clarification over guessing when uncertain.
- **Improved Versioning:** Synchronized application versioning to v29 across all components including UI, CLI, and persistent storage.

### Fixed
- **UI Crash:** Fixed a critical syntax error in the core system prompt generation that caused the UI thread to crash on startup, preventing model connection and history loading.
- **Chat History Migration:** Fixed an issue where the chat history would appear blank on first launch of v29. Added fallback logic to seamlessly migrate legacy session history into the new v29 format.
- **Unprompted Actions:** Strengthened System Prompt guard rails to strictly prohibit the model from creating files, configurations, or examples unless explicitly commanded by the user, preventing over-eager tool hallucinations.

## [28.0.0] - 2026-04-29

### Added
- **Cross-Platform Compatibility:** Enhanced support for AMD ROCm and NVIDIA GPUs on Linux.
- **Performance Optimizations:** Improved VRAM management and tool execution speed.

## [27.0.0] - 2026-04-28

### Added
- **Dynamic Schemas:** Added support for generating dynamic tool schemas on the fly.
- **Vector Memory v27:** Upgraded persistent vector memory database for better retrieval performance.

# Xkaliber Agent v26 Changelog


## [26.0.0] - 2026-04-27

### Fixed
- **LM Studio Tool Results Bug:** Fixed an issue where the agent would fail to provide results after a web search until the user prompted it a second time.
  - Implemented persistent Tool Call IDs in the chat history to prevent context mismatch during agent loops.
  - Improved OpenAI-format message reconstruction for LM Studio, ensuring assistant messages use valid content fields when tool calls are present.
  - Added an autonomous "nudge" mechanism that detects when a model is silent after receiving tool results and automatically prompts for the final answer.

## [25.0.0] - 2026-04-26

### Added
- **LM Studio Support:** Integrated support for LM Studio (Uplink) alongside Ollama, allowing for high-performance inference with OpenAI-compatible tool calling.
- **Enhanced Agent Loops:** Refined the core agentic behavior to better handle multi-turn tool execution and streaming responses.

# Xkaliber Agent v24 Changelog

## [24.0.0] - 2026-04-23

### Fixed
- **TTS Critical Crash:** Fixed a recurring issue where the Text-to-Speech (TTS) engine would crash the Electron main process with a "JavaScript error occurred in main process" message.
  - Implemented robust global stream handling within the `speakText` function.
  - Added comprehensive `try-catch` blocks and dedicated error listeners for `stdin` and `stdout` on both the `piper` (TTS generation) and audio player (`aplay`/`paplay`) child processes to gracefully handle `EPIPE` and other stream disruptions without terminating the application.
- **AppImage Symlink Corruption:** Resolved an issue specific to AppImage environments where Piper dependency libraries (like `libonnxruntime.so.1`) were copied as absolute symlinks into the writable `userData` directory, causing them to break on subsequent launches.
  - Rewrote the `getPiperPaths` initialization logic to automatically detect, unlink, and recreate proper relative symlinks for all required shared libraries on application startup.

### Changed
- Incremented base application version to v24 to ensure clean upgrade paths and cache invalidation.
