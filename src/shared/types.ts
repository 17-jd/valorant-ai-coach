export type CaptureMode = 'every-5s' | 'every-10s' | 'on-death-only';

export interface AppSettings {
  captureMode: CaptureMode;
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
  geminiApiKey: '',
  totalBudget: 300,
  totalSpent: 0,
};
