import React, { useEffect, useState } from 'react';
import { getScoreLabel, GAME_LABELS, SCORE_VERSION } from '../config/signals';
import { useIsMobile } from '../hooks/useIsMobile';
import { useWatchedCards } from './WatchedCards';
import CardImage from './CardImage';
import CardLightbox from './CardLightbox';
import { printingLabel } from '../services/printing';
import PrintingIdentity from './PrintingIdentity';

export default function OverallScore({ score, cardName, game, summary, truncated = false, signalCount = 0, expectedSignalCount = 8, coveragePct = 0, evidencePct = 0, onRetry, signals = [], enPrice, onCardImageLoaded, printing = null, pin = null }) {
  const { label, color, blurb } = getScoreLabel(score);
  const gameMeta = GAME_LABELS[game];
  const glowColor = gameMeta?.color || '#C44040';
  const isMobile = useIsMobile();
  const hideKanji = useIsMobile(768);
  const [percentileInfo, setPercentileInfo] = useState(null);
  const [cardImageUrl, setCardImageUrl] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { toggle: toggleWatch, isWatched } = useWatchedCards();
  const watched = isWatched(cardName, game, pin);

  useEffect(() => {
    if (score === null || score === undefined || !cardName || truncated) return;
    try {
      const raw = localStorage.getItem('signal_score_history');
      const parsedHistory = raw ? JSON.parse(raw) : [];
      const history = Array.isArray(parsedHistory) ? parsedHistory : [];
      const identity = pin?.printingId || pin?.id || `${pin?.setId || ''}:${pin?.number || ''}`;
      const entry = { score, scoreVersion: SCORE_VERSION, date: new Date().toISOString(), cardName, game, pin };
      const deduped = [entry, ...history.filter((item) => {
        const otherIdentity = item?.pin?.printingId || item?.pin?.id || `${item?.pin?.setId || ''}:${item?.pin?.number || ''}`;
        return !(item.cardName === cardName && item.game === game && otherIdentity === identity);
      })];
      const trimmed = deduped.slice(0, 100);
      localStorage.setItem('signal_score_history', JSON.stringify(trimmed));
      try {
        const recentRaw = localStorage.getItem('signal_recent_scans');
        const parsedRecent = recentRaw ? JSON.parse(recentRaw) : [];
        const recent = Array.isArray(parsedRecent) ? parsedRecent : [];
        const recentEntry = { name: cardName, game, score, scoreVersion: SCORE_VERSION, scoredAt: entry.date, pin };
        const recentNew = [recentEntry, ...recent.filter((item) => {
          const otherIdentity = item?.pin?.printingId || item?.pin?.id || `${item?.pin?.setId || ''}:${item?.pin?.number || ''}`;
          return !(item.name === cardName && item.game === game && otherIdentity === identity);
        })].slice(0, 8);
        localStorage.setItem('signal_recent_scans', JSON.stringify(recentNew));
        window.dispatchEvent(new Event('signal-history-updated'));
      } catch {}
      const comparable = trimmed.filter((item) => item.scoreVersion === SCORE_VERSION && Number.isFinite(item.score));
      if (comparable.length >= 5) {
        const allScores = comparable.map((item) => item.score);
        const lowerCount = allScores.filter((value) => value < score).length;
        const topPct = 100 - Math.round((lowerCount / allScores.length) * 100);
        setPercentileInfo({ topPct, total: comparable.length });
      } else {
        setPercentileInfo(null);
      }
    } catch {}
  }, [score, cardName, game, pin, truncated]);

  return (
    <>
      <div className="fade-slide-up" style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '260px 1fr',
        gap: 0,
        background: 'var(--signal-panel)',
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
          background: 'var(--signal-tile)',
          borderRight: isMobile ? 'none' : '1px solid #1A1D24',
          borderBottom: isMobile ? '1px solid #1A1D24' : 'none',
          height: isMobile ? 240 : 'auto',
        }}>
          <CardImage
            cardName={cardName}
            game={game}
            pin={pin}
            size={isMobile ? 200 : 320}
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
            {/* Which printing this is. "Charizard" is hundreds of cards at
                hundreds of prices; the name alone never said which one the
                numbers below belong to. */}
            {printingLabel(printing) && (
              <PrintingIdentity printing={printing} />
            )}
            {!printingLabel(printing) && (
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: '#A09060',
                marginBottom: 10,
                letterSpacing: '0.03em',
              }}>
                PRINTING NOT PINNED · PRICE MAY VARY BY VERSION
              </div>
            )}
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
            <div style={{
              marginBottom: 5,
              fontFamily: "'Syne', sans-serif",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.16em',
              color: '#7A7368',
            }}>
              MARKET PRESSURE
            </div>
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
                onClick={() => toggleWatch({ name: cardName, game, score, enPrice, pin })}
                title={watched ? 'Unwatch this card' : 'Watch this card'}
                aria-label={watched ? `Stop watching ${cardName}` : `Watch ${cardName}`}
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

            <div style={{
              marginTop: 7,
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              color: evidencePct < 50 ? '#A09060' : '#7A7368',
              letterSpacing: '0.04em',
            }}>
              {signalCount}/{expectedSignalCount} SIGNALS · {evidencePct}% WITH VERIFIED SOURCES
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
                  PARTIAL · {signalCount} of {expectedSignalCount} signals
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
      />
    </>
  );
}
