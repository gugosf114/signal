import React, { useState, useEffect } from 'react';
import { GAME_LABELS } from '../config/signals';

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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 8 }}>
      {scans.map((s, i) => {
        const gameMeta = GAME_LABELS[s.game];
        return (
          <button
            key={i}
            onClick={() => !loading && onSelect(s.name, s.game)}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              background: 'transparent',
              border: '1px solid #1A1D24',
              borderRadius: 2,
              color: '#3A3830',
              fontSize: 10,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
              transition: 'all 0.12s',
              whiteSpace: 'nowrap',
              opacity: loading ? 0.3 : 1,
              letterSpacing: '0.02em',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = (gameMeta?.color || '#6B6860') + '50';
                e.currentTarget.style.color = '#6B6860';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#1A1D24';
              e.currentTarget.style.color = '#3A3830';
            }}
          >
            <span style={{ color: gameMeta?.color || '#6B6860', fontWeight: 700 }}>
              {s.score}
            </span>
            <span>{s.name}</span>
          </button>
        );
      })}
    </div>
  );
}
