import React, { useState, useEffect } from 'react';
import { GAME_LABELS } from '../config/signals';
import { BrandIcon } from '../config/brandIcons';
import {
  cardBrowserRowKey,
  getExpansionSnapshot,
  getExpansions,
  fetchCardsBySet,
  fetchLatestCardsForGame,
  normalizeCardBrowserResults,
  searchCardsByName,
} from '../services/fetchExpansions';
import CardLightbox from './CardLightbox';

const GAME_BRAND = { pokemon: 'pokemon', mtg: 'mtg', yugioh: 'yugioh' };

const TABS = [
  { id: 'pokemon', label: 'Pokémon',   color: '#A09060' },
  { id: 'mtg',     label: 'Magic',     color: '#B08060' },
  { id: 'yugioh',  label: 'Yu-Gi-Oh!', color: '#7080A0' },
];

export default function CardBrowser({ onCardSelect, actionLabel = 'Scan this card', accentBorder = false }) {
  const [activeGame, setActiveGame] = useState('pokemon');
  const [expansions, setExpansions] = useState({ pokemon: [], mtg: [], yugioh: [] });
  const [activeSet, setActiveSet] = useState(null);
  const [priceSort, setPriceSort] = useState(null); // null | 'asc' | 'desc'
  const [cards, setCards] = useState([]);
  const [browsing, setBrowsing] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Tapping a browsed card opens it in the viewer rather than spending a scan.
  // Scanning is a deliberate second step, from inside the viewer.
  const [viewing, setViewing] = useState(null);

  // Typing shouldn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  // Show the last good expansion shelf immediately. Once it is an hour old,
  // refresh behind the visible shelf instead of replacing it with a blank wait.
  useEffect(() => {
    let cancelled = false;
    const snapshot = getExpansionSnapshot();
    if (snapshot?.data) setExpansions(snapshot.data);
    if (snapshot?.fresh) return () => { cancelled = true; };
    getExpansions({ force: true }).then((data) => {
      if (cancelled) return;
      setExpansions(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // When the user switches games OR expansions land, default to the newest set
  // for the active game and load its cards.
  useEffect(() => {
    const sets = expansions[activeGame] || [];
    if (!sets.length) {
      setActiveSet(null);
      setCards([]);
      return;
    }
    setActiveSet((prev) => {
      if (prev && prev.game === activeGame && sets.find(s => s.id === prev.id)) {
        return prev;
      }
      return sets[0];
    });
  }, [activeGame, expansions]);

  // Card fetch: prefer the picked expansion, but fall back to a generic
  // "latest cards" fetch for the active game if the expansion list hasn't
  // returned yet (or returned empty). Guarantees the grid never sits empty
  // while the user waits on a slow set-list lookup.
  // A name search replaces the expansion browse while there's a query; clearing
  // the box drops straight back to whichever set was selected.
  useEffect(() => {
    let cancelled = false;
    setBrowsing(true);
    setFailed(false);
    const searching = debounced.length >= 2;
    const fetcher = searching
      ? searchCardsByName(activeGame, debounced, priceSort)
      : activeSet
        ? fetchCardsBySet(activeSet.game, activeSet, priceSort)
        : fetchLatestCardsForGame(activeGame, priceSort);
    fetcher.then((results) => {
      if (cancelled) return;
      setCards(normalizeCardBrowserResults(results, activeGame));
      setBrowsing(false);
    }).catch(() => {
      if (cancelled) return;
      // The catalogue APIs — pokemontcg.io especially — fail intermittently.
      // Say so and offer a retry rather than showing an empty shelf, which
      // reads as "this game has no cards".
      setCards([]);
      setFailed(true);
      setBrowsing(false);
    });
    return () => { cancelled = true; };
  }, [activeSet, activeGame, priceSort, debounced, reloadKey]);

  const activeTab = TABS.find(t => t.id === activeGame);
  const activeExpansions = expansions[activeGame] || [];

  return (
    <div style={{ marginTop: 40 }}>
      {/* Section header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <span style={{
          fontSize: 9,
          fontFamily: "'Syne', sans-serif",
          fontWeight: 700,
          letterSpacing: '0.22em',
          color: '#605C54',
          textTransform: 'uppercase',
        }}>
          Browse cards
        </span>

        {/* Game tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`cb-game-tab${activeGame === tab.id ? ' cb-game-tab--on' : ''}`}
              onClick={() => {
                if (tab.id === activeGame) return;
                setCards([]);
                setViewing(null);
                setActiveGame(tab.id);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                background: activeGame === tab.id ? `${tab.color}18` : 'transparent',
                border: `1px solid ${activeGame === tab.id ? tab.color + '50' : '#14161A'}`,
                borderRadius: 2,
                color: activeGame === tab.id ? tab.color : '#605C54',
                fontSize: 10,
                cursor: 'pointer',
                fontFamily: "'Syne', sans-serif",
                fontWeight: 600,
                letterSpacing: '0.04em',
                transition: 'all 0.12s',
              }}
            >
              <BrandIcon brand={GAME_BRAND[tab.id]} size={10} style={{ opacity: activeGame === tab.id ? 0.85 : 0.4 }} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Name search — looks the card up in the same catalogue the grid browses.
          This does NOT run a scan; tapping a result does, same as tapping any
          browsed card. */}
      <div className={`cb-search${accentBorder ? ' cb-search--accent' : ''}`}>
        <svg className="cb-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <line x1="20" y1="20" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className="cb-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Find ${activeTab.label} by name or name + last digits`}
          enterKeyHint="search"
          autoComplete="off"
          spellCheck="false"
        />
        {query && (
          <button type="button" className="cb-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Price-sort toggles — none / low→high / high→low */}
      <div style={{
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        marginBottom: 10,
      }}>
        <span style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: '#605C54',
          marginRight: 4,
        }}>Sort</span>
        {[
          { key: null,   label: 'Default', glyph: '—' },
          { key: 'asc',  label: 'Low → High', glyph: '$↑' },
          { key: 'desc', label: 'High → Low', glyph: '$↓' },
        ].map((opt) => {
          const selected = priceSort === opt.key;
          return (
            <button
              key={opt.label}
              className={`cb-sort-chip${selected ? ' cb-sort-chip--on' : ''}`}
              onClick={() => setPriceSort(opt.key)}
              title={opt.label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                background: selected ? `${activeTab.color}18` : 'transparent',
                border: `1px solid ${selected ? activeTab.color + '60' : '#14161A'}`,
                borderRadius: 2,
                color: selected ? '#E8E4DC' : '#7A7368',
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: selected ? 700 : 500,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {opt.glyph}
            </button>
          );
        })}
      </div>

      {/* Expansion picker — last 6 expansions per game, horizontal scroll */}
      {activeExpansions.length > 0 && !debounced && (
        <div style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 4,
          marginBottom: 14,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          {activeExpansions.map((set) => {
            const selected = activeSet?.id === set.id;
            return (
              <button
                key={`${set.game}-${set.id}`}
                className={`cb-set-chip${selected ? ' cb-set-chip--on' : ''}`}
                onClick={() => setActiveSet(set)}
                title={set.name + (set.releaseDate ? ` · ${set.releaseDate}` : '')}
                style={{
                  flex: '0 0 auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  background: selected ? `${activeTab.color}18` : 'transparent',
                  border: `1px solid ${selected ? activeTab.color + '60' : '#14161A'}`,
                  borderRadius: 2,
                  color: selected ? '#E8E4DC' : '#7A7368',
                  fontSize: 12,
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: selected ? 600 : 500,
                  letterSpacing: '0.02em',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={(e) => {
                  if (!selected) {
                    e.currentTarget.style.borderColor = activeTab.color + '40';
                    e.currentTarget.style.color = '#C8C4BC';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selected) {
                    e.currentTarget.style.borderColor = '#14161A';
                    e.currentTarget.style.color = '#7A7368';
                  }
                }}
              >
                {set.name}
                {set.releaseDate && (
                  <span style={{
                    color: selected ? activeTab.color : '#494640',
                    fontSize: 9,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    '{set.releaseDate.slice(2, 4)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Card grid */}
      {browsing ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: 8,
        }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="loading-shimmer" style={{
              aspectRatio: '0.716',
              borderRadius: 4,
              background: 'var(--signal-tile)',
            }} />
          ))}
        </div>
      ) : cards.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: 8,
        }}>
          {cards.map(card => (
            <button
              key={cardBrowserRowKey(card)}
              className="cb-card"
              onClick={() => setViewing(card)}
              title={`${card.name}${card.setName ? ' · ' + card.setName : ''}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
                borderRadius: 4,
                overflow: 'hidden',
                transition: 'transform 0.12s, box-shadow 0.12s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.04)';
                e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.5)`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {card.imageUrl ? (
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  loading="lazy"
                  style={{
                    width: '100%',
                    aspectRatio: '0.716',
                    objectFit: 'contain',
                    borderRadius: 4,
                    display: 'block',
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  aspectRatio: '0.716',
                  background: 'var(--signal-tile)',
                  border: '1px solid #1A1D24',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  color: '#1A1D24',
                  fontFamily: "'JetBrains Mono'",
                }}>?</div>
              )}
              <div style={{
                padding: '4px 2px 2px',
                fontSize: 9,
                color: '#7A7368',
                fontFamily: "'Syne', sans-serif",
                fontWeight: 500,
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}>
                {card.name}
              </div>
            </button>
          ))}
        </div>
      ) : failed ? (
        <div className="cb-empty">
          <div>Couldn't reach the card catalogue.</div>
          <button type="button" className="cb-retry" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      ) : (
        <div className="cb-empty">
          {debounced ? `No ${activeTab.label} card matches "${debounced}"` : 'No cards found'}
        </div>
      )}

      <CardLightbox
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        imageUrl={viewing?.imageLarge || viewing?.imageUrl}
        cardName={viewing?.name}
        scanLabel={actionLabel}
        onScan={() => {
          const c = viewing;
          setViewing(null);
          // The browser already knows exactly which printing is on screen, so
          // pin it — same as picking a row in the search suggestions.
          onCardSelect(c.name, c.game, { pin: c });
        }}
      />
    </div>
  );
}
