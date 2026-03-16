import { BrowserWindow, desktopCapturer } from 'electron';
import { CAPTURE_INTERVALS, BUFFER_SIZE, BUFFER_CAPTURE_INTERVAL_MS } from '../../shared/constants';
import { CaptureMode, CoachingTip } from '../../shared/types';
import { compressScreenshot, resetDedup } from './imageProcessingService';
import { analyzeScreenshot } from './geminiService';
import { recordScreenshot } from './costTrackingService';
import { IPC_CHANNELS } from '../ipc/channels';

let captureTimer: ReturnType<typeof setInterval> | null = null;
let bufferTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

// Rolling screenshot buffer — like GeForce Instant Replay
const screenshotBuffer: string[] = [];

// Use Electron's built-in desktopCapturer — no external binary needed
export async function captureScreen(): Promise<Buffer> {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 },
  });

  if (!sources.length) throw new Error('No screen sources found');

  // Primary screen is first source
  const png = sources[0].thumbnail.toPNG();
  if (!png.length) throw new Error('Screen capture returned empty image');
  return png;
}

// Silently capture to rolling buffer every 2s
async function captureToBuffer(): Promise<void> {
  try {
    const buffer = await captureScreen();
    const { base64 } = await compressScreenshot(buffer);
    screenshotBuffer.push(base64);
    if (screenshotBuffer.length > BUFFER_SIZE) {
      screenshotBuffer.shift();
    }
  } catch (err) {
    console.error('[Buffer] Capture failed:', err);
  }
}

// Returns the current buffered screenshots (oldest → newest)
export function getScreenshotBuffer(): string[] {
  return [...screenshotBuffer];
}

export async function captureAndAnalyze(
  displayWindow: BrowserWindow | null,
  isDeath: boolean = false
): Promise<CoachingTip | null> {
  try {
    displayWindow?.webContents.send(IPC_CHANNELS.COACHING_STATUS, 'capturing');

    const buffer = await captureScreen();
    const { base64, wasDeduplicated } = await compressScreenshot(buffer);
    recordScreenshot(wasDeduplicated);

    if (wasDeduplicated && !isDeath) {
      displayWindow?.webContents.send(IPC_CHANNELS.COACHING_STATUS, 'skipped');
      return null;
    }

    displayWindow?.webContents.send(IPC_CHANNELS.COACHING_STATUS, 'analyzing');

    const tip = await analyzeScreenshot(base64, isDeath);

    displayWindow?.webContents.send(IPC_CHANNELS.COACHING_TIP, tip);
    displayWindow?.webContents.send(IPC_CHANNELS.COACHING_STATUS, 'idle');

    return tip;
  } catch (error) {
    console.error('Capture/analyze error:', error);
    displayWindow?.webContents.send(
      IPC_CHANNELS.COACHING_STATUS,
      `error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return null;
  }
}

export function startCapture(
  mode: CaptureMode,
  displayWindow: BrowserWindow | null
): void {
  stopCapture();
  resetDedup();
  isRunning = true;

  // Always start the rolling buffer regardless of capture mode
  screenshotBuffer.length = 0;
  bufferTimer = setInterval(() => {
    if (isRunning) captureToBuffer();
  }, BUFFER_CAPTURE_INTERVAL_MS);

  if (mode === 'on-death-only') {
    // Coaching tips handled by deathDetectionService — buffer still runs
    return;
  }

  const interval = CAPTURE_INTERVALS[mode];
  captureTimer = setInterval(() => {
    if (isRunning) captureAndAnalyze(displayWindow);
  }, interval);

  // Capture immediately on start
  captureAndAnalyze(displayWindow);
}

export function stopCapture(): void {
  isRunning = false;
  if (captureTimer) {
    clearInterval(captureTimer);
    captureTimer = null;
  }
  if (bufferTimer) {
    clearInterval(bufferTimer);
    bufferTimer = null;
  }
  screenshotBuffer.length = 0;
}

export function isCapturing(): boolean {
  return isRunning;
}
