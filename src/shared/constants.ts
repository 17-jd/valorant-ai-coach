export const CAPTURE_INTERVALS: Record<string, number> = {
  'every-5s': 5000,
  'every-10s': 10000,
  'on-death-only': 1500, // death detection polling interval
};

export const GEMINI_MODEL = 'gemini-2.5-flash';

// Cost per million tokens (USD) for Gemini 2.5 Flash
export const COST_PER_MILLION_INPUT_TOKENS = 0.30;
export const COST_PER_MILLION_OUTPUT_TOKENS = 2.50;

// Image processing
export const TARGET_WIDTH = 1280;
export const TARGET_HEIGHT = 720;
export const JPEG_QUALITY = 65;

// Death detection
export const DEATH_DEBOUNCE_MS = 8000;
export const SATURATION_THRESHOLD = 0.15;
export const DEATH_SIGNALS_REQUIRED = 2;

// Conversation history
export const MAX_HISTORY_LENGTH = 3;
