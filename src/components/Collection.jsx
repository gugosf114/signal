import React, { useCallback, useEffect, useRef, useState } from 'react';
import { suggestCards } from '../services/fetchExpansions';
import {
  loadCollection, importCollection, removeOne, removeAll,
  countCards, collectionValue, cardKey,
} from '../services/collection';
import {
  parseCollectionBackup, saveCollectionBackup, saveCollectionCsv,
} from '../services/collectionFiles';
import CardLightbox from './CardLightbox';

const GAME_LABEL = { pokemon: 'PKM', mtg: 'MTG', yugioh: 'YGO' };
const CONDITION_LABEL = {
  near_mint: 'Near mint',
  lightly_played: 'Lightly played',
  moderately_played: 'Moderately played',
  heavily_played: 'Heavily played',
  damaged: 'Damaged',
};
const DEBOUNCE_MS = 250;

function money(value) {
  return Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : '—';
}

export default function Collection({ onLookup }) {
  const [cards, setCards] = useState(() => loadCollection());
  const [status, setStatus] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchActive, setSearchActive] = useState(-1);
  const searchRef = useRef(null);
  const importRef = useRef(null);
  const reqToken = useRef(0);
  const flashTimer = useRef(null);

  const reload = useCallback(() => setCards(loadCollection()), []);

  useEffect(() => {
    reload();
    window.addEventListener('signal-collection-updated', reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener('signal-collection-updated', reload);
      window.removeEventListener('storage', reload);
    };
  }, [reload]);

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  const flash = useCallback((kind, text) => {
    setStatus({ kind, text });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setStatus((value) => value?.text === text ? null : value), 4200);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSearchOpen(false);
      return;
    }
    const myToken = ++reqToken.current;
    const timer = setTimeout(async () => {
      try {
        const hits = await suggestCards(q, 8);
        if (myToken !== reqToken.current) return;
        setSuggestions(hits);
        setSearchActive(-1);
        setSearchOpen(hits.length > 0);
      } catch {
        if (myToken !== reqToken.current) return;
        setSuggestions([]);
        setSearchOpen(false);
        flash('bad', 'Card catalogues could not load. Try again.');
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, flash]);

  useEffect(() => {
    if (!searchOpen) return;
    const onDocDown = (event) => {
      if (!searchRef.current?.contains(event.target)) setSearchOpen(false);
    };
    document.addEventListener('pointerdown', onDocDown);
    return () => document.removeEventListener('pointerdown', onDocDown);
  }, [searchOpen]);

  const openLookup = (card) => {
    if (!card) return;
    reqToken.current += 1;
    setQuery('');
    setSuggestions([]);
    setSearchOpen(false);
    onLookup?.(card.name, card.game, { pin: card });
  };

  const submitLookup = (event) => {
    event.preventDefault();
    if (searchActive >= 0 && suggestions[searchActive]) {
      openLookup(suggestions[searchActive]);
      return;
    }
    if (suggestions.length === 1) {
      openLookup(suggestions[0]);
      return;
    }
    if (suggestions.length > 1) {
      setSearchOpen(true);
      flash('bad', 'Choose the card you mean from the list.');
      return;
    }
    if (query.trim().length >= 2) flash('bad', 'No card matched that search yet.');
  };

  const restoreBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = parseCollectionBackup(await file.text());
      const next = importCollection(imported);
      setCards(next);
      flash('ok', `Restored ${imported.length} collection row${imported.length === 1 ? '' : 's'}.`);
    } catch (error) {
      flash('bad', error?.message || 'That backup could not be read.');
    } finally {
      event.target.value = '';
    }
  };

  const saveFile = async (kind) => {
    try {
      const result = kind === 'backup'
        ? await saveCollectionBackup(cards)
        : await saveCollectionCsv(cards);
      flash('ok', `${kind === 'backup' ? 'Backup' : 'CSV'} saved · ${result.filename}`);
    } catch (error) {
      flash('bad', error?.message || 'The collection file could not be saved.');
    }
  };

  const total = countCards(cards);
  const marketTotal = collectionValue(cards);

  return (
    <div>
      <div className="col-intro">
        Look up the card first. Its market price and Signal report open together. Then tap Add to collection.
      </div>

      <form className="col-search" ref={searchRef} onSubmit={submitLookup}>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (!searchOpen || !suggestions.length) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setSearchActive((value) => (value + 1) % suggestions.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setSearchActive((value) => value <= 0 ? suggestions.length - 1 : value - 1);
            } else if (event.key === 'Enter' && searchActive >= 0) {
              event.preventDefault();
              openLookup(suggestions[searchActive]);
            } else if (event.key === 'Escape') setSearchOpen(false);
          }}
          onFocus={() => { if (suggestions.length) setSearchOpen(true); }}
          placeholder="Card name, number, or name + last digits"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="col-search-input"
          role="combobox"
          aria-expanded={searchOpen}
          aria-controls="collection-card-suggestions"
          aria-activedescendant={searchActive >= 0 ? `collection-card-option-${searchActive}` : undefined}
        />
        {searchOpen && suggestions.length > 0 && (
          <ul id="collection-card-suggestions" className="sb-list" role="listbox">
            {suggestions.map((card, index) => (
              <li key={`${card.game}-${card.printingId || card.id}-${index}`} role="presentation">
                <button
                  id={`collection-card-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === searchActive}
                  className={`sb-item ${index === searchActive ? 'sb-item--on' : ''}`}
                  onMouseEnter={() => setSearchActive(index)}
                  onClick={() => openLookup(card)}
                >
                  {card.imageUrl
                    ? <img src={card.imageUrl} alt="" className="sb-thumb" loading="lazy" />
                    : <span className="sb-thumb sb-thumb--empty" />}
                  <span className="sb-text">
                    <span className="sb-name">{card.name}</span>
                    <span className="sb-meta">
                      <span className="sb-game">{GAME_LABEL[card.game] || card.game}</span>
                      {card.setName || 'Set not listed'}{card.number ? ` · ${card.number}` : ''}
                    </span>
                  </span>
                  {card.price != null && <span className="sb-price">{money(card.price)}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {status && (
        <div className={`col-status ${status.kind === 'bad' ? 'col-status--bad' : ''}`}>{status.text}</div>
      )}

      <input ref={importRef} type="file" accept="application/json,.json" onChange={restoreBackup} hidden />

      <div className="col-summary">
        <div>
          <span className="col-summary-label">Cards</span>
          <strong>{total}</strong>
        </div>
        <div>
          <span className="col-summary-label">Market total</span>
          <strong>{money(marketTotal)}</strong>
        </div>
      </div>

      <div className="col-tools">
        <button type="button" onClick={() => saveFile('backup')} disabled={!cards.length}>Backup</button>
        <button type="button" onClick={() => saveFile('csv')} disabled={!cards.length}>Export CSV</button>
        <button type="button" onClick={() => importRef.current?.click()}>Restore</button>
      </div>

      {cards.length === 0 ? (
        <div className="col-empty">
          Clean catalogue images appear here after you add a card.
        </div>
      ) : (
        <div className="col-grid">
          {cards.map((card) => (
            <div className="col-cell" key={cardKey(card)}>
              <button
                type="button"
                className="col-card"
                onClick={() => setViewing(card)}
                title={`${card.name}${card.setName ? ` · ${card.setName}` : ''}`}
              >
                {card.imageUrl || card.imageLarge ? (
                  <img src={card.imageUrl || card.imageLarge} alt={card.name} loading="lazy" />
                ) : <span className="col-noart">{card.name}</span>}
                {card.qty > 1 && <span className="col-qty">×{card.qty}</span>}
              </button>
              <button
                type="button"
                className="col-remove"
                aria-label={`Remove one ${card.name}`}
                onClick={() => setCards(removeOne(card))}
              >−</button>
              <div className="col-name">{card.name}</div>
              <div className="col-card-meta">
                <strong>{money(card.marketPrice)}</strong>
                <span>{CONDITION_LABEL[card.condition] || 'Near mint'} · {card.form === 'reverse' ? 'Reverse' : 'Normal'}</span>
                {card.paidPerCard != null && <span>Paid {money(card.paidPerCard)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <CardLightbox
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        imageUrl={viewing?.imageLarge || viewing?.imageUrl}
        cardName={viewing?.name}
        scanLabel="Open Signal"
        onScan={viewing && onLookup ? () => {
          const card = viewing;
          setViewing(null);
          onLookup(card.name, card.game, { pin: card });
        } : null}
        onRemove={viewing ? () => {
          const card = viewing;
          setViewing(null);
          setCards(removeAll(card));
        } : null}
      />
    </div>
  );
}
