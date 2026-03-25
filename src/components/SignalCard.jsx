import React, { useState } from 'react';
import HeatBar from './HeatBar';
import { SIGNAL_TYPES } from '../config/signals';

const styles = {
  card: {
    background: '#111115',
    border: '1px solid #1E1E24',
    borderRadius: 10,
    padding: '14px 16px',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
    flexShrink: 0,
  },
  labelGroup: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: '#E0E0E0',
    lineHeight: 1.2,
  },
  preview: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  heatWrap: {
    flexShrink: 0,
  },
  chevron: {
    fontSize: 12,
    color: '#555',
    transition: 'transform 0.2s',
    marginLeft: 8,
    flexShrink: 0,
  },
  evidence: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: '1px solid #1E1E24',
    fontSize: 13,
    color: '#999',
    lineHeight: 1.6,
  },
  evidenceLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 6,
    fontFamily: "'JetBrains Mono', monospace",
  },
};

export default function SignalCard({ signal, animDelay = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const meta = SIGNAL_TYPES[signal.key];
  if (!meta) return null;

  const previewText = signal.detail
    ? signal.detail.substring(0, 60) + (signal.detail.length > 60 ? '...' : '')
    : meta.description;

  return (
    <div
      className={`fade-slide-up fade-slide-up-${animDelay}`}
      style={{
        ...styles.card,
        borderColor: expanded ? meta.color + '40' : '#1E1E24',
      }}
      onClick={() => setExpanded(!expanded)}
      onMouseEnter={(e) => {
        if (!expanded) e.currentTarget.style.borderColor = '#2A2A30';
      }}
      onMouseLeave={(e) => {
        if (!expanded) e.currentTarget.style.borderColor = '#1E1E24';
      }}
    >
      <div style={styles.header}>
        <span style={styles.icon}>{meta.icon}</span>
        <div style={styles.labelGroup}>
          <div style={styles.label}>{meta.label}</div>
          {!expanded && <div style={styles.preview}>{previewText}</div>}
        </div>
        <div style={styles.heatWrap}>
          <HeatBar level={signal.level} color={meta.color} />
        </div>
        <span
          style={{
            ...styles.chevron,
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          ▶
        </span>
      </div>

      <div className={`signal-evidence ${expanded ? 'expanded' : ''}`}>
        <div>
          {expanded && (
            <div style={styles.evidence}>
              <div style={styles.evidenceLabel}>Evidence</div>
              {signal.detail || meta.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
