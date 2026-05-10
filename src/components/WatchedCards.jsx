import React, { useState, useEffect } from 'react';
import { GAME_LABELS, getScoreLabel } from '../config/signals';

export function useWatchedCards() {
  const [watched, setWatched] = useState([]);

  const load = () => {
    try {
      const raw = localStorage.getItem('signal_watched_cards');
      setWatched(raw ? JSON.parse(raw) : []);
    } catch { setWatched([]); }
  };

  useEffect(() => { load(); }, []);

  const toggle = (card) => {
    try {
      const raw = localStorage.getItem('signal_watched_cards');
      const list = raw ? JSON.parse(raw) : [];
      const exists = list.some(w => w.name === card.name && w.game === card.game);
      const next = exists
        ? list.filter(w => !(w.name === card.name && w.game === card.game))
        : [{ ...card, watchedAt: new Date().toISOString() }, ...list].slice(0, 20);
      localStorage.setItem('signal_watched_cards', JSON.stringify(next));
      setWatched(next);
      return !exists;
    } catch { return false; }
  };

  const isWatched = (name, game) => watched.some(w => w.name === name && w.game === game);

  return { watched, toggle, isWatched, reload: load };
}

export default function WatchedCards({ onSelect }) {
  const { watched, toggle } = useWatchedCards();
  if (watched.length === 0) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 8,
        fontFamily: "'Syne', sans-serif",
        fontWeight: 700,
        letterSpacing: '0.22em',
        color: '#3A3830',
        textTransform: 'uppercase',
        marginBottom: 6,
      }}>
        Watched
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {watched.map((card, i) => {
          const { color } = getScoreLabel(card.score || 0);
          const gameMeta = GAME_LABELS[card.game];
          return (
            <div
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                border: `1px solid ${color}30`,
                borderRadius: 2,
                background: `${color}08`,
              }}
            >
              <button
                onClick={() => onSelect(card.name, card.game)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#5A5850',
                  fontSize: 10,
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                }}
              >
                <span style={{
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  color,
                }}>
                  {card.score || '—'}
                </span>
                <span style={{ color: '#5A5850' }}>{card.name}</span>
              </button>
              <button
                onClick={() => toggle(card)}
                title="Unwatch"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#2A2820',
                  fontSize: 10,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
