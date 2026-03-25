import React from 'react';
import SignalCard from './SignalCard';

const styles = {
  section: {
    marginBottom: 28,
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1px solid #1A1A20',
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.08em',
    fontFamily: "'JetBrains Mono', monospace",
    color: '#666',
  },
  subtitle: {
    fontSize: 11,
    color: '#444',
    fontFamily: "'JetBrains Mono', monospace",
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
};

// Japan section gets a distinct tint
const japanSectionStyle = {
  ...styles.section,
  background: 'rgba(245, 0, 87, 0.03)',
  border: '1px solid rgba(245, 0, 87, 0.08)',
  borderRadius: 12,
  padding: '16px 14px 14px',
  marginLeft: -14,
  marginRight: -14,
};

export default function SignalSection({ section, signals, baseDelay = 0 }) {
  const isJapan = section.id === 'japan';
  const sectionSignals = section.signals
    .map((key) => signals.find((s) => s.key === key))
    .filter(Boolean);

  if (sectionSignals.length === 0) return null;

  return (
    <div style={isJapan ? japanSectionStyle : styles.section}>
      <div style={styles.header}>
        <span
          style={{
            ...styles.label,
            color: isJapan ? '#F50057' : '#666',
          }}
        >
          {section.label}
        </span>
        <span style={styles.subtitle}>{section.subtitle}</span>
      </div>
      <div style={styles.grid}>
        {sectionSignals.map((signal, i) => (
          <SignalCard
            key={signal.key}
            signal={signal}
            animDelay={baseDelay + i + 1}
          />
        ))}
      </div>
    </div>
  );
}
