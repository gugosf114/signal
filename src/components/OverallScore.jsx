import React from 'react';
import { getScoreLabel } from '../config/signals';

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    padding: '20px 24px',
    background: '#111115',
    border: '1px solid #1E1E24',
    borderRadius: 12,
    marginBottom: 24,
  },
  scoreCircle: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  scoreNumber: {
    fontSize: 28,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
  },
  right: {
    flex: 1,
  },
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: '0.05em',
    marginBottom: 6,
  },
  summary: {
    fontSize: 14,
    color: '#999',
    lineHeight: 1.5,
  },
  cardName: {
    fontSize: 16,
    fontWeight: 600,
    color: '#E0E0E0',
    marginBottom: 4,
  },
};

export default function OverallScore({ score, cardName, game, summary }) {
  const { label, color } = getScoreLabel(score);

  return (
    <div className="fade-slide-up" style={styles.wrapper}>
      <div
        className="score-animate"
        style={{
          ...styles.scoreCircle,
          border: `3px solid ${color}`,
          boxShadow: `0 0 20px ${color}22`,
        }}
      >
        <span style={{ ...styles.scoreNumber, color }}>{score}</span>
      </div>
      <div style={styles.right}>
        <div style={styles.cardName}>{cardName}</div>
        <span
          style={{
            ...styles.badge,
            color,
            background: color + '18',
          }}
        >
          {label}
        </span>
        {summary && <div style={styles.summary}>{summary}</div>}
      </div>
    </div>
  );
}
