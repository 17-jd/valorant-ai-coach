import {
  COST_PER_MILLION_INPUT_TOKENS,
  COST_PER_MILLION_OUTPUT_TOKENS,
} from '../../shared/constants';
import { SessionStats } from '../../shared/types';
import { addCost } from './settingsService';

let currentSession: SessionStats | null = null;

export function startSession(): SessionStats {
  currentSession = {
    apiCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    estimatedCost: 0,
    startTime: Date.now(),
    screenshotsCaptured: 0,
    screenshotsSkipped: 0,
  };
  return currentSession;
}

export function stopSession(): SessionStats | null {
  const session = currentSession;
  currentSession = null;
  return session;
}

export function getSessionStats(): SessionStats | null {
  return currentSession;
}

export function recordApiCall(inputTokens: number, outputTokens: number): void {
  if (!currentSession) return;

  currentSession.apiCalls++;
  currentSession.totalInputTokens += inputTokens;
  currentSession.totalOutputTokens += outputTokens;

  const inputCost = (inputTokens / 1_000_000) * COST_PER_MILLION_INPUT_TOKENS;
  const outputCost = (outputTokens / 1_000_000) * COST_PER_MILLION_OUTPUT_TOKENS;
  const callCost = inputCost + outputCost;

  currentSession.estimatedCost += callCost;
  addCost(callCost);
}

export function recordScreenshot(wasDeduplicated: boolean): void {
  if (!currentSession) return;
  currentSession.screenshotsCaptured++;
  if (wasDeduplicated) {
    currentSession.screenshotsSkipped++;
  }
}
