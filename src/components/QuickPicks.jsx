import React, { useEffect, useRef, useState } from 'react';
import { SAMPLE_CARDS, GAME_LABELS } from '../config/signals';
import { getTopTrending } from '../services/fetchTopTrending';
import GameMark from './GameMark';
import ScrollReveal from './ScrollReveal';

// While the API call is in flight (and as the last-ditch fallback), show a
// handful of curated reseller targets so the strip is never empty.
const FALLBACK_TRENDING = SAMPLE_CARDS.slice(0, 5);

export default function QuickPicks({ onSelect, loading, introActive = false }) {
  const [trending, setTrending] = useState(FALLBACK_TRENDING);
  const [isLive, setIsLive] = useState(false);
  const [showFade, setShowFade] = useState(false);
  const listRef = useRef(null);

  const updateFade = () => {
    const list = listRef.current;
    if (!list) return;
    setShowFade(list.scrollTop + list.clientHeight < list.scrollHeight - 1);
  };

  useEffect(() => {
    let cancelled = false;
    getTopTrending().then((picks) => {
      if (cancelled || !Array.isArray(picks) || !picks.length) return;
      setTrending(picks.slice(0, 5));
      setIsLive(true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(updateFade);
    return () => cancelAnimationFrame(frame);
  }, [trending]);

  return (
    <ScrollReveal className={`quick-picks-panel quick-picks-panel--intro-${introActive ? 'active' : 'done'}`} style={{
      width: '100%',
      border: '0.5px solid #FFFFFF',
      borderRadius: 4,
      padding: '14px 16px 12px',
      background: 'var(--signal-panel)',
    }}>
      {/* Header — TOP TRENDING / weekly · TCGplayer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
        opacity: loading ? 0.4 : 1,
      }}>
        <div style={{
          flex: 1,
          height: 1,
          background: 'linear-gradient(90deg, transparent, #1A1D24 70%)',
        }} />
        <span style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.26em',
          textTransform: 'uppercase',
          color: '#92897C',
          whiteSpace: 'nowrap',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{
            color: '#C44040',
            fontFamily: "'JetBrains Mono'",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0,
          }}>▲</span>
          {isLive ? 'Top Trending' : 'Card Ideas'} · {trending.length}
        </span>
        <div style={{
          flex: 1,
          height: 1,
          background: 'linear-gradient(270deg, transparent, #1A1D24 70%)',
        }} />
      </div>

      <div style={{ position: 'relative' }}>
        <div
          ref={listRef}
          onScroll={updateFade}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 6,
            maxHeight: 108,
            overflowY: 'auto',
            alignContent: 'start',
            paddingRight: 2,
            scrollbarWidth: 'thin',
          }}
        >
          {trending.map((card, idx) => {
            const game = GAME_LABELS[card.game] || { color: '#605C54', label: card.game || '?' };
            const dealDelay = 0.58 + (idx * 0.085);
            return (
              <button
              key={`quick-pick-${idx}`}
              className={`quick-pick-card quick-pick-card--${card.game || 'unknown'}`}
              onClick={() => !loading && onSelect(card.name, card.game, { pin: card.id ? card : null })}
              disabled={loading}
              style={{
                '--deal-delay': `${dealDelay}s`,
                '--deal-x': idx % 2 === 0 ? '-18px' : '18px',
                '--deal-angle': idx % 2 === 0 ? '-2.4deg' : '2.4deg',
                '--game-color': game.color,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                minWidth: 0,
                minHeight: 32,
                padding: '5px 10px',
                background: 'var(--signal-tile)',
                border: '1px solid #4A464F',
                borderRadius: 2,
                color: 'var(--signal-text-secondary)',
                fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: "'Syne', sans-serif",
                fontWeight: 500,
                transition: 'all 0.12s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                opacity: loading ? 0.3 : 1,
                letterSpacing: '0.02em',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.borderColor = game.color + '40';
                  e.currentTarget.style.color = '#E8E4DC';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#4A464F';
                e.currentTarget.style.color = 'var(--signal-text-secondary)';
              }}
            >
              <GameMark game={card.game} compact alive />
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name}</span>
              {/* Only shown when the source article was specifically about price
                  spikes — a mixed "biggest movers" list carries no arrow rather
                  than a guessed direction. Title names the article. */}
              {card.dir === 'up' && (
                <span
                  title={card.sourceTitle || 'Listed in this week’s price-spike article'}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#608870',
                    flexShrink: 0,
                  }}
                >▲</span>
              )}
              </button>
            );
          })}
        </div>
        {showFade && <div className="compact-scroll-fade" aria-hidden />}
      </div>
    </ScrollReveal>
  );
}
