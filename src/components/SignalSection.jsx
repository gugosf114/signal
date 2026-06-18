import React from 'react';
import SignalCard from './SignalCard';

const SECTION_ACCENTS = {
  japan: '#C44040',
  'short-term': '#A09060',
  structural: '#7E7894',
};

export default function SignalSection({ section, signals, baseDelay = 0 }) {
  const isJapan = section.id === 'japan';
  const accentColor = SECTION_ACCENTS[section.id] || '#A8A498';
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
      {/* Section header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        paddingTop: isJapan ? 20 : 0,
        marginBottom: 16,
      }}>
        {/* 2px colored lead-in bar */}
        <div style={{
          width: 2,
          height: 24,
          borderRadius: 1,
          flexShrink: 0,
          marginTop: isJapan ? 2 : 1,
          background: accentColor,
        }} />

        {/* Label + subtitle */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 4,
        }}>
          <h2 style={{
            fontFamily: isJapan ? "'Instrument Serif', serif" : "'Syne', sans-serif",
            fontSize: isJapan ? 18 : 12,
            fontWeight: isJapan ? 400 : 700,
            fontStyle: isJapan ? 'italic' : 'normal',
            letterSpacing: isJapan ? '0.01em' : '0.16em',
            textTransform: isJapan ? 'none' : 'uppercase',
            color: isJapan ? '#C44040' : '#8A8678',
            opacity: isJapan ? 1 : 0.85,
            lineHeight: 1,
          }}>
            {section.label}
          </h2>
          <span style={{
            fontSize: 12,
            color: '#494640',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {section.id === 'short-term' ? '⏱ ' : ''}{section.subtitle}
          </span>
        </div>
      </div>

      {/* Signal grid */}
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
