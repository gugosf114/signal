import React, { useEffect, useState } from 'react';
import { getScoreLabel, GAME_LABELS, SIGNAL_TYPES } from '../config/signals';
import { useIsMobile } from '../hooks/useIsMobile';
import { useWatchedCards } from './WatchedCards';
import CardImage from './CardImage';
import CardLightbox from './CardLightbox';

export default function OverallScore({ score, cardName, game, summary, truncated = false, signalCount = 0, onRetry, signals = [], enPrice, jpPrice, trend, onCardImageLoaded }) {
  const { label, color, blurb } = getScoreLabel(score);
  const gameMeta = GAME_LABELS[game];
  const glowColor = gameMeta?.color || '#C44040';
  const isMobile = useIsMobile();
  const hideKanji = useIsMobile(768);
  const [percentileInfo, setPercentileInfo] = useState(null);
  const [cardImageUrl, setCardImageUrl] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { toggle: toggleWatch, isWatched } = useWatchedCards();
  const watched = isWatched(cardName, game);

  useEffect(() => {
    if (score === null || score === undefined || !cardName) return;
    try {
      const raw = localStorage.getItem('signal_score_history');
      const history = raw ? JSON.parse(raw) : [];
      const entry = { score, date: new Date().toISOString(), cardName, game };
      const deduped = [entry, ...history.filter(h => !(h.cardName === cardName && h.game === game))];
      const trimmed = deduped.slice(0, 100);
      localStorage.setItem('signal_score_history', JSON.stringify(trimmed));
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

  // Find the top signal (highest level) for the lightbox annotation
  const topSignal = (() => {
    if (!signals.length) return null;
    const top = [...signals].sort((a, b) => b.level - a.level)[0];
    const meta = SIGNAL_TYPES[top?.key];
    return meta ? { label: meta.label, color: meta.color } : null;
  })();

  return (
    <>
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
          height: isMobile ? 240 : 'auto',
        }}>
          <CardImage
            cardName={cardName}
            game={game}
            size={isMobile ? 200 : 360}
            glowColor={glowColor}
            onLoad={(url) => { setCardImageUrl(url); onCardImageLoaded?.(url); }}
            onClick={() => setLightboxOpen(true)}
          />
        </div>

        {/* Data Side */}
        <div style={{
          padding: isMobile ? '20px 20px' : '28px 32px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 12,
        }}>
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
                  fontSize: 12,
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
                fontSize: 12,
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

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="score-animate" style={{
                fontSize: 48,
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color,
                lineHeight: 1,
                letterSpacing: '-0.04em',
              }}>
                {score}
              </span>
              <span style={{
                fontSize: 15,
                fontFamily: "'JetBrains Mono', monospace",
                color: '#2A2D34',
                fontWeight: 400,
              }}>
                /100
              </span>
              {/* Watch / unwatch button */}
              <button
                onClick={() => toggleWatch({ name: cardName, game, score, enPrice, jpPrice })}
                title={watched ? 'Unwatch this card' : 'Watch this card'}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: watched ? 1 : 0.35,
                  transition: 'opacity 0.15s',
                  marginLeft: 2,
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = watched ? '1' : '0.35'; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24"
                  fill={watched ? color : 'none'}
                  stroke={color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                </svg>
              </button>
            </div>

            {/* Tier blurb — descriptive, not directive. Footer disclaimer still applies. */}
            <div style={{
              marginTop: 6,
              fontSize: 14,
              fontFamily: "'Instrument Serif', serif",
              fontStyle: 'italic',
              color: '#8A8680',
              lineHeight: 1.4,
            }}>
              {blurb}
            </div>

            {/* A bare "62" is meaningless on its own — the comparison to the
                user's own scan history is the line that actually lands. It used
                to be 13px grey under a 64px number; the number has come down
                and this has come up so the sentence reads first. */}
            {percentileInfo && (
              <div style={{
                marginTop: 8,
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 6,
                flexWrap: 'wrap',
              }}>
                <span style={{
                  fontSize: 20,
                  fontFamily: "'Instrument Serif', serif",
                  fontStyle: 'italic',
                  color: '#E8E4DC',
                  lineHeight: 1.2,
                }}>
                  Top {percentileInfo.topPct}%
                </span>
                <span style={{
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#7A7368',
                  letterSpacing: '0.04em',
                }}>
                  of your last {percentileInfo.total} scans
                </span>
              </div>
            )}

            {truncated && (
              <div style={{
                marginTop: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: 14, fontFamily: "'JetBrains Mono', monospace", color: '#A09060', letterSpacing: '0.06em' }}>
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
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', monospace",
                      cursor: 'pointer',
                      letterSpacing: '0.06em',
                      lineHeight: 1.6,
                    }}
                  >
                    Retry
                  </button>
                )}
                <span style={{ fontSize: 14, fontFamily: "'JetBrains Mono', monospace", color: '#A09060', letterSpacing: '0.06em' }}>
                  for full data
                </span>
              </div>
            )}
          </div>

          {summary && (
            <p style={{
              fontSize: 15,
              color: '#A8A498',
              lineHeight: 1.65,
              fontFamily: "'Syne', sans-serif",
              fontWeight: 400,
              maxWidth: 440,
            }}>
              {summary}
            </p>
          )}
        </div>

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

      <CardLightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageUrl={cardImageUrl}
        cardName={cardName}
        score={score}
        scoreLabel={label}
        scoreColor={color}
        enPrice={enPrice}
        jpPrice={jpPrice}
        trend={trend}
        topSignal={topSignal}
      />
    </>
  );
}
