import React, { useState, useEffect } from 'react';
import { GAME_LABELS, SCORE_VERSION, calculateOverallScore } from '../config/signals';
import { getCachedScan } from '../services/scanCache';
import { recentPrintingLine, sanitizeRecentScans } from '../services/recentScans';

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
        const list = sanitizeRecentScans(parsed);
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

      <div
        aria-label="Recent scans. Scroll for older scans."
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 4,
          maxHeight: 140,
          overflowY: 'auto',
          paddingRight: 3,
          scrollbarWidth: 'thin',
        }}
      >
        {scans.map((s, i) => {
          const gameMeta = GAME_LABELS[s.game];
          const color = gameMeta?.color || '#A8A498';
          const printing = recentPrintingLine(s);
          return (
            <button
              key={`${s.game}:${s.pin?.printingId || s.pin?.id || s.name}:${i}`}
              title={[s.name, printing].filter(Boolean).join(' — ')}
              aria-label={`Open recent scan: ${[s.name, printing].filter(Boolean).join(' — ')}`}
              onClick={() => !loading && onSelect(s.name, s.game, { pin: s.pin || null })}
              disabled={loading}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 72px',
                alignItems: 'center',
                gap: 9,
                width: '100%',
                minWidth: 0,
                minHeight: 44,
                padding: '5px 10px 5px 12px',
                background: 'transparent',
                border: 'none',
                borderRight: `2px solid ${color}40`,
                color: '#A8A498',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.3 : 1,
                transition: 'all 0.15s',
                textAlign: 'right',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.borderRightColor = color;
                  e.currentTarget.style.color = '#C8C4BC';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderRightColor = color + '40';
                e.currentTarget.style.color = '#A8A498';
              }}
            >
              <span style={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'right',
                fontFamily: "'Instrument Serif', serif",
                fontStyle: 'italic',
                fontSize: 15,
                lineHeight: 1.2,
              }}>
                {s.name}
                {printing && (
                  <small style={{
                    marginLeft: 7,
                    color: '#706C64',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 8,
                    fontStyle: 'normal',
                    letterSpacing: '0.02em',
                  }}>· {printing}</small>
                )}
              </span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 14,
                fontWeight: 700,
                color: color,
                textAlign: 'right',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
              }}>
                {s.score}/100
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
