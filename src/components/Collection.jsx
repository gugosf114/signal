import React, { useState, useRef, useEffect, useCallback } from 'react';
import { scanCardImage } from '../services/scanCardImage';
import { suggestCards, resolvePrinting } from '../services/fetchExpansions';
import {
  loadCollection, addToCollection, removeOne, removeAll, countCards, cardKey,
} from '../services/collection';
import CardLightbox from './CardLightbox';

// ─── Collection ──────────────────────────────────────────────────────────────
// Point the camera at a card, it lands on the shelf. That is the whole feature.
//
// Deliberately NOT a portfolio: no prices, no totals, no "your collection is
// worth". Signal already does valuation on its own page and does it properly,
// with sources. A number here would be a number without a source, and the
// person this page is for wants to show someone their cards.
//
// Adding a card costs one Haiku vision call — a fraction of a cent — and never
// touches the expensive analysis scan.

const GAME_LABEL = { pokemon: 'PKM', mtg: 'MTG', yugioh: 'YGO' };
const DEBOUNCE_MS = 250;

export default function Collection() {
  const [cards, setCards] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);   // { kind: 'ok' | 'bad', text }
  const [viewing, setViewing] = useState(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchActive, setSearchActive] = useState(-1);
  const fileRef = useRef(null);
  const searchRef = useRef(null);
  const reqToken = useRef(0);
  const flashTimer = useRef(null);

  useEffect(() => { setCards(loadCollection()); }, []);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  // Good news clears itself; a failure stays put. A camera error that vanishes
  // after three seconds is an error nobody can read, let alone report.
  const flash = useCallback((kind, text) => {
    setStatus({ kind, text });
    if (kind !== 'bad') {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setStatus((s) => (s && s.text === text ? null : s)), 3500);
    }
  }, []);

  // ── Add by photo ───────────────────────────────────────────────────────────
  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      const read = await scanCardImage(file);
      if (!read?.name) throw new Error('Could not read a card in that photo.');
      const card = await resolvePrinting(read).catch(() => null);
      if (!card) throw new Error('The exact printing could not be matched. Add it by name and choose the set.');
      const next = addToCollection(card);
      setCards(next);
      flash('ok', `Added ${card.name}${card.setName ? ' · ' + card.setName : ''}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[signal] collection photo scan failed', err);
      flash('bad', err?.message || 'That photo did not work. Try again in better light.');
    } finally {
      setBusy(false);
      if (e.target) e.target.value = '';
    }
  };

  // ── Add by name ────────────────────────────────────────────────────────────
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setSuggestions([]); setSearchOpen(false); return; }
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
        setSearchActive(-1);
        flash('bad', 'Card catalogues could not load. Try again.');
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!searchOpen) return;
    const onDocDown = (e) => {
      if (!searchRef.current?.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('pointerdown', onDocDown);
    return () => document.removeEventListener('pointerdown', onDocDown);
  }, [searchOpen]);

  const addByName = (card) => {
    reqToken.current += 1;
    setQuery('');
    setSuggestions([]);
    setSearchOpen(false);
    setCards(addToCollection(card));
    flash('ok', `Added ${card.name}${card.setName ? ' · ' + card.setName : ''}`);
  };

  const total = countCards(cards);

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handlePhoto}
      />

      {/* Scan button — the primary action, so it gets the whole width. */}
      <button
        type="button"
        className="col-scan"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
      >
        {busy ? (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" strokeLinecap="round" className="cam-spin" aria-hidden>
              <circle cx="12" cy="12" r="9" opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" />
            </svg>
            Reading the card…
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Scan a card
          </>
        )}
      </button>
      <div style={{ marginTop: 6, fontSize: 9, color: '#605C54', fontFamily: "'JetBrains Mono', monospace", textAlign: 'center' }}>
        Camera photos are resized and sent only to identify the card.
      </div>

      {/* Type the name instead — for cards the camera can't read, and for cards
          that aren't in front of you. */}
      <div className="col-search" ref={searchRef}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(event) => {
            if (!searchOpen || !suggestions.length) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setSearchActive((value) => (value + 1) % suggestions.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setSearchActive((value) => (value <= 0 ? suggestions.length - 1 : value - 1));
            } else if (event.key === 'Enter' && searchActive >= 0) {
              event.preventDefault();
              addByName(suggestions[searchActive]);
            } else if (event.key === 'Escape') {
              setSearchOpen(false);
            }
          }}
          onFocus={() => { if (suggestions.length) setSearchOpen(true); }}
          placeholder="…or add by name"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
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
                  onClick={() => addByName(card)}
                >
                  {card.imageUrl
                    ? <img src={card.imageUrl} alt="" className="sb-thumb" loading="lazy" />
                    : <span className="sb-thumb sb-thumb--empty" />}
                  <span className="sb-text">
                    <span className="sb-name">{card.name}</span>
                    <span className="sb-meta">
                      <span className="sb-game">{GAME_LABEL[card.game] || card.game}</span>
                      {card.setName || 'Unknown set'}
                      {card.number ? ` · ${card.number}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {status && (
        <div className={`col-status ${status.kind === 'bad' ? 'col-status--bad' : ''}`}>
          {status.text}
          {status.kind === 'bad' && (
            <button type="button" className="col-status-x" onClick={() => setStatus(null)}>
              dismiss
            </button>
          )}
        </div>
      )}

      <div className="col-count">
        {total === 0 ? 'No cards yet' : `${total} card${total === 1 ? '' : 's'}`}
        {cards.length !== total && ` · ${cards.length} different`}
      </div>

      {cards.length === 0 ? (
        <div className="col-empty">
          Point the camera at a card and it lands here.
          <br />
          No prices, no totals — just the cards.
        </div>
      ) : (
        <div className="col-grid">
          {cards.map((card) => (
            <div className="col-cell" key={cardKey(card)}>
              <button
                type="button"
                className="col-card"
                onClick={() => setViewing(card)}
                title={`${card.name}${card.setName ? ' · ' + card.setName : ''}`}
              >
                {card.imageUrl || card.imageLarge ? (
                  <img src={card.imageUrl || card.imageLarge} alt={card.name} loading="lazy" />
                ) : (
                  <span className="col-noart">{card.name}</span>
                )}
                {(card.qty || 1) > 1 && <span className="col-qty">×{card.qty}</span>}
              </button>
              <button
                type="button"
                className="col-remove"
                aria-label={`Remove one ${card.name}`}
                onClick={() => setCards(removeOne(card))}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <div className="col-name">{card.name}</div>
            </div>
          ))}
        </div>
      )}

      <CardLightbox
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        imageUrl={viewing?.imageLarge || viewing?.imageUrl}
        cardName={viewing?.name}
        onRemove={viewing ? () => {
          const c = viewing;
          setViewing(null);
          setCards(removeAll(c));
        } : null}
      />
    </div>
  );
}
