import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { AppSettings, DEFAULT_SETTINGS } from '../../shared/types';

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

function readSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      return { ...DEFAULT_SETTINGS, ...data };
    }
  } catch {
    // Corrupted file, use defaults
  }
  return { ...DEFAULT_SETTINGS };
}

function writeSettings(settings: AppSettings): void {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

export function getSettings(): AppSettings {
  return readSettings();
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = readSettings();
  const updated = { ...current, ...partial };
  writeSettings(updated);
  return updated;
}

export function addCost(amount: number): void {
  const settings = readSettings();
  settings.totalSpent += amount;
  writeSettings(settings);
}

export function resetCost(): void {
  const settings = readSettings();
  settings.totalSpent = 0;
  writeSettings(settings);
}
