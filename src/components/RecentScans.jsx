import React, { useState, useEffect, useRef } from 'react';
import { GAME_LABELS, SCORE_VERSION, calculateOverallScore } from '../config/signals';
import { getCachedScan } from '../services/scanCache';
import { recentPrintingLine, sanitizeRecentScans } from '../services/recentScans';
import GameMark from './GameMark';

// Distinct from QuickPicks: this is YOUR trace through the app.
// Visual cue: hairline divider + label, then log-style rows
// (left-border accent, monospace score, italic name) instead of pill chips.
export default function RecentScans({ onSelect, loading }) {
  const [scans, setScans] = useState([]);
  const [showFade, setShowFade] = useState(false);
  const listRef = useRef(null);

  const updateFade = () => {
    const list = listRef.current;
    if (!list) return;
    setShowFade(list.scrollTop + list.clientHeight < list.scrollHeight - 1);
  };

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

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
    const frame = requestAnimationFrame(updateFade);
    return () => cancelAnimationFrame(frame);
  }, [scans]);

  if (scans.length === 0) return null;
  return (
    <div className="recent-scans-panel" style={{
      width: '100%',
      marginTop: 18,
      border: '0.5px solid #FFFFFF',
      borderRadius: 4,
      padding: '14px 16px 12px',
      background: 'var(--signal-panel)',
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

      <div style={{ position: 'relative' }}>
        <div
          ref={listRef}
          onScroll={updateFade}
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
                gridTemplateColumns: '72px minmax(0, 1.25fr) minmax(0, 0.75fr)',
                alignItems: 'center',
                gap: 9,
                width: '100%',
                minWidth: 0,
                minHeight: 44,
                padding: '5px 10px 5px 12px',
                background: 'var(--signal-tile)',
                border: 'none',
                borderLeft: `2px solid ${color}40`,
                color: '#A8A498',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.3 : 1,
                transition: 'all 0.15s',
                textAlign: 'left',
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
                textAlign: 'left',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
              }}>
                {s.score}/100
              </span>
              <span style={{
                minWidth: 0,
                overflow: 'hidden',
                textAlign: 'left',
                fontFamily: "'Instrument Serif', serif",
                fontStyle: 'italic',
                fontSize: 15,
                lineHeight: 1.2,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}>
                <GameMark game={s.game} compact />
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              </span>
              <small style={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: '#706C64',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8,
                fontStyle: 'normal',
                letterSpacing: '0.02em',
                textAlign: 'left',
              }}>{printing ? `· ${printing}` : ''}</small>
            </button>
          );
          })}
        </div>
        {showFade && <div className="compact-scroll-fade" aria-hidden />}
      </div>
    </div>
  );
}
