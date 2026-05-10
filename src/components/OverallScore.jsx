import React from 'react';
import { getScoreLabel, GAME_LABELS } from '../config/signals';
import CardImage from './CardImage';

export default function OverallScore({ score, cardName, game, summary, truncated = false }) {
  const { label, color } = getScoreLabel(score);
  const gameMeta = GAME_LABELS[game];
  const glowColor = gameMeta?.color || '#C44040';

  return (
    <div className="fade-slide-up" style={{
      display: 'grid',
      gridTemplateColumns: '200px 1fr',
      gap: 0,
      background: '#0E1014',
      borderRadius: 3,
      marginBottom: 32,
      overflow: 'hidden',
      position: 'relative',
      border: '1px solid #1A1D24',
    }}>
      {/* Card Art — large, dominant */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 12px 24px 20px',
        background: '#0A0C10',
        borderRight: '1px solid #1A1D24',
      }}>
        <CardImage cardName={cardName} game={game} size={220} glowColor={glowColor} />
      </div>

      {/* Data Side */}
      <div style={{
        padding: '28px 32px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 16,
      }}>
        {/* Card name in serif — editorial */}
        <div>
          <h1 style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 32,
            fontWeight: 400,
            fontStyle: 'italic',
            color: '#E8E4DC',
            lineHeight: 1.1,
            marginBottom: 8,
            letterSpacing: '-0.01em',
          }}>
            {cardName}
          </h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {gameMeta && (
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                fontFamily: "'Syne', sans-serif",
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: gameMeta.color,
                opacity: 0.7,
              }}>
                {gameMeta.label}
              </span>
            )}
            <span style={{
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: '#2A2D34',
            }} />
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              fontFamily: "'Syne', sans-serif",
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color,
            }}>
              {label}
            </span>
            {truncated && (
              <>
                <span style={{
                  width: 3,
                  height: 3,
                  borderRadius: '50%',
                  background: '#2A2D34',
                }} />
                <span
                  title="The model's response was truncated; some signals may be incomplete. Retry for full data."
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: '0.14em',
                    color: '#A09060',
                    border: '1px solid rgba(160, 144, 96, 0.4)',
                    padding: '1px 6px',
                    borderRadius: 2,
                    background: 'rgba(160, 144, 96, 0.06)',
                    cursor: 'help',
                  }}
                >
                  PARTIAL
                </span>
              </>
            )}
          </div>
        </div>

        {/* Score — big, unmissable */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span className="score-animate" style={{
            fontSize: 64,
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            color,
            lineHeight: 1,
            letterSpacing: '-0.04em',
          }}>
            {score}
          </span>
          <span style={{
            fontSize: 18,
            fontFamily: "'JetBrains Mono', monospace",
            color: '#2A2D34',
            fontWeight: 400,
          }}>
            /100
          </span>
        </div>

        {/* Summary — the editorial voice */}
        {summary && (
          <p style={{
            fontSize: 14,
            color: '#6B6860',
            lineHeight: 1.65,
            fontFamily: "'Syne', sans-serif",
            fontWeight: 400,
            maxWidth: 440,
          }}>
            {summary}
          </p>
        )}
      </div>

      {/* Kanji watermark — barely there */}
      <span style={{
        position: 'absolute',
        right: 24,
        bottom: 16,
        fontSize: 72,
        fontWeight: 900,
        color: '#FFFFFF',
        opacity: 0.015,
        pointerEvents: 'none',
        userSelect: 'none',
        fontFamily: "'Noto Sans JP', sans-serif",
        lineHeight: 1,
      }}>株</span>
    </div>
  );
}
