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

## Verification
1. Launch the app using `npm start`.
2. Check the terminal output for:
   - `Hardware: AMD CPU Detected. Applying performance tweaks...`
   - `Hardware: AMD GPU Detected ...`
   - `Hardware: Applying HSA_OVERRIDE_GFX_VERSION=11.0.0 ...`
3. Test TTS by toggling the audio switch and sending a message.
