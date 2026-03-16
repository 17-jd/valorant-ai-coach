# Valorant AI Coach

## Project Overview
Desktop app (Electron + React + TypeScript) that acts as a real-time AI coach for Valorant. Captures gameplay screenshots, sends them to Gemini 2.5 Flash API for tactical analysis, and delivers coaching tips via on-screen overlay or TTS audio.

## Tech Stack
- **Electron** — desktop shell with two BrowserWindows (settings + overlay/tips)
- **React 19 + TypeScript** — UI for both windows
- **Vite 5** — renderer bundling (two configs: `vite.main-window.config.ts`, `vite.overlay-window.config.ts`)
- **tsc** — main process compilation
- **Gemini 2.5 Flash** via `@google/generative-ai` SDK
- **sharp** — image resize/compression
- **screenshot-desktop** — screen capture

## Commands
```bash
npm run build          # compile main (tsc) + renderer (vite)
npm run dev            # dev mode with hot reload (runs 3 processes concurrently)
npm run start          # build + launch electron
npx electron .         # launch after build
npm run dist           # package for Windows (.exe installer via electron-builder)
```

## Architecture
```
src/
  main/              # Electron main process (CJS, compiled with tsc)
    index.ts         # App entry: creates windows, registers IPC
    windows/         # BrowserWindow factories (main settings + overlay + separate)
    services/        # Core logic:
      screenshotService.ts      — capture + timer (5s/10s/on-death modes)
      deathDetectionService.ts  — pixel analysis (HUD absence + desaturation + spectator bar)
      geminiService.ts          — API client, coaching prompt, conversation history
      imageProcessingService.ts — sharp resize to 720p, JPEG compress, perceptual hash dedup
      costTrackingService.ts    — token/cost accounting per session
      settingsService.ts        — JSON file storage in app userData
    ipc/             # IPC channel definitions + handler registration
  renderer/          # React apps (ESM, bundled with Vite)
    main-window/     # Settings UI (port 5173 in dev)
    overlay-window/  # Overlay/tips display (port 5174 in dev)
  shared/            # Types and constants shared between main + renderer
  preload/           # contextBridge API exposed to renderers
```

## Key Design Decisions
- **Settings stored as JSON** in Electron userData (not electron-store — it's ESM-only, conflicts with CJS main process)
- **Two display modes**: game overlay (transparent always-on-top, needs borderless windowed Valorant) AND separate window (for second monitor, Vanguard-safe)
- **Death detection** uses multi-signal approach: 2 of 3 signals required (HUD absence, screen desaturation, spectator bar). Needs calibration on first run.
- **Frame deduplication** via 8x8 perceptual hash — skips similar frames to save API cost
- **Conversation history**: sliding window of last 3 exchanges sent with each API call for round context
- **Cost budget**: user has $300 Google Cloud credits. Every-10s mode costs ~$0.65/hr.

## What's Done (Phases 1-6)
- Full project scaffold with Electron + React + TypeScript
- Both windows (settings UI + overlay/tips)
- All backend services (screenshot, death detection, Gemini API, cost tracking)
- IPC bridge between main and renderer processes
- Valorant-themed dark UI with red accents
- Builds and launches successfully on macOS

## What's Left (Phase 7 — Polish + Packaging)
- [ ] System tray icon with start/stop/quit menu
- [ ] Auto-hide overlay when Valorant is not in foreground (check active window title)
- [ ] Windows app icon (assets/icons/icon.ico)
- [ ] Test on Windows with actual Valorant gameplay
- [ ] Fine-tune death detection pixel coordinates for different resolutions
- [ ] Test TTS voice quality on Windows (Web Speech API uses different voices per OS)
- [ ] Package with `electron-builder` for Windows NSIS installer (`npm run dist`)
- [ ] Add disclaimer about Vanguard anti-cheat in the UI

## Testing on Windows
1. Clone repo, run `npm install`
2. Get a Gemini API key from https://aistudio.google.com/apikey
3. Run `npm run build && npx electron .`
4. Enter API key in settings, click "Test"
5. Set Valorant to **Borderless Windowed** mode (or use Separate Window display mode)
6. Click "Calibrate HUD" while alive in-game
7. Select capture mode and click "Start Coaching"

## Important Notes
- `sharp` native module needs `asarUnpack` in electron-builder config (already configured in package.json)
- Overlay only works over Valorant in **Borderless Windowed** mode, not exclusive fullscreen
- Separate Window mode works with any Valorant display mode
- The app does NOT inject into Valorant's process — it only captures screenshots at the OS level
