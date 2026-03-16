import { BrowserWindow } from 'electron';
import { DEATH_DEBOUNCE_MS } from '../../shared/constants';
import { captureScreen, getScreenshotBuffer } from './screenshotService';
import { analyzeDeathWithBuffer, analyzeScreenshot } from './geminiService';
import { compressScreenshot } from './imageProcessingService';
import { recordScreenshot } from './costTrackingService';
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

// Calibrated baseline: white pixel count in health bar region when alive
let aliveHealthWhiteCount: number = -1;  // -1 = not calibrated

interface PixelRGB { r: number; g: number; b: number; }

// ─── Region definitions (normalized 0-1 coordinates) ─────────────────────────
//
// Personal health bar (bottom-left HUD):
//   The "100" health number text is white, sitting at ~28-34% x, ~93-98% y.
//   Source: visual inspection + community implementations (deepsidh9/Live-Valorant-Overlay)
//
// Screen center (desaturation check):
//   When Valorant player dies the screen goes grayscale — proven by community.
//
const HEALTH_REGION = [
  // Dense grid of sample points covering the health number area
  ...Array.from({ length: 20 }, (_, i) => ({
    x: 0.22 + (i % 5) * 0.025,   // 0.22 → 0.32 (health number zone)
    y: 0.935 + Math.floor(i / 5) * 0.012, // 0.935 → 0.971
  })),
];

const CENTER_REGION = Array.from({ length: 20 }, (_, i) => ({
  x: 0.25 + (i % 5) * 0.12,
  y: 0.30 + Math.floor(i / 5) * 0.12,
}));

async function samplePixels(
  buffer: Buffer,
  points: Array<{ x: number; y: number }>
): Promise<PixelRGB[]> {
  const sharpLib = await getSharp();
  const metadata = await sharpLib(buffer).metadata();
  const width = metadata.width || 1920;
  const height = metadata.height || 1080;
  const rawBuffer = await sharpLib(buffer).raw().toBuffer();
  const channels = 3;

  return points.map(({ x, y }) => {
    const px = Math.min(Math.floor(x * width), width - 1);
    const py = Math.min(Math.floor(y * height), height - 1);
    const offset = (py * width + px) * channels;
    return {
      r: rawBuffer[offset]     || 0,
      g: rawBuffer[offset + 1] || 0,
      b: rawBuffer[offset + 2] || 0,
    };
  });
}

// Count white-ish pixels (health text color in Valorant HUD)
// Source: deepsidh9/Live-Valorant-Overlay health.py → white = [240-255, 240-255, 240-255]
function countWhitePixels(pixels: PixelRGB[]): number {
  return pixels.filter(p => p.r > 230 && p.g > 230 && p.b > 230).length;
}

// Screen saturation drop → death grayscale effect
// Proven method used across multiple community implementations
function computeSaturation(p: PixelRGB): number {
  const max = Math.max(p.r, p.g, p.b);
  const min = Math.min(p.r, p.g, p.b);
  return max === 0 ? 0 : (max - min) / max;
}

function isScreenDesaturated(pixels: PixelRGB[]): boolean {
  const avg = pixels.reduce((s, p) => s + computeSaturation(p), 0) / pixels.length;
  return avg < 0.12;  // Tighter threshold than before — only triggers on actual grayscale
}

async function checkForDeath(buffer: Buffer): Promise<boolean> {
  const [healthPixels, centerPixels] = await Promise.all([
    samplePixels(buffer, HEALTH_REGION),
    samplePixels(buffer, CENTER_REGION),
  ]);

  const currentWhite = countWhitePixels(healthPixels);

  // --- Signal 1: Health bar empty (primary, most reliable) ---
  // If calibrated: white pixel count dropped to <15% of alive baseline → health = 0
  // If not calibrated: fall back to absolute threshold (< 2 white pixels out of 20)
  let healthBarEmpty: boolean;
  if (aliveHealthWhiteCount > 0) {
    healthBarEmpty = currentWhite < aliveHealthWhiteCount * 0.15;
  } else {
    healthBarEmpty = currentWhite <= 1;
  }

  // --- Signal 2: Screen desaturation (secondary) ---
  const screenGray = isScreenDesaturated(centerPixels);

  // Require BOTH signals to reduce false positives
  // OR: if health bar is completely gone (0 white pixels) treat as enough alone
  return (healthBarEmpty && screenGray) || currentWhite === 0;
}

// Calibrate: sample health bar region while alive → store white pixel baseline
export async function calibrate(): Promise<void> {
  const buffer = await captureScreen();
  const healthPixels = await samplePixels(buffer, HEALTH_REGION);
  aliveHealthWhiteCount = countWhitePixels(healthPixels);
  console.log(`[DeathDetection] Calibrated. Alive white pixel count: ${aliveHealthWhiteCount}`);
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
        displayWindow?.webContents.send(IPC_CHANNELS.COACHING_STATUS, 'analyzing death...');

        const bufferedShots = getScreenshotBuffer();

        if (bufferedShots.length >= 2) {
          try {
            const tip = await analyzeDeathWithBuffer(bufferedShots);
            displayWindow?.webContents.send(IPC_CHANNELS.COACHING_TIP, tip);
            displayWindow?.webContents.send(IPC_CHANNELS.COACHING_STATUS, 'idle');
          } catch (err) {
            console.error('Buffer death analysis failed, falling back:', err);
            await fallbackDeathAnalysis(buffer, displayWindow);
          }
        } else {
          await fallbackDeathAnalysis(buffer, displayWindow);
        }
      }
    } catch (error) {
      console.error('Death detection error:', error);
    }
  }, 1000); // Poll every 1s for faster death detection
}

async function fallbackDeathAnalysis(
  buffer: Buffer,
  displayWindow: BrowserWindow | null
): Promise<void> {
  try {
    const { base64, wasDeduplicated } = await compressScreenshot(buffer);
    recordScreenshot(wasDeduplicated);
    const tip = await analyzeScreenshot(base64, true);
    displayWindow?.webContents.send(IPC_CHANNELS.COACHING_TIP, tip);
    displayWindow?.webContents.send(IPC_CHANNELS.COACHING_STATUS, 'idle');
  } catch (error) {
    console.error('Fallback death analysis error:', error);
    displayWindow?.webContents.send(IPC_CHANNELS.COACHING_STATUS, 'error: analysis failed');
  }
}

export function stopDeathDetection(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
