# Xkaliber Agent v30.5 Changelog

## [30.5.0] - 2025-09-03

### Enhanced
- **Web Search Presentation**: Completely refactored how web search results are processed and presented.
  - **Natural Language Narrative**: The agent is now instructed to present all search findings as a cohesive, first-person narrative (e.g., "I found that...").
  - **Anti-Clutter Directives**: Explicitly prohibited the use of bullet points, numbered lists, and markdown tables for search results to ensure a clean, conversational flow.
  - **Narrative Tool Output**: Modified the `web_search` tool to return information in a narrative paragraph format, guiding the model toward the desired conversational style.
- **Builds**: Generated updated standalone executables for v30.5.0.
  - Packaged as `.AppImage` for portable Linux deployment.
  - Packaged as `.deb` for Debian/Ubuntu based systems.

# Xkaliber Agent v30.4 Changelog

## [30.4.0] - 2026-06-30

### Enhanced
- **Prompt Architecture**: Re-instated explicit `GUARD RAILS` in the core system prompt to strictly prevent tool call hallucinations and unprompted system modifications.
- **Narrative Enforcement**: Hardened the system instructions to ensure conversational, non-structured outputs (essays/news reports) when handling web data. The AI is now strictly forbidden from utilizing markdown tables, lists, or bolded headers during web search context generation.
- **Memory Tool Constraints**: Drastically reduced aggressive memory saves. The `save_new_user_fact_only` tool schema and system prompts have been heavily constrained to ignore casual conversation and greetings, triggering only on highly important, permanent facts.

### Removed
- **Live Summary**: Removed the experimental "Live Summary" instruction from the web search prompt as it was causing conversational flow issues and bleeding into casual queries.

## [30.3.0] - 2026-06-30

### Enhanced
- **Web Search Consolidation**: Search results are now synthesized into a single, organized summary rather than individual statements.
- **Search Result Limit**: Set to a balanced limit of 6 results per query.
- **Improved Context Injection**: Directives added to both user prompts and system prompts to enforce synthesized, cited responses.
- **Robust Scraper**: Better HTML entity handling for cleaner data extraction.

## [30.2.0] - 2026-06-29

### Fixed
- **Hardware Guard Reset (VRAM Lock):** Fixed an issue where the Emergency Reset button aggressively killed Ollama (`kill -9`), causing the AMD ROCm/NVIDIA GPU driver to lock the VRAM and requiring a full PC reboot.
  - Implemented a graceful shutdown sequence (`kill -15` with a timeout) to allow models to cleanly deallocate VRAM.
  - Added support for automatically executing `systemctl restart ollama` to guarantee a clean state if the user has provided a Sudo Password in the UI.

## [30.0.0] - 2026-06-29

### Added
- **🛡️ Hardware Guard Implementation:**
  - Real-time VRAM and System RAM telemetry monitor in the sidebar.
  - Interactive GPU load tracking for both AMD and NVIDIA hardware.
  - **Emergency Hardware Reset:** One-click feature to kill unresponsive AI backends (Ollama/LMS) and relaunch the agent.
  - **Watchdog Alert System:** Proactive notifications when the AI backend stops responding, often due to VRAM exhaustion.
- **Improved Telemetry Support:** Added AMD `sysfs` detection for VRAM and GPU utilization as a primary telemetry source.
- **Safe State Migration:** Automated migration of session history from v29 to v30.

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
