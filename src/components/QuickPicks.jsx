import React from 'react';
import { SAMPLE_CARDS, GAME_LABELS } from '../config/signals';
import { BrandIcon } from '../config/brandIcons';

const GAME_BRAND = {
  pokemon: 'pokemon',
  mtg: 'mtg',
  yugioh: 'yugioh',
};

export default function QuickPicks({ onSelect, loading }) {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      justifyContent: 'center',
    }}>
      {SAMPLE_CARDS.map((card) => {
        const game = GAME_LABELS[card.game] || { color: '#3A3830', label: card.game || '?' };
        return (
          <button
            key={card.name}
            onClick={() => !loading && onSelect(card.name, card.game)}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              background: 'transparent',
              border: `1px solid ${card.classic ? '#1E2028' : '#14161A'}`,
              borderRadius: 2,
              color: '#4A4840',
              fontSize: 11,
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
              e.currentTarget.style.borderColor = card.classic ? '#1E2028' : '#14161A';
              e.currentTarget.style.color = '#4A4840';
            }}
          >
            <BrandIcon brand={GAME_BRAND[card.game]} size={11} style={{ opacity: 0.7, flexShrink: 0 }} />
            {card.name}
            {card.year && (
              <span style={{ color: '#2A2820', fontSize: 9, fontFamily: "'JetBrains Mono'" }}>
                {card.year}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
