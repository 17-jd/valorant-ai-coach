import { BrowserWindow } from 'electron';
import { CAPTURE_INTERVALS } from '../../shared/constants';
import { CaptureMode, CoachingTip } from '../../shared/types';
import { compressScreenshot, resetDedup } from './imageProcessingService';
import { analyzeScreenshot } from './geminiService';
import { recordScreenshot } from './costTrackingService';
import { IPC_CHANNELS } from '../ipc/channels';

// Use screenshot-desktop for screen capture
let screenshotDesktop: ((options?: object) => Promise<Buffer>) | null = null;

async function getScreenshotLib() {
  if (!screenshotDesktop) {
    screenshotDesktop = (await import('screenshot-desktop')).default as unknown as (options?: object) => Promise<Buffer>;
  }
  return screenshotDesktop;
}

let captureTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

export async function captureScreen(): Promise<Buffer> {
  const screenshot = await getScreenshotLib();
  return screenshot({ format: 'png' });
}

export async function captureAndAnalyze(
  displayWindow: BrowserWindow | null,
  isDeath: boolean = false
): Promise<CoachingTip | null> {
  try {
    // Send status update
    displayWindow?.webContents.send(IPC_CHANNELS.COACHING_STATUS, 'capturing');

    const buffer = await captureScreen();
    const { base64, wasDeduplicated } = await compressScreenshot(buffer);
    recordScreenshot(wasDeduplicated);

    // Skip if frame is too similar to previous (unless death analysis)
    if (wasDeduplicated && !isDeath) {
      displayWindow?.webContents.send(IPC_CHANNELS.COACHING_STATUS, 'skipped');
      return null;
    }

    displayWindow?.webContents.send(IPC_CHANNELS.COACHING_STATUS, 'analyzing');

    const tip = await analyzeScreenshot(base64, isDeath);

    // Send tip to display window
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

  if (mode === 'on-death-only') {
    // Death detection mode is handled by deathDetectionService
    // This just marks that we're running
    return;
  }

  const interval = CAPTURE_INTERVALS[mode];
  captureTimer = setInterval(() => {
    if (isRunning) {
      captureAndAnalyze(displayWindow);
    }
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
}

export function isCapturing(): boolean {
  return isRunning;
}
