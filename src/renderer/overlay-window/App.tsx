import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ElectronAPI } from '../../preload/preload';
import type { CoachingTip, OverlaySettings } from '../../shared/types';

declare global {
  interface Window {
    api: ElectronAPI;
  }
}

const DEFAULT_OVERLAY: OverlaySettings = {
  x: 50,
  y: 85,
  fontSize: 18,
  opacity: 0.85,
  color: '#ffffff',
  backgroundColor: '#000000',
};

export default function App() {
  const [tips, setTips] = useState<CoachingTip[]>([]);
  const [currentTip, setCurrentTip] = useState<CoachingTip | null>(null);
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>(DEFAULT_OVERLAY);
  const [isSeparateMode, setIsSeparateMode] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // Cancel current speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.15;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    // Check if we're in separate window mode (window has a frame/title)
    // The separate window will have a smaller initial size
    if (window.innerWidth < 500) {
      setIsSeparateMode(true);
    }

    // Load initial settings
    window.api.getSettings().then((s: { overlay: OverlaySettings; outputMode: string; displayMode: string }) => {
      setOverlaySettings(s.overlay);
      setIsSeparateMode(s.displayMode === 'separate-window');
    });

    const unsubTip = window.api.onCoachingTip((tip: unknown) => {
      const coachingTip = tip as CoachingTip;
      setCurrentTip(coachingTip);
      setTips((prev) => [coachingTip, ...prev].slice(0, 20)); // Keep last 20

      // TTS
      window.api.getSettings().then((s: { outputMode: string }) => {
        if (s.outputMode === 'tts' || s.outputMode === 'both') {
          speak(coachingTip.text);
        }
      });

      // Auto-fade after 7 seconds (overlay mode only)
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(() => {
        setCurrentTip(null);
      }, 7000);
    });

    const unsubOverlay = window.api.onOverlayUpdate((settings: unknown) => {
      setOverlaySettings(settings as OverlaySettings);
    });

    return () => {
      unsubTip();
      unsubOverlay();
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [speak]);

  const tipStyle: React.CSSProperties = {
    top: `${overlaySettings.y}%`,
    fontSize: `${overlaySettings.fontSize}px`,
    color: overlaySettings.color,
    backgroundColor: hexToRgba(overlaySettings.backgroundColor, overlaySettings.opacity),
  };

  // Separate window mode — show tip history
  if (isSeparateMode) {
    return (
      <div className="overlay-container separate-mode">
        <div className="tip-history">
          {tips.length === 0 && (
            <div
              className="coaching-tip visible"
              style={{
                ...tipStyle,
                position: 'relative',
                left: 'auto',
                transform: 'none',
              }}
            >
              Waiting for coaching tips...
            </div>
          )}
          {tips.map((tip, i) => (
            <div
              key={tip.id}
              className={`coaching-tip visible ${i > 0 ? 'old' : ''} ${tip.isDeathAnalysis ? 'death-tip' : ''}`}
              style={{
                ...tipStyle,
                position: 'relative',
                left: 'auto',
                transform: 'none',
                opacity: i === 0 ? 1 : 0.5,
              }}
            >
              {tip.text}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Overlay mode — show current tip only
  return (
    <div className="overlay-container">
      {currentTip && (
        <div
          className={`coaching-tip visible ${currentTip.isDeathAnalysis ? 'death-tip' : ''}`}
          style={tipStyle}
        >
          {currentTip.text}
        </div>
      )}
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
