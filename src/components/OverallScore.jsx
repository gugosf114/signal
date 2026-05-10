import React, { useEffect, useState } from 'react';
import { getScoreLabel, GAME_LABELS } from '../config/signals';
import { useIsMobile } from '../hooks/useIsMobile';
import CardImage from './CardImage';

export default function OverallScore({ score, cardName, game, summary, truncated = false, signalCount = 0, onRetry }) {
  const { label, color } = getScoreLabel(score);
  const gameMeta = GAME_LABELS[game];
  const glowColor = gameMeta?.color || '#C44040';
  const isMobile = useIsMobile();
  const hideKanji = useIsMobile(768);
  const [percentileInfo, setPercentileInfo] = useState(null);

  useEffect(() => {
    if (score === null || score === undefined || !cardName) return;
    try {
      const raw = localStorage.getItem('signal_score_history');
      const history = raw ? JSON.parse(raw) : [];
      const entry = { score, date: new Date().toISOString(), cardName, game };
      const deduped = [entry, ...history.filter(h => !(h.cardName === cardName && h.game === game))];
      const trimmed = deduped.slice(0, 100);
      localStorage.setItem('signal_score_history', JSON.stringify(trimmed));

      // Also update recent scans for L5
      try {
        const recentRaw = localStorage.getItem('signal_recent_scans');
        const recent = recentRaw ? JSON.parse(recentRaw) : [];
        const recentEntry = { name: cardName, game, score, scoredAt: entry.date };
        const recentNew = [recentEntry, ...recent.filter(r => !(r.name === cardName && r.game === game))].slice(0, 8);
        localStorage.setItem('signal_recent_scans', JSON.stringify(recentNew));
      } catch {}

      if (trimmed.length >= 5) {
        const allScores = trimmed.map(h => h.score);
        const lowerCount = allScores.filter(s => s < score).length;
        const topPct = 100 - Math.round((lowerCount / allScores.length) * 100);
        setPercentileInfo({ topPct, total: trimmed.length });
      }
    } catch {}
  }, [score, cardName, game]);

  return (
    <div className="fade-slide-up" style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '200px 1fr',
      gap: 0,
      background: '#0E1014',
      borderRadius: 3,
      marginBottom: 32,
      overflow: 'hidden',
      position: 'relative',
      border: '1px solid #1A1D24',
    }}>
      {/* Card Art */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '12px 8px' : '24px 12px 24px 20px',
        background: '#0A0C10',
        borderRight: isMobile ? 'none' : '1px solid #1A1D24',
        borderBottom: isMobile ? '1px solid #1A1D24' : 'none',
        height: isMobile ? 120 : 'auto',
      }}>
        <CardImage cardName={cardName} game={game} size={isMobile ? 100 : 220} glowColor={glowColor} />
      </div>

      {/* Data Side */}
      <div style={{
        padding: isMobile ? '20px 20px' : '28px 32px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 12,
      }}>
        {/* Card name */}
        <div>
          <h1 style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: isMobile ? 24 : 32,
            fontWeight: 400,
            fontStyle: 'italic',
            color: '#E8E4DC',
            lineHeight: 1.0,
            marginBottom: 8,
            letterSpacing: '-0.01em',
            textWrap: 'balance',
          }}>
            {cardName}
          </h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#2A2D34', flexShrink: 0 }} />
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
          </div>
        </div>

        {/* Score */}
        <div>
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

          {/* Percentile — H2 */}
          {percentileInfo && (
            <div style={{
              marginTop: 4,
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              color: '#4A4840',
              letterSpacing: '0.06em',
            }}>
              Top {percentileInfo.topPct}% of your last {percentileInfo.total} scans
            </div>
          )}

          {/* PARTIAL inline — M4 */}
          {truncated && (
            <div style={{
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}>
              <span style={{
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                color: '#A09060',
                letterSpacing: '0.06em',
              }}>
                PARTIAL · {signalCount} of 9 signals
              </span>
              {onRetry && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRetry(); }}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(160, 144, 96, 0.35)',
                    borderRadius: 2,
                    padding: '1px 8px',
                    color: '#A09060',
                    fontSize: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                    cursor: 'pointer',
                    letterSpacing: '0.06em',
                    lineHeight: 1.6,
                  }}
                >
                  Retry
                </button>
              )}
              <span style={{
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                color: '#A09060',
                letterSpacing: '0.06em',
              }}>
                for full data
              </span>
            </div>
          )}
        </div>

        {/* Summary */}
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

      {/* Kanji watermark — hide below 768px */}
      {!hideKanji && (
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
      )}
    </div>
  );
}
