import React from 'react';
import SignalCard from './SignalCard';

export default function SignalSection({ section, signals, baseDelay = 0 }) {
  const isJapan = section.id === 'japan';
  const sectionSignals = section.signals
    .map((key) => signals.find((s) => s.key === key))
    .filter(Boolean);

  if (sectionSignals.length === 0) return null;

  return (
    <div style={{
      marginBottom: 40,
      position: 'relative',
      ...(isJapan ? {
        background: 'rgba(196, 64, 64, 0.02)',
        margin: '0 -24px 40px',
        padding: '0 24px',
        borderTop: '1px solid rgba(196, 64, 64, 0.08)',
        borderBottom: '1px solid rgba(196, 64, 64, 0.08)',
      } : {}),
    }}>
      {/* Section header — editorial, serif for JP */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        paddingTop: isJapan ? 20 : 0,
        marginBottom: 16,
      }}>
        <h2 style={{
          fontFamily: isJapan ? "'Instrument Serif', serif" : "'Syne', sans-serif",
          fontSize: isJapan ? 18 : 10,
          fontWeight: isJapan ? 400 : 700,
          fontStyle: isJapan ? 'italic' : 'normal',
          letterSpacing: isJapan ? '0.01em' : '0.16em',
          textTransform: isJapan ? 'none' : 'uppercase',
          color: isJapan ? '#C44040' : '#3A3830',
          lineHeight: 1,
        }}>
          {section.label}
        </h2>
        <span style={{
          fontSize: 9,
          color: '#2A2820',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {section.subtitle}
        </span>
      </div>

      {/* Signal grid — 2 columns for density, single for JP */}
      <div style={{
        display: 'grid',
        gridTemplateColumns:
          isJapan
            ? '1fr'
            : sectionSignals.length > 2
              ? 'repeat(auto-fit, minmax(240px, 1fr))'
              : '1fr',
        gap: isJapan ? 0 : '1px 20px',
        paddingBottom: isJapan ? 20 : 0,
      }}>
        {sectionSignals.map((signal, i) => (
          <SignalCard
            key={signal.key}
            signal={signal}
            animDelay={baseDelay + i + 1}
            isJapan={isJapan}
          />
        ))}
      </div>
    </div>
  );
}
