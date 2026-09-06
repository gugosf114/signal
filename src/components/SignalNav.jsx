import React from 'react';
import { SIGNAL_TYPES } from '../config/signals';
import HeatBar from './HeatBar';

export default function SignalNav({ signals }) {
  if (!signals || signals.length === 0) return null;

  const handleJump = (key) => {
    const el = document.getElementById('signal-' + key);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="fade-slide-up" style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 32,
      padding: '12px 16px',
      background: 'var(--signal-panel)',
      border: '1px solid #14161A',
      borderRadius: 3,
    }}>
      <span style={{
        fontSize: 8,
        fontFamily: "'Syne', sans-serif",
        fontWeight: 700,
        letterSpacing: '0.18em',
        color: 'var(--signal-text-secondary)',
        textTransform: 'uppercase',
        alignSelf: 'center',
        marginRight: 4,
        flexShrink: 0,
      }}>
        Jump to
      </span>
      {signals.map((signal) => {
        const meta = SIGNAL_TYPES[signal.key];
        if (!meta) return null;
        return (
          <button
            key={signal.key}
            className="signal-jump-button"
            onClick={() => handleJump(signal.key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              background: 'transparent',
              border: `1px solid ${meta.color}28`,
              borderRadius: 2,
              color: '#92897C',
              fontSize: 10,
              cursor: 'pointer',
              fontFamily: "'Syne', sans-serif",
              fontWeight: 500,
              letterSpacing: '0.02em',
              transition: 'all 0.1s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = meta.color + '60';
              e.currentTarget.style.color = '#E8E4DC';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = meta.color + '28';
              e.currentTarget.style.color = '#92897C';
            }}
          >
            {meta.label}
            <HeatBar level={signal.level} color={meta.color} />
          </button>
        );
      })}
    </div>
  );
}
