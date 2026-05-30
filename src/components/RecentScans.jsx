import React, { useState, useEffect } from 'react';
import { GAME_LABELS } from '../config/signals';

// Distinct from QuickPicks: this is YOUR trace through the app.
// Visual cue: hairline divider + label, then log-style rows
// (left-border accent, monospace score, italic name) instead of pill chips.
export default function RecentScans({ onSelect, loading }) {
  const [scans, setScans] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('signal_recent_scans');
      if (raw) setScans(JSON.parse(raw));
    } catch {}
  }, []);

  if (scans.length === 0) return null;

  return (
    <div style={{ width: '100%', marginTop: 18 }}>
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
          color: '#4A4840',
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
          const color = gameMeta?.color || '#6B6860';
          return (
            <button
              key={i}
              onClick={() => !loading && onSelect(s.name, s.game)}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 9,
                padding: '4px 12px 4px 10px',
                background: 'transparent',
                border: 'none',
                borderLeft: `2px solid ${color}40`,
                color: '#6B6860',
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
                e.currentTarget.style.color = '#6B6860';
              }}
            >
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
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
                fontSize: 14,
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
