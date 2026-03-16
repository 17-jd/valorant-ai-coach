export type CaptureMode = 'every-5s' | 'every-10s' | 'on-death-only';

export type OutputMode = 'overlay' | 'tts' | 'both';

export type DisplayMode = 'overlay' | 'separate-window';

export interface OverlaySettings {
  x: number;
  y: number;
  fontSize: number;
  opacity: number;
  color: string;
  backgroundColor: string;
}

export interface AppSettings {
  captureMode: CaptureMode;
  outputMode: OutputMode;
  displayMode: DisplayMode;
  overlay: OverlaySettings;
  geminiApiKey: string;
  totalBudget: number;
  totalSpent: number;
}

export interface CoachingTip {
  id: string;
  text: string;
  timestamp: number;
  isDeathAnalysis: boolean;
}

export interface SessionStats {
  apiCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  startTime: number;
  screenshotsCaptured: number;
  screenshotsSkipped: number;
}

export interface CaptureResult {
  buffer: Buffer;
  base64: string;
  timestamp: number;
  wasDeduplicated: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  captureMode: 'every-10s',
  outputMode: 'both',
  displayMode: 'overlay',
  overlay: {
    x: 50,
    y: 85,
    fontSize: 18,
    opacity: 0.85,
    color: '#ffffff',
    backgroundColor: '#000000',
  },
  geminiApiKey: '',
  totalBudget: 300,
  totalSpent: 0,
};
