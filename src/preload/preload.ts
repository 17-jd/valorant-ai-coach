import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../main/ipc/channels';

const api = {
  // Settings
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  updateSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTINGS, settings),

  // Session control
  startSession: () => ipcRenderer.invoke(IPC_CHANNELS.START_SESSION),
  stopSession: () => ipcRenderer.invoke(IPC_CHANNELS.STOP_SESSION),
  getSessionStats: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SESSION_STATS),

  // API key test
  testApiKey: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.TEST_API_KEY, key),

  // Calibration
  startCalibration: () => ipcRenderer.invoke(IPC_CHANNELS.CALIBRATE_START),

  // Debug
  testCapture: () => ipcRenderer.invoke(IPC_CHANNELS.TEST_CAPTURE),

  // Event listeners
  onCoachingTip: (callback: (tip: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, tip: unknown) => callback(tip);
    ipcRenderer.on(IPC_CHANNELS.COACHING_TIP, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.COACHING_TIP, handler);
  },

  onCoachingStatus: (callback: (status: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: string) => callback(status);
    ipcRenderer.on(IPC_CHANNELS.COACHING_STATUS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.COACHING_STATUS, handler);
  },

  onCostUpdate: (callback: (stats: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, stats: unknown) => callback(stats);
    ipcRenderer.on(IPC_CHANNELS.COST_UPDATE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.COST_UPDATE, handler);
  },

  onDeathDetected: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.DEATH_DETECTED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DEATH_DETECTED, handler);
  },

  onOverlayUpdate: (callback: (settings: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, settings: unknown) => callback(settings);
    ipcRenderer.on(IPC_CHANNELS.UPDATE_OVERLAY, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATE_OVERLAY, handler);
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronAPI = typeof api;
