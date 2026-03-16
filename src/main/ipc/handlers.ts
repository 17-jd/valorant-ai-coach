import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from './channels';
import { getSettings, updateSettings } from '../services/settingsService';
import { initializeGemini, testApiKey } from '../services/geminiService';
import { startCapture, stopCapture } from '../services/screenshotService';
import { startDeathDetection, stopDeathDetection, calibrate } from '../services/deathDetectionService';
import * as costTracking from '../services/costTrackingService';
import { getDisplayWindow } from '../windows/overlayWindow';
import { getMainWindow } from '../windows/mainWindow';
import { AppSettings } from '../../shared/types';

export function registerIpcHandlers(): void {
  // Settings
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => {
    return getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_SETTINGS, (_event, partial: Partial<AppSettings>) => {
    const updated = updateSettings(partial);

    // If API key changed, reinitialize Gemini
    if (partial.geminiApiKey) {
      initializeGemini(partial.geminiApiKey);
    }

    // Forward overlay settings to display window
    if (partial.overlay || partial.displayMode) {
      const displayWindow = getDisplayWindow();
      displayWindow?.webContents.send(IPC_CHANNELS.UPDATE_OVERLAY, updated.overlay);
    }

    return updated;
  });

  // Test API key
  ipcMain.handle(IPC_CHANNELS.TEST_API_KEY, async (_event, key: string) => {
    return testApiKey(key);
  });

  // Session control
  ipcMain.handle(IPC_CHANNELS.START_SESSION, () => {
    const settings = getSettings();

    if (!settings.geminiApiKey) {
      throw new Error('API key not set');
    }

    initializeGemini(settings.geminiApiKey);
    const stats = costTracking.startSession();
    const displayWindow = getDisplayWindow();

    if (settings.captureMode === 'on-death-only') {
      startDeathDetection(displayWindow);
    } else {
      startCapture(settings.captureMode, displayWindow);
    }

    return stats;
  });

  ipcMain.handle(IPC_CHANNELS.STOP_SESSION, () => {
    stopCapture();
    stopDeathDetection();
    const stats = costTracking.stopSession();

    // Send final cost update to main window
    const mainWindow = getMainWindow();
    if (mainWindow && stats) {
      mainWindow.webContents.send(IPC_CHANNELS.COST_UPDATE, stats);
    }

    return stats;
  });

  ipcMain.handle(IPC_CHANNELS.GET_SESSION_STATS, () => {
    return costTracking.getSessionStats();
  });

  // Calibration
  ipcMain.handle(IPC_CHANNELS.CALIBRATE_START, async () => {
    await calibrate();
    return true;
  });
}
