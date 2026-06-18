import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    let cancelled = false;
    getTopTrending().then((picks) => {
      if (cancelled || !Array.isArray(picks) || !picks.length) return;
      setTrending(picks.slice(0, 5));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
          Top Trending · 5
        </span>
        <div style={{
          flex: 1,
          height: 1,
          background: 'linear-gradient(270deg, transparent, #1A1D24 70%)',
        }} />
      </div>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        justifyContent: 'center',
      }}>
        {trending.map((card, idx) => {
          const game = GAME_LABELS[card.game] || { color: '#605C54', label: card.game || '?' };
          return (
            <button
              key={`${card.game}-${card.name}-${idx}`}
              onClick={() => !loading && onSelect(card.name, card.game)}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
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
              {card.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
