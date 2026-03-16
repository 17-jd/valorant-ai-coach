import React, { useState, useEffect, useCallback } from 'react';
import type { ElectronAPI } from '../../preload/preload';
import type {
  AppSettings,
  CaptureMode,
  OutputMode,
  DisplayMode,
  SessionStats,
} from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/types';

declare global {
  interface Window {
    api: ElectronAPI;
  }
}

const CAPTURE_MODES: { id: CaptureMode; name: string; cost: string }[] = [
  { id: 'every-5s', name: 'Every 5 seconds', cost: '~$1.30/hr — Real-time coaching' },
  { id: 'every-10s', name: 'Every 10 seconds', cost: '~$0.65/hr — Balanced (Recommended)' },
  { id: 'on-death-only', name: 'On death only', cost: '~$0.03/hr — Budget friendly' },
];

const OUTPUT_MODES: { id: OutputMode; label: string }[] = [
  { id: 'overlay', label: 'Overlay' },
  { id: 'tts', label: 'Voice (TTS)' },
  { id: 'both', label: 'Both' },
];

const DISPLAY_MODES: { id: DisplayMode; label: string }[] = [
  { id: 'overlay', label: 'Game Overlay' },
  { id: 'separate-window', label: 'Separate Window' },
];

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiTestResult, setApiTestResult] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    window.api.getSettings().then((s: AppSettings) => {
      setSettings(s);
      if (s.geminiApiKey) setApiKeyInput(s.geminiApiKey);
    });

    const unsubStatus = window.api.onCoachingStatus((s: string) => setStatus(s));
    const unsubCost = window.api.onCostUpdate((stats: unknown) =>
      setSessionStats(stats as SessionStats)
    );

    return () => {
      unsubStatus();
      unsubCost();
    };
  }, []);

  // Periodically fetch session stats while running
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(async () => {
      const stats = await window.api.getSessionStats();
      if (stats) setSessionStats(stats as SessionStats);
    }, 3000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const updateSetting = useCallback(
    async (partial: Partial<AppSettings>) => {
      const updated = await window.api.updateSettings(partial);
      setSettings(updated as AppSettings);
    },
    []
  );

  const handleTestApiKey = async () => {
    setApiTestResult('testing');
    const ok = await window.api.testApiKey(apiKeyInput);
    setApiTestResult(ok ? 'success' : 'error');
    if (ok) {
      updateSetting({ geminiApiKey: apiKeyInput });
    }
  };

  const handleStart = async () => {
    try {
      await window.api.startSession();
      setIsRunning(true);
    } catch (e) {
      alert(`Failed to start: ${e instanceof Error ? e.message : e}`);
    }
  };

  const handleStop = async () => {
    const stats = await window.api.stopSession();
    setIsRunning(false);
    if (stats) setSessionStats(stats as SessionStats);
  };

  const handleCalibrate = async () => {
    await window.api.startCalibration();
    alert('Calibration complete! HUD reference pixels saved.');
  };

  const budgetPercent = Math.min(
    (settings.totalSpent / settings.totalBudget) * 100,
    100
  );

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <h1>Valorant AI Coach</h1>
        <span className={`status-badge ${isRunning ? 'running' : 'idle'}`}>
          {isRunning ? `Active — ${status}` : 'Idle'}
        </span>
      </div>

      <div className="main-content">
        {/* Capture Mode */}
        <div className="card">
          <h2>Capture Mode</h2>
          <div className="mode-options">
            {CAPTURE_MODES.map((mode) => (
              <label
                key={mode.id}
                className={`mode-option ${settings.captureMode === mode.id ? 'active' : ''}`}
              >
                <input
                  type="radio"
                  name="captureMode"
                  checked={settings.captureMode === mode.id}
                  onChange={() => updateSetting({ captureMode: mode.id })}
                  disabled={isRunning}
                />
                <div className="mode-label">
                  <div className="name">{mode.name}</div>
                  <div className="cost">{mode.cost}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Output Mode */}
        <div className="card">
          <h2>Output Mode</h2>
          <div className="toggle-group">
            {OUTPUT_MODES.map((mode) => (
              <button
                key={mode.id}
                className={`toggle-btn ${settings.outputMode === mode.id ? 'active' : ''}`}
                onClick={() => updateSetting({ outputMode: mode.id })}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <h2 style={{ marginTop: 20 }}>Display Mode</h2>
          <div className="display-toggle">
            {DISPLAY_MODES.map((mode) => (
              <button
                key={mode.id}
                className={`toggle-btn ${settings.displayMode === mode.id ? 'active' : ''}`}
                onClick={() => updateSetting({ displayMode: mode.id })}
                disabled={isRunning}
              >
                {mode.label}
              </button>
            ))}
          </div>
          {settings.displayMode === 'overlay' && (
            <p style={{ fontSize: 12, color: '#768b9e', marginTop: 8 }}>
              Requires Valorant in Borderless Windowed mode
            </p>
          )}
        </div>

        {/* API Key */}
        <div className="card">
          <h2>Gemini API Key</h2>
          <div className="api-key-input">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Enter your Gemini API key"
            />
            <button className="btn btn-secondary" onClick={handleTestApiKey}>
              {apiTestResult === 'testing' ? '...' : 'Test'}
            </button>
          </div>
          {apiTestResult === 'success' && (
            <div className="test-status success">Connected successfully</div>
          )}
          {apiTestResult === 'error' && (
            <div className="test-status error">Invalid API key</div>
          )}
        </div>

        {/* Overlay Settings */}
        <div className="card">
          <h2>Overlay Settings</h2>
          <div className="slider-group">
            <label>
              <span>Font Size</span>
              <span>{settings.overlay.fontSize}px</span>
            </label>
            <input
              type="range"
              min="12"
              max="32"
              value={settings.overlay.fontSize}
              onChange={(e) =>
                updateSetting({
                  overlay: { ...settings.overlay, fontSize: +e.target.value },
                })
              }
            />
          </div>
          <div className="slider-group">
            <label>
              <span>Opacity</span>
              <span>{Math.round(settings.overlay.opacity * 100)}%</span>
            </label>
            <input
              type="range"
              min="30"
              max="100"
              value={settings.overlay.opacity * 100}
              onChange={(e) =>
                updateSetting({
                  overlay: { ...settings.overlay, opacity: +e.target.value / 100 },
                })
              }
            />
          </div>
          <div className="slider-group">
            <label>
              <span>Position Y</span>
              <span>{settings.overlay.y}%</span>
            </label>
            <input
              type="range"
              min="5"
              max="95"
              value={settings.overlay.y}
              onChange={(e) =>
                updateSetting({
                  overlay: { ...settings.overlay, y: +e.target.value },
                })
              }
            />
          </div>
          <div className="color-row">
            <label>Text Color</label>
            <input
              type="color"
              value={settings.overlay.color}
              onChange={(e) =>
                updateSetting({
                  overlay: { ...settings.overlay, color: e.target.value },
                })
              }
            />
            <label>Background</label>
            <input
              type="color"
              value={settings.overlay.backgroundColor}
              onChange={(e) =>
                updateSetting({
                  overlay: { ...settings.overlay, backgroundColor: e.target.value },
                })
              }
            />
          </div>
        </div>

        {/* Cost Dashboard */}
        <div className="card full-width">
          <h2>Cost Dashboard</h2>
          <div className="cost-grid">
            <div className="cost-stat">
              <div className="value">
                ${(sessionStats?.estimatedCost ?? 0).toFixed(4)}
              </div>
              <div className="label">This Session</div>
            </div>
            <div className="cost-stat">
              <div className="value">${settings.totalSpent.toFixed(2)}</div>
              <div className="label">Total Spent</div>
            </div>
            <div className="cost-stat">
              <div className="value">
                ${(settings.totalBudget - settings.totalSpent).toFixed(2)}
              </div>
              <div className="label">Budget Left</div>
            </div>
          </div>
          <div className="budget-bar">
            <div className="fill" style={{ width: `${budgetPercent}%` }} />
          </div>
          <div className="budget-label">
            <span>${settings.totalSpent.toFixed(2)} used</span>
            <span>${settings.totalBudget.toFixed(2)} budget</span>
          </div>
          {sessionStats && (
            <div
              className="cost-grid"
              style={{ marginTop: 12 }}
            >
              <div className="cost-stat">
                <div className="value">{sessionStats.apiCalls}</div>
                <div className="label">API Calls</div>
              </div>
              <div className="cost-stat">
                <div className="value">{sessionStats.screenshotsCaptured}</div>
                <div className="label">Screenshots</div>
              </div>
              <div className="cost-stat">
                <div className="value">{sessionStats.screenshotsSkipped}</div>
                <div className="label">Deduped</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer with Start/Stop */}
      <div className="footer">
        <button
          className="btn btn-secondary btn-calibrate"
          onClick={handleCalibrate}
          disabled={isRunning}
        >
          Calibrate HUD
        </button>
        {isRunning ? (
          <button className="btn btn-primary btn-start" onClick={handleStop}>
            Stop Coaching
          </button>
        ) : (
          <button
            className="btn btn-success btn-start"
            onClick={handleStart}
            disabled={!settings.geminiApiKey}
          >
            Start Coaching
          </button>
        )}
      </div>
    </div>
  );
}
