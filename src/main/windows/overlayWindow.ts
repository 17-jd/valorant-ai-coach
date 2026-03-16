import { BrowserWindow, screen } from 'electron';
import path from 'path';

let overlayWindow: BrowserWindow | null = null;
let separateWindow: BrowserWindow | null = null;

export function createOverlayWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
    show: false,
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  if (process.env.NODE_ENV === 'development') {
    overlayWindow.loadURL('http://localhost:5174');
  } else {
    overlayWindow.loadFile(
      path.join(__dirname, '../../../renderer/overlay-window/index.html')
    );
  }

  overlayWindow.once('ready-to-show', () => {
    overlayWindow?.show();
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  return overlayWindow;
}

export function createSeparateWindow(): BrowserWindow {
  separateWindow = new BrowserWindow({
    width: 400,
    height: 300,
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

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow;
}

export function getSeparateWindow(): BrowserWindow | null {
  return separateWindow;
}

export function getDisplayWindow(): BrowserWindow | null {
  return overlayWindow || separateWindow;
}
