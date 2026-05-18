# Fixes and Optimizations Report

## 1. TTS Feature Fixed & Hardened
The TTS feature had several issues causing "JavaScript error occurred in main process".
- **Symlink Fix:** Fixed an issue where absolute symlinks from AppImage mounts were copied to `userData`, becoming broken on subsequent launches. Added logic to `getPiperPaths` to automatically detect and recreate relative symlinks.
- **Robust Stream Handling:** Wrapped `speakText` in a try-catch block and added error listeners for `stdin` and `stdout` of the `piper` and audio player processes. This prevents unhandled `EPIPE` errors from crashing the main process.
- **Permissions:** Ensured `piper`, `piper_phonemize`, and `espeak-ng` executables have correct permissions in the `userData` directory.
- **Library Linkage:** Fixed library linkage by ensuring relative symlinks and setting `LD_LIBRARY_PATH` correctly.

## 2. AMD Optimization Added
(Unchanged section)
- **CPU Optimization:** Detects AMD CPUs and applies Electron performance flags.
- **Threading:** Automatically calculates optimal `OMP_NUM_THREADS` for AMD physical cores.
- **GPU Optimization:** Detects AMD GPUs and applies `HSA_OVERRIDE_GFX_VERSION=11.0.0` for newer architectures.

## 3. Memory & Resource Management (v36.3)
Addressed critical resource congestion issues during long autonomous tasks.
- **Dynamic Context Pruning:** Implemented logic to automatically trim extremely large messages and prune intermediate conversation history when "Resource Saver" mode is enabled.
- **Memory Purge Tool:** Added the `memory_purge` capability, allowing the agent to request context cleanup and model paging-out to refresh VRAM.
- **Ollama Keep-Alive Control:** Reduced model retention time in VRAM from 5m to 1m when Resource Saver is active.
- **CLI Pruning:** Added history pruning to the CLI (`index.js`) to prevent RAM bloat during multi-turn sessions.

## Verification
1. Launch the app and enable **RESOURCE SAVER** in the sidebar.
2. Engage in a long conversation or task (e.g., "Build me a web app").
3. Monitor the console (DevTools) for `Resource Manager: Pruning history` logs.
4. Verify the agent can call `memory_purge` when context gets heavy.
