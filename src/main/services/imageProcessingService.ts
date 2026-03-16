import { TARGET_WIDTH, TARGET_HEIGHT, JPEG_QUALITY } from '../../shared/constants';

// We'll use sharp for image processing — installed separately
// For now, use a dynamic import to handle the native module
let sharp: typeof import('sharp') | null = null;

async function getSharp() {
  if (!sharp) {
    sharp = (await import('sharp')).default as unknown as typeof import('sharp');
  }
  return sharp;
}

let previousHash: string | null = null;

export async function compressScreenshot(
  buffer: Buffer
): Promise<{ base64: string; wasDeduplicated: boolean }> {
  const sharpLib = await getSharp();

  // Resize and compress to JPEG
  const processed = await sharpLib(buffer)
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: 'fill' })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  // Simple perceptual hash for deduplication
  const hash = await computeHash(sharpLib, buffer);
  const isDuplicate = previousHash !== null && hammingDistance(hash, previousHash) < 5;
  previousHash = hash;

  return {
    base64: processed.toString('base64'),
    wasDeduplicated: isDuplicate,
  };
}

async function computeHash(
  sharpLib: typeof import('sharp'),
  buffer: Buffer
): Promise<string> {
  // Downscale to 8x8 grayscale for perceptual hash
  const tiny = await sharpLib(buffer)
    .resize(8, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  // Compute average
  const pixels = Array.from(tiny);
  const avg = pixels.reduce((a, b) => a + b, 0) / pixels.length;

  // Build hash: 1 if pixel > average, 0 otherwise
  return pixels.map((p) => (p > avg ? '1' : '0')).join('');
}

function hammingDistance(a: string, b: string): number {
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

export function resetDedup(): void {
  previousHash = null;
}
