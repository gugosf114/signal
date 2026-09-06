import React, { useState, useEffect } from 'react';
import { GAME_LABELS, getScoreLabel } from '../config/signals';
import ScrollReveal from './ScrollReveal';
import { printingIdentity } from '../services/printing';
import { hasPrintingPin } from '../services/recentScans';

export function useWatchedCards() {
  const [watched, setWatched] = useState([]);

  const load = () => {
    try {
      const raw = localStorage.getItem('signal_watched_cards');
      const parsed = raw ? JSON.parse(raw) : [];
      setWatched((Array.isArray(parsed) ? parsed : []).filter((card) => hasPrintingPin(card?.pin)));
    } catch { setWatched([]); }
  };

  useEffect(() => {
    load();
    window.addEventListener('signal-watch-updated', load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener('signal-watch-updated', load);
      window.removeEventListener('storage', load);
    };
  }, []);

  const toggle = (card) => {
    try {
      const raw = localStorage.getItem('signal_watched_cards');
      const parsed = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(parsed) ? parsed : [];
      const identity = (value) => printingIdentity(value?.pin);
      const sameCard = (w) =>
        w.name === card.name && w.game === card.game &&
        identity(w) === identity(card);
      const exists = list.some(sameCard);
      const next = exists
        ? list.filter(w => !sameCard(w))
        : [{ ...card, watchedAt: new Date().toISOString() }, ...list].slice(0, 20);
      localStorage.setItem('signal_watched_cards', JSON.stringify(next));
      setWatched(next);
      window.dispatchEvent(new Event('signal-watch-updated'));
      return !exists;
    } catch { return false; }
  };

  const isWatched = (name, game, pin = null) =>
    watched.some((w) => w.name === name && w.game === game
      && printingIdentity(w.pin) === printingIdentity(pin));

  return { watched, toggle, isWatched, reload: load };
}

export default function WatchedCards({ onSelect }) {
  const { watched, toggle } = useWatchedCards();
  if (watched.length === 0) return null;

  return (
    <ScrollReveal style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 8,
        fontFamily: "'Syne', sans-serif",
        fontWeight: 700,
        letterSpacing: '0.22em',
        color: 'var(--signal-text-muted)',
        textTransform: 'uppercase',
        marginBottom: 6,
      }}>
        Watched
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {watched.map((card, i) => {
          const { color } = getScoreLabel(card.score ?? 50);
          const gameMeta = GAME_LABELS[card.game];
          return (
            <div
              key={i}
              className="watched-chip"
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
                className="watched-chip-open"
                onClick={() => onSelect(card.name, card.game, { pin: card.pin || null })}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#92897C',
                  fontSize: 13,
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                }}
              >
                <span style={{
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  color,
                }}>
                  {card.score == null ? '—' : `${card.score}/100`}
                </span>
                <span style={{ color: '#92897C' }}>{card.name}</span>
              </button>
              <button
                className="watched-chip-remove"
                onClick={() => toggle(card)}
                title="Unwatch"
                aria-label={`Stop watching ${card.name}`}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 10,
                  margin: -10,
                  cursor: 'pointer',
                  color: 'var(--signal-text-muted)',
                  fontSize: 13,
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
    </ScrollReveal>
  );
}
