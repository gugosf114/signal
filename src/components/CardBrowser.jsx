import React, { useState, useEffect, useRef } from 'react';
import { GAME_LABELS } from '../config/signals';
import { BrandIcon } from '../config/brandIcons';

const GAME_BRAND = { pokemon: 'pokemon', mtg: 'mtg', yugioh: 'yugioh' };

const TABS = [
  { id: 'pokemon', label: 'Pokémon',   color: '#A09060' },
  { id: 'mtg',     label: 'Magic',     color: '#B08060' },
  { id: 'yugioh',  label: 'Yu-Gi-Oh!', color: '#7080A0' },
];

// Default query strings per game — no special chars so URL encoding is safe
const DEFAULT_QUERY = {
  pokemon: { q: 'set.id:sv7',       sort: '-set.releaseDate' },  // Stellar Crown
  mtg:     { q: 's:dsk game:paper', sort: 'released'         },  // Duskmourne
  yugioh:  { sort: 'new'                                      },
};

async function browseCards(game, query) {
  try {
    if (game === 'pokemon') {
      const q = query
        ? `name:${encodeURIComponent(query)}*`
        : DEFAULT_QUERY.pokemon.q;
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=21&orderBy=${DEFAULT_QUERY.pokemon.sort}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || []).map(c => ({
        id: c.id,
        name: c.name,
        game: 'pokemon',
        setName: c.set?.name || '',
        imageUrl: c.images?.small || null,
      }));
    }

    if (game === 'mtg') {
      const qRaw = query ? `${query} game:paper` : DEFAULT_QUERY.mtg.q;
      const res = await fetch(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(qRaw)}&order=${DEFAULT_QUERY.mtg.sort}&dir=desc&unique=cards`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || []).slice(0, 21).map(c => ({
        id: c.id,
        name: c.name,
        game: 'mtg',
        setName: c.set_name || '',
        imageUrl: c.image_uris?.small || c.card_faces?.[0]?.image_uris?.small || null,
      }));
    }

    if (game === 'yugioh') {
      const params = query
        ? `fname=${encodeURIComponent(query)}`
        : `sort=${DEFAULT_QUERY.yugioh.sort}`;
      const res = await fetch(
        `https://db.ygoprodeck.com/api/v7/cardinfo.php?${params}&num=21&offset=0`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || []).slice(0, 21).map(c => ({
        id: String(c.id),
        name: c.name,
        game: 'yugioh',
        setName: c.type || '',
        imageUrl: c.card_images?.[0]?.image_url_small || null,
      }));
    }
  } catch {
    // network failure — return empty, don't crash
  }
  return [];
}

export default function CardBrowser({ onCardSelect }) {
  const [activeGame, setActiveGame] = useState('pokemon');
  const [query, setQuery] = useState('');
  const [cards, setCards] = useState([]);
  const [browsing, setBrowsing] = useState(false);
  const debounceRef = useRef(null);

  const load = async (game, q) => {
    setBrowsing(true);
    const results = await browseCards(game, q);
    setCards(results);
    setBrowsing(false);
  };

  useEffect(() => {
    setQuery('');
    load(activeGame, '');
  }, [activeGame]);

  const handleQueryChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(activeGame, q), 420);
  };

  const activeTab = TABS.find(t => t.id === activeGame);

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
          color: '#3A3830',
          textTransform: 'uppercase',
        }}>
          Browse cards
        </span>

        {/* Game tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveGame(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                background: activeGame === tab.id ? `${tab.color}18` : 'transparent',
                border: `1px solid ${activeGame === tab.id ? tab.color + '50' : '#14161A'}`,
                borderRadius: 2,
                color: activeGame === tab.id ? tab.color : '#3A3830',
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

      {/* Search within browser */}
      <input
        type="text"
        value={query}
        onChange={handleQueryChange}
        placeholder={`Search ${activeTab?.label} cards...`}
        style={{
          width: '100%',
          background: '#0A0C10',
          border: '1px solid #14161A',
          borderRadius: 2,
          padding: '8px 14px',
          color: '#E8E4DC',
          fontSize: 12,
          fontFamily: "'Syne', sans-serif",
          marginBottom: 14,
          outline: 'none',
          boxSizing: 'border-box',
          caretColor: activeTab?.color || '#C44040',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => { e.target.style.borderColor = (activeTab?.color || '#C44040') + '50'; }}
        onBlur={e => { e.target.style.borderColor = '#14161A'; }}
      />

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
              background: '#0A0C10',
            }} />
          ))}
        </div>
      ) : cards.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: 8,
        }}>
          {/* Trim to whole rows of 3 so the last row isn't a partial 1-or-2-card sliver. */}
          {cards.slice(0, Math.max(3, Math.floor(cards.length / 3) * 3)).map(card => (
            <button
              key={card.id}
              onClick={() => onCardSelect(card.name, card.game)}
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
                    objectFit: 'cover',
                    borderRadius: 4,
                    display: 'block',
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  aspectRatio: '0.716',
                  background: '#0A0C10',
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
                color: '#4A4840',
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
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '32px 0',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: '#2A2820',
          letterSpacing: '0.06em',
        }}>
          No cards found
        </div>
      )}
    </div>
  );
}
