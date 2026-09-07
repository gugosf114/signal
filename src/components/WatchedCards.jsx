import React, { useState, useEffect, useRef } from 'react';
import { GAME_LABELS, getScoreLabel } from '../config/signals';
import ScrollReveal from './ScrollReveal';
import { printingIdentity, printingLabel } from '../services/printing';
import { applyCardPricePatch, cardPriceLabel, cardPriceNeedsRefresh, normalizeCardRecord, stampCardPrice } from '../services/cardRecord';
import { refreshPrices } from '../services/refreshPrices';
import { isExactScanTarget } from '../services/scanIdentity';

export function useWatchedCards() {
  const [watched, setWatched] = useState([]);
  const priceRefreshAttempted = useRef(new Set());
  const mountedRef = useRef(true);

  const load = () => {
    try {
      const raw = localStorage.getItem('signal_watched_cards');
      const parsed = raw ? JSON.parse(raw) : [];
      const clean = (Array.isArray(parsed) ? parsed : []).map((card) => {
        const pin = normalizeCardRecord(card?.pin || {}, {
          name: card?.name,
          game: card?.game,
          price: card?.enPrice,
        });
        return pin ? { ...card, name: pin.name, game: pin.game, pin } : null;
      }).filter((card) => isExactScanTarget(card?.game, card?.pin));
      setWatched(clean);
      localStorage.setItem('signal_watched_cards', JSON.stringify(clean));
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

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const stale = watched.filter((item) => {
      const key = printingIdentity(item.pin);
      return key && cardPriceNeedsRefresh(item.pin) && !priceRefreshAttempted.current.has(key);
    });
    if (!stale.length) return;
    for (const item of stale) priceRefreshAttempted.current.add(printingIdentity(item.pin));
    Promise.all(stale.map(async (item) => [
      printingIdentity(item.pin),
      await refreshPrices(item.name, item.game, item.pin).catch(() => null),
    ])).then((updates) => {
      if (!mountedRef.current) return;
      const byKey = new Map(updates.filter(([, patch]) => patch));
      if (!byKey.size) return;
      setWatched((current) => {
        const next = current.map((item) => {
          const patch = byKey.get(printingIdentity(item.pin));
          return patch ? { ...item, pin: applyCardPricePatch(item.pin, patch) } : item;
        });
        localStorage.setItem('signal_watched_cards', JSON.stringify(next));
        return next;
      });
    });
  }, [watched]);

  const toggle = (card) => {
    try {
      const pin = stampCardPrice(normalizeCardRecord(card?.pin || {}, {
        name: card?.name,
        game: card?.game,
        price: card?.enPrice,
      }));
      if (!pin || !isExactScanTarget(pin.game, pin)) return false;
      const exactCard = { ...card, name: pin.name, game: pin.game, pin };
      const raw = localStorage.getItem('signal_watched_cards');
      const parsed = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(parsed) ? parsed : [];
      const identity = (value) => printingIdentity(value?.pin);
      const sameCard = (w) =>
        w.name === exactCard.name && w.game === exactCard.game &&
        identity(w) === identity(exactCard);
      const exists = list.some(sameCard);
      const next = exists
        ? list.filter((item) => !sameCard(item))
        : [{ ...exactCard, watchedAt: new Date().toISOString() }, ...list].slice(0, 20);
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
                title={[card.name, printingLabel(card.pin), cardPriceLabel({ ...card.pin, price: card.pin?.price ?? card.enPrice }), card.pin?.priceSource].filter(Boolean).join(' · ')}
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
