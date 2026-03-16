import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './windows/mainWindow';
import {
  createOverlayWindow,
  createSeparateWindow,
} from './windows/overlayWindow';
import { registerIpcHandlers } from './ipc/handlers';
import { getSettings } from './services/settingsService';
import { stopCapture } from './services/screenshotService';
import { stopDeathDetection } from './services/deathDetectionService';

let mainWindow: BrowserWindow | null = null;

function createWindows(): void {
  mainWindow = createMainWindow();

  const settings = getSettings();
  if (settings.displayMode === 'overlay') {
    createOverlayWindow();
  } else {
    createSeparateWindow();
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindows();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindows();
    }
  });
});

app.on('window-all-closed', () => {
  stopCapture();
  stopDeathDetection();
  app.quit();
});

app.on('before-quit', () => {
  stopCapture();
  stopDeathDetection();
});
