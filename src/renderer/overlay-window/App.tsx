import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ElectronAPI } from '../../preload/preload';
import type { CoachingTip } from '../../shared/types';

declare global {
  interface Window {
    api: ElectronAPI;
  }
}

export default function App() {
  const [tips, setTips] = useState<CoachingTip[]>([]);
  const [status, setStatus] = useState('Waiting to start...');
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.88;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    const unsubTip = window.api.onCoachingTip((tip: unknown) => {
      const coachingTip = tip as CoachingTip;
      setTips((prev) => [coachingTip, ...prev].slice(0, 20));
      speak(coachingTip.text);
      setStatus('Tip received');

      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(() => setStatus('Listening...'), 8000);
    });

    const unsubStatus = window.api.onCoachingStatus((s: string) => {
      setStatus(s);
    });

    const unsubDeath = window.api.onDeathDetected(() => {
      setStatus('Death detected — analyzing...');
    });

    return () => {
      unsubTip();
      unsubStatus();
      unsubDeath();
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [speak]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>AI COACH</span>
        <span style={styles.status}>{status}</span>
      </div>

      <div style={styles.tipList}>
        {tips.length === 0 && (
          <div style={styles.empty}>Waiting for coaching tips...</div>
        )}
        {tips.map((tip, i) => (
          <div
            key={tip.id}
            style={{
              ...styles.tip,
              ...(tip.isDeathAnalysis ? styles.deathTip : {}),
              opacity: i === 0 ? 1 : 0.45,
              fontSize: i === 0 ? 13 : 12,
            }}
          >
            {tip.isDeathAnalysis && <span style={styles.deathBadge}>DEATH</span>}
            {tip.text}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#0f1923',
    color: '#fff',
    fontFamily: 'Segoe UI, sans-serif',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: '#ff4655',
    flexShrink: 0,
  },
  title: {
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: 2,
  },
  status: {
    fontSize: 11,
    opacity: 0.9,
    textTransform: 'capitalize',
  },
  tipList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  tip: {
    background: '#1a2634',
    borderLeft: '3px solid #768b9e',
    padding: '8px 10px',
    borderRadius: 4,
    lineHeight: 1.5,
    whiteSpace: 'pre-line',
  },
  deathTip: {
    borderLeft: '3px solid #ff4655',
    background: '#1f1418',
  },
  deathBadge: {
    display: 'inline-block',
    background: '#ff4655',
    color: '#fff',
    fontSize: 9,
    fontWeight: 700,
    padding: '1px 5px',
    borderRadius: 2,
    marginRight: 6,
    letterSpacing: 1,
  },
  empty: {
    color: '#768b9e',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
  },
};
