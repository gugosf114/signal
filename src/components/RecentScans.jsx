import React, { useState, useEffect } from 'react';
import { GAME_LABELS, SCORE_VERSION, calculateOverallScore } from '../config/signals';
import { getCachedScan } from '../services/scanCache';

// Distinct from QuickPicks: this is YOUR trace through the app.
// Visual cue: hairline divider + label, then log-style rows
// (left-border accent, monospace score, italic name) instead of pill chips.
export default function RecentScans({ onSelect, loading }) {
  const [scans, setScans] = useState([]);

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem('signal_recent_scans');
        const parsed = raw ? JSON.parse(raw) : [];
        const list = Array.isArray(parsed) ? parsed : [];
        const migrated = list.map((item) => {
          if (item?.scoreVersion === SCORE_VERSION && Number.isFinite(item.score)) return item;
          const cached = getCachedScan(item?.name, item?.game, item?.pin || null);
          if (!cached?.signals) return null;
          return {
            ...item,
            score: calculateOverallScore(cached.signals, item.game),
            scoreVersion: SCORE_VERSION,
          };
        }).filter(Boolean).slice(0, 8);
        setScans(migrated);
        localStorage.setItem('signal_recent_scans', JSON.stringify(migrated));
      } catch { setScans([]); }
    };
    load();
    window.addEventListener('signal-history-updated', load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener('signal-history-updated', load);
      window.removeEventListener('storage', load);
    };
  }, []);

  if (scans.length === 0) return null;

  return (
    <div style={{
      width: '100%',
      marginTop: 18,
      border: '1px solid #2A2D34',
      borderRadius: 4,
      padding: '14px 16px 12px',
      background: 'rgba(20, 22, 26, 0.35)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          flex: 1,
          height: 1,
          background: 'linear-gradient(90deg, transparent, #1A1D24 70%)',
        }} />
        <span style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: '#7A7368',
          whiteSpace: 'nowrap',
        }}>
          Your last scans
        </span>
        <div style={{
          flex: 1,
          height: 1,
          background: 'linear-gradient(270deg, transparent, #1A1D24 70%)',
        }} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
        {scans.map((s, i) => {
          const gameMeta = GAME_LABELS[s.game];
          const color = gameMeta?.color || '#A8A498';
          return (
            <button
              key={`${s.game}:${s.pin?.printingId || s.pin?.id || s.name}:${i}`}
              onClick={() => !loading && onSelect(s.name, s.game, { pin: s.pin || null })}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 9,
                padding: '4px 12px 4px 10px',
                background: 'transparent',
                border: 'none',
                borderLeft: `2px solid ${color}40`,
                color: '#A8A498',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.3 : 1,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.borderLeftColor = color;
                  e.currentTarget.style.color = '#C8C4BC';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderLeftColor = color + '40';
                e.currentTarget.style.color = '#A8A498';
              }}
            >
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 14,
                fontWeight: 700,
                color: color,
                minWidth: 18,
                textAlign: 'right',
                letterSpacing: '0.02em',
              }}>
                {s.score}
              </span>
              <span style={{
                fontFamily: "'Instrument Serif', serif",
                fontStyle: 'italic',
                fontSize: 15,
                lineHeight: 1,
              }}>
                {s.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
