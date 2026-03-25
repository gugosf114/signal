import React from 'react';
import { SAMPLE_CARDS, GAME_LABELS } from '../config/signals';

const styles = {
  wrapper: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    background: '#141418',
    border: '1px solid #2A2A30',
    borderRadius: 20,
    color: '#B0B0B0',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  },
  gameDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  classic: {
    border: '1px solid #3A3A44',
    background: '#1A1A20',
  },
};

export default function QuickPicks({ onSelect, loading }) {
  return (
    <div style={styles.wrapper}>
      {SAMPLE_CARDS.map((card) => {
        const game = GAME_LABELS[card.game];
        return (
          <button
            key={card.name}
            onClick={() => !loading && onSelect(card.name, card.game)}
            disabled={loading}
            style={{
              ...styles.chip,
              ...(card.classic ? styles.classic : {}),
              opacity: loading ? 0.5 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = game.color;
                e.currentTarget.style.color = '#E0E0E0';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = card.classic ? '#3A3A44' : '#2A2A30';
              e.currentTarget.style.color = '#B0B0B0';
            }}
          >
            <span style={{ ...styles.gameDot, background: game.color }} />
            {card.name}
            {card.year && <span style={{ color: '#666', fontSize: 11 }}>{card.year}</span>}
          </button>
        );
      })}
    </div>
  );
}
