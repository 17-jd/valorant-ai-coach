import { ipcMain } from 'electron';
import { IPC_CHANNELS } from './channels';
import { getSettings, updateSettings } from '../services/settingsService';
import { initializeGemini, testApiKey, clearSessionContext, analyzeScreenshot } from '../services/geminiService';
import { startCapture, stopCapture, captureScreen } from '../services/screenshotService';
import { startDeathDetection, stopDeathDetection, calibrate } from '../services/deathDetectionService';
import { compressScreenshot } from '../services/imageProcessingService';
import * as costTracking from '../services/costTrackingService';
import { getDisplayWindow } from '../windows/overlayWindow';
import { getMainWindow } from '../windows/mainWindow';
import { AppSettings } from '../../shared/types';

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => {
    return getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_SETTINGS, (_event, partial: Partial<AppSettings>) => {
    const updated = updateSettings(partial);
    if (partial.geminiApiKey) {
      initializeGemini(partial.geminiApiKey);
    }
    return updated;
  });

  ipcMain.handle(IPC_CHANNELS.TEST_API_KEY, async (_event, key: string) => {
    return testApiKey(key);
  });

  ipcMain.handle(IPC_CHANNELS.START_SESSION, () => {
    const settings = getSettings();
    if (!settings.geminiApiKey) throw new Error('API key not set');

    initializeGemini(settings.geminiApiKey);
    clearSessionContext();
    const stats = costTracking.startSession();
    const displayWindow = getDisplayWindow();

    // Always start death detection + rolling buffer
    startDeathDetection(displayWindow);
    startCapture(settings.captureMode, displayWindow);

    return stats;
  });

  ipcMain.handle(IPC_CHANNELS.STOP_SESSION, () => {
    stopCapture();
    stopDeathDetection();
    const stats = costTracking.stopSession();
    const mainWindow = getMainWindow();
    if (mainWindow && stats) {
      mainWindow.webContents.send(IPC_CHANNELS.COST_UPDATE, stats);
    }
    return stats;
  });

  ipcMain.handle(IPC_CHANNELS.GET_SESSION_STATS, () => {
    return costTracking.getSessionStats();
  });

  ipcMain.handle(IPC_CHANNELS.CALIBRATE_START, async () => {
    await calibrate();
    return true;
  });

  // Test capture pipeline — takes one screenshot, sends to Gemini, returns tip text
  ipcMain.handle(IPC_CHANNELS.TEST_CAPTURE, async () => {
    const settings = getSettings();
    if (!settings.geminiApiKey) return { ok: false, error: 'No API key set' };
    try {
      initializeGemini(settings.geminiApiKey);
      const buffer = await captureScreen();
      const { base64 } = await compressScreenshot(buffer);
      const tip = await analyzeScreenshot(base64, false);
      const displayWindow = getDisplayWindow();
      displayWindow?.webContents.send(IPC_CHANNELS.COACHING_TIP, tip);
      return { ok: true, tip: tip.text };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
}
