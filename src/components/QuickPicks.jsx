import React, { useEffect, useRef, useState } from 'react';
import { SAMPLE_CARDS, GAME_LABELS } from '../config/signals';
import { BrandIcon } from '../config/brandIcons';
import { getTopTrending } from '../services/fetchTopTrending';

const GAME_BRAND = {
  pokemon: 'pokemon',
  mtg: 'mtg',
  yugioh: 'yugioh',
};

// While the API call is in flight (and as the last-ditch fallback), show a
// handful of curated reseller targets so the strip is never empty.
const FALLBACK_TRENDING = SAMPLE_CARDS.slice(0, 5);

export default function QuickPicks({ onSelect, loading }) {
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
    <div style={{
      width: '100%',
      border: '1px solid #2A2D34',
      borderRadius: 4,
      padding: '14px 16px 12px',
      background: 'rgba(20, 22, 26, 0.35)',
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
          return (
            <button
              key={`${card.game}-${card.name}-${idx}`}
              onClick={() => !loading && onSelect(card.name, card.game, { pin: card.id ? card : null })}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                minWidth: 0,
                minHeight: 32,
                padding: '5px 10px',
                background: 'transparent',
                border: '1px solid #14161A',
                borderRadius: 2,
                color: '#7A7368',
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
                e.currentTarget.style.borderColor = '#14161A';
                e.currentTarget.style.color = '#7A7368';
              }}
            >
              <BrandIcon brand={GAME_BRAND[card.game]} size={11} style={{ opacity: 0.7, flexShrink: 0 }} />
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
    </div>
  );
}
