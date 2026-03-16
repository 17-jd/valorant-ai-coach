import { BrowserWindow } from 'electron';
import path from 'path';

let separateWindow: BrowserWindow | null = null;

export function createSeparateWindow(): BrowserWindow {
  separateWindow = new BrowserWindow({
    width: 420,
    height: 320,
    title: 'Valorant AI Coach - Tips',
    alwaysOnTop: true,
    frame: true,
    transparent: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      sandbox: false,
    },
    show: false,
  });

  if (process.env.NODE_ENV === 'development') {
    separateWindow.loadURL('http://localhost:5174');
  } else {
    separateWindow.loadFile(
      path.join(__dirname, '../../../renderer/overlay-window/index.html')
    );
  }

  separateWindow.once('ready-to-show', () => {
    separateWindow?.show();
  });

  separateWindow.on('closed', () => {
    separateWindow = null;
  });

  return separateWindow;
}

export function getDisplayWindow(): BrowserWindow | null {
  return separateWindow;
}
