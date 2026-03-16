import { BrowserWindow } from 'electron';
import { DEATH_DEBOUNCE_MS, SATURATION_THRESHOLD, DEATH_SIGNALS_REQUIRED } from '../../shared/constants';
import { captureScreen } from './screenshotService';
import { captureAndAnalyze } from './screenshotService';
import { IPC_CHANNELS } from '../ipc/channels';

let sharp: typeof import('sharp') | null = null;

async function getSharp() {
  if (!sharp) {
    sharp = (await import('sharp')).default as unknown as typeof import('sharp');
  }
  return sharp;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastDeathTime = 0;
let calibrationData: { hudPixels: number[][] } | null = null;

interface PixelRGB {
  r: number;
  g: number;
  b: number;
}

async function samplePixels(
  buffer: Buffer,
  points: Array<{ x: number; y: number }>
): Promise<PixelRGB[]> {
  const sharpLib = await getSharp();
  const metadata = await sharpLib(buffer).metadata();
  const width = metadata.width || 1920;
  const height = metadata.height || 1080;

  const rawBuffer = await sharpLib(buffer).raw().toBuffer();
  const channels = 3; // RGB

  return points.map(({ x, y }) => {
    const px = Math.min(Math.floor(x * width), width - 1);
    const py = Math.min(Math.floor(y * height), height - 1);
    const offset = (py * width + px) * channels;
    return {
      r: rawBuffer[offset] || 0,
      g: rawBuffer[offset + 1] || 0,
      b: rawBuffer[offset + 2] || 0,
    };
  });
}

function computeSaturation(pixel: PixelRGB): number {
  const max = Math.max(pixel.r, pixel.g, pixel.b);
  const min = Math.min(pixel.r, pixel.g, pixel.b);
  if (max === 0) return 0;
  return (max - min) / max;
}

// Signal 1: Check if HUD ability bar is absent (dead = no HUD)
function checkHudAbsence(hudPixels: PixelRGB[]): boolean {
  if (!calibrationData) return false;

  // Compare current HUD region with calibrated "alive" state
  // If the colors are very different, HUD is likely absent
  let diffCount = 0;
  for (let i = 0; i < hudPixels.length; i++) {
    const cal = calibrationData.hudPixels[i];
    if (!cal) continue;
    const diff =
      Math.abs(hudPixels[i].r - cal[0]) +
      Math.abs(hudPixels[i].g - cal[1]) +
      Math.abs(hudPixels[i].b - cal[2]);
    if (diff > 150) diffCount++;
  }
  return diffCount >= hudPixels.length * 0.7;
}

// Signal 2: Check screen desaturation (death = grayscale)
function checkDesaturation(centerPixels: PixelRGB[]): boolean {
  const avgSaturation =
    centerPixels.reduce((sum, p) => sum + computeSaturation(p), 0) /
    centerPixels.length;
  return avgSaturation < SATURATION_THRESHOLD;
}

// Signal 3: Check for spectator bar at bottom
function checkSpectatorBar(bottomPixels: PixelRGB[]): boolean {
  // Spectator bar is dark and consistent across the bottom
  const darkCount = bottomPixels.filter(
    (p) => p.r < 40 && p.g < 40 && p.b < 40
  ).length;
  return darkCount >= bottomPixels.length * 0.6;
}

async function checkForDeath(buffer: Buffer): Promise<boolean> {
  // Sample points across the screen (normalized 0-1 coordinates)
  const hudPoints = [
    { x: 0.42, y: 0.92 },
    { x: 0.46, y: 0.92 },
    { x: 0.50, y: 0.92 },
    { x: 0.54, y: 0.92 },
    { x: 0.58, y: 0.92 },
  ];

  const centerPoints = Array.from({ length: 15 }, (_, i) => ({
    x: 0.2 + (i % 5) * 0.15,
    y: 0.3 + Math.floor(i / 5) * 0.15,
  }));

  const bottomPoints = Array.from({ length: 8 }, (_, i) => ({
    x: 0.1 + i * 0.1,
    y: 0.97,
  }));

  const [hudPixels, centerPixels, bottomPixels] = await Promise.all([
    samplePixels(buffer, hudPoints),
    samplePixels(buffer, centerPoints),
    samplePixels(buffer, bottomPoints),
  ]);

  let signals = 0;
  if (checkHudAbsence(hudPixels)) signals++;
  if (checkDesaturation(centerPixels)) signals++;
  if (checkSpectatorBar(bottomPixels)) signals++;

  return signals >= DEATH_SIGNALS_REQUIRED;
}

export async function calibrate(): Promise<void> {
  // Capture current screen and save HUD pixel reference
  const buffer = await captureScreen();
  const hudPoints = [
    { x: 0.42, y: 0.92 },
    { x: 0.46, y: 0.92 },
    { x: 0.50, y: 0.92 },
    { x: 0.54, y: 0.92 },
    { x: 0.58, y: 0.92 },
  ];

  const hudPixels = await samplePixels(buffer, hudPoints);
  calibrationData = {
    hudPixels: hudPixels.map((p) => [p.r, p.g, p.b]),
  };
}

export function startDeathDetection(displayWindow: BrowserWindow | null): void {
  stopDeathDetection();

  pollTimer = setInterval(async () => {
    const now = Date.now();
    if (now - lastDeathTime < DEATH_DEBOUNCE_MS) return;

    try {
      const buffer = await captureScreen();
      const isDead = await checkForDeath(buffer);

      if (isDead) {
        lastDeathTime = now;
        displayWindow?.webContents.send(IPC_CHANNELS.DEATH_DETECTED);
        // Trigger analysis with death context
        captureAndAnalyze(displayWindow, true);
      }
    } catch (error) {
      console.error('Death detection error:', error);
    }
  }, 1500);
}

export function stopDeathDetection(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
