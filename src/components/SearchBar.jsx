import React, { useState, useRef, useEffect } from 'react';
import { scanCardImage } from '../services/scanCardImage';
import { suggestCards, resolvePrinting } from '../services/fetchExpansions';
import { looksLikeSetCode } from '../services/lookupBySetCode';
import { saveScannedCardImage } from '../services/scannedCardImage';
import { withScanKeepAlive } from '../services/scanKeepAlive';
import CardScanner from './CardScanner';

// ─── Suggestions ─────────────────────────────────────────────────────────────
// Typing "Charizard" and hitting Enter used to scan whatever printing the API
// happened to hand back first — out of hundreds. The dropdown makes the
// printing an explicit choice: pick a row and the scan is pinned to that exact
// card (set + number), not to the name.
//
// Sources are the three free catalogues already powering the browse grid
// (pokemontcg.io / Scryfall / YGOPRODeck). No key, no cost, no Anthropic call.

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

const GAME_LABEL = { pokemon: 'PKM', mtg: 'MTG', yugioh: 'YGO' };

export default function SearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const fileInputRef = useRef(null);
  const photoMenuRef = useRef(null);
  const formRef = useRef(null);
  // Bumped on every keystroke and every pick, so a slow catalogue reply that
  // lands after the user moved on can't repopulate the list.
  const reqToken = useRef(0);
  // The exact text we already acted on. Holding the string rather than a
  // one-shot flag matters: `loading` flips twice per scan, so a flag gets
  // consumed on the way in and the dropdown pops open again over the finished
  // result. The list stays shut until the user actually types something else.
  const quietFor = useRef(null);

  useEffect(() => {
    const q = query.trim();
    if (q && q === quietFor.current) { setOpen(false); return; }
    if (q.length < MIN_CHARS || loading || identifying) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const myToken = ++reqToken.current;
    const timer = setTimeout(async () => {
      try {
        const hits = await suggestCards(q, 8);
        if (myToken !== reqToken.current) return;
        setSuggestions(hits);
        setActive(-1);
        setOpen(hits.length > 0);
      } catch {
        if (myToken !== reqToken.current) return;
        setSuggestions([]);
        setOpen(false);
        setActive(-1);
        setScanError('Card catalogues could not load. Try again.');
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, loading, identifying]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e) => {
      if (!formRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDocDown);
    return () => document.removeEventListener('pointerdown', onDocDown);
  }, [open]);

  useEffect(() => {
    if (!photoMenuOpen) return;
    const close = (event) => {
      if (!photoMenuRef.current?.contains(event.target)) setPhotoMenuOpen(false);
    };
    const escape = (event) => { if (event.key === 'Escape') setPhotoMenuOpen(false); };
    document.addEventListener('pointerdown', close);
    window.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', escape);
    };
  }, [photoMenuOpen]);

  const pick = (card) => {
    reqToken.current += 1;
    quietFor.current = card.name;
    setQuery(card.name);
    setSuggestions([]);
    setOpen(false);
    setActive(-1);
    // The whole row travels with the search: `pin` is what stops the scan from
    // guessing a printing.
    onSearch(card.name, card.game, { pin: card });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (open && active >= 0 && suggestions[active]) {
      pick(suggestions[active]);
      return;
    }
    if (query.trim() && !loading) {
      if (suggestions.length === 1) {
        pick(suggestions[0]);
        return;
      }
      if (!looksLikeSetCode(query.trim())) {
        setScanError(suggestions.length > 1
          ? 'Choose the exact printing from the list.'
          : 'Wait for the catalogue, then choose the exact printing.');
        setOpen(suggestions.length > 0);
        return;
      }
      reqToken.current += 1;
      quietFor.current = query.trim();
      setOpen(false);
      onSearch(query.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  const identifyFile = (file, framed = false) => withScanKeepAlive(async () => {
      const card = await scanCardImage(file, { framed });
      // The photo showed one specific printing and the scanner read its set and
      // number off the card. Turn that into a catalogue row so the scan is
      // pinned to the card actually photographed — otherwise a picture of the
      // $1,499 Umbreon ex and a picture of the $7 one produce the same answer.
      const pin = await resolvePrinting(card).catch(() => null);
      if (!pin) throw new Error('The exact printing could not be matched. Search by set and card number.');
      // Keep one small local copy of the photographed card. Konami's official
      // alternate-art images carry a permanent SAMPLE watermark; the owner's
      // own scan is both exact and clean, and survives app restarts.
      const scanImagePath = await saveScannedCardImage(file, pin).catch(() => null);
      const exactPin = scanImagePath ? { ...pin, scanImagePath } : pin;
      // The camera already identified one specific card; don't turn its name
      // back into a list of alternatives.
      reqToken.current += 1;
      quietFor.current = card.name;
      setQuery(card.name);
      setOpen(false);
      await onSearch(card.name, exactPin.game || card.game || null, { pin: exactPin });
  });

  const openPhotoMenu = () => {
    setScanError(null);
    setOpen(false);
    setPhotoMenuOpen((value) => !value);
  };

  const takePhoto = () => {
    setPhotoMenuOpen(false);
    setScanError(null);
    setScannerOpen(true);
  };

  const handleScannerCapture = async (file) => {
    setScannerOpen(false);
    setIdentifying(true);
    try {
      await identifyFile(file, true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[signal] card image scan failed', err);
      setScanError(err?.message || 'Card identification failed.');
    } finally {
      setIdentifying(false);
    }
  };

  const uploadPhoto = () => {
    setPhotoMenuOpen(false);
    setScanError(null);
    fileInputRef.current?.click();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIdentifying(true);
    setScanError(null);
    try {
      await identifyFile(file);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[signal] card image scan failed', err);
      setScanError(err?.message || 'Card identification failed.');
    } finally {
      setIdentifying(false);
      if (e.target) e.target.value = '';
    }
  };

  const busy = loading || identifying;

  return (
    <form ref={formRef} onSubmit={handleSubmit} style={{
      position: 'relative',
      width: '100%',
      maxWidth: 580,
    }}>
      <div style={{ position: 'relative', width: '100%' }}>
        {/* Upload input never carries `capture`, so Upload always means gallery/files. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFile}
        />

        {/* Camera button — left side of the input */}
        <button
          type="button"
          onClick={openPhotoMenu}
          disabled={busy}
          aria-label="Choose scan or upload"
          aria-expanded={photoMenuOpen}
          aria-haspopup="menu"
          title="Scan or upload a card photo"
          style={{
            position: 'absolute',
            left: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 38,
            height: 38,
            background: 'transparent',
            border: 'none',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: identifying ? '#C44040' : '#A8A498',
            cursor: busy ? 'not-allowed' : 'pointer',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { if (!busy) e.currentTarget.style.color = '#C44040'; }}
          onMouseLeave={(e) => { if (!busy) e.currentTarget.style.color = '#A8A498'; }}
        >
          {identifying ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="cam-spin">
              <circle cx="12" cy="12" r="9" opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          )}
        </button>

        {photoMenuOpen && !busy && (
          <div ref={photoMenuRef} className="photo-choice-menu" role="menu" aria-label="Card photo source">
            <button type="button" role="menuitem" onClick={takePhoto}>
              <span className="photo-choice-icon" aria-hidden>◎</span>
              <span><strong>Scan card</strong><small>Open the camera</small></span>
            </button>
            <button type="button" role="menuitem" onClick={uploadPhoto}>
              <span className="photo-choice-icon" aria-hidden>↑</span>
              <span><strong>Upload photo</strong><small>Use a saved image</small></span>
            </button>
          </div>
        )}

        {/* No explicit submit button — camera icon on the left handles image scans,
            Enter key on the keyboard submits a typed card name. The previous
            "SCAN" submit button duplicated the camera affordance and made the
            two distinct entry paths read as one. */}
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setScanError(null); }}
          onKeyDown={handleKeyDown}
          onFocus={() => { setFocused(true); if (suggestions.length) setOpen(true); }}
          onBlur={() => setFocused(false)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="signal-card-suggestions"
          aria-activedescendant={active >= 0 ? `signal-card-option-${active}` : undefined}
          placeholder={identifying ? 'Identifying card…' : 'Card name, number, or name + last digits'}
          disabled={busy}
          enterKeyHint="search"
          style={{
            width: '100%',
            padding: '16px 18px 16px 50px',
            background: '#0E1014',
            border: `1px solid ${focused ? '#2A2D34' : '#1A1D24'}`,
            borderRadius: 3,
            color: '#E8E4DC',
            fontSize: 15,
            fontFamily: "'Syne', sans-serif",
            fontWeight: 400,
            outline: 'none',
            transition: 'border-color 0.2s',
            letterSpacing: '0.01em',
            boxSizing: 'border-box',
          }}
        />

        {open && suggestions.length > 0 && (
          <ul id="signal-card-suggestions" className="sb-list" role="listbox">
            {suggestions.map((card, i) => (
              <li key={`${card.game}-${card.printingId || card.id}-${i}`} role="presentation">
                <button
                  id={`signal-card-option-${i}`}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className={`sb-item ${i === active ? 'sb-item--on' : ''}`}
                  onClick={() => pick(card)}
                  onMouseEnter={() => setActive(i)}
                >
                  {card.imageUrl ? (
                    <img src={card.imageUrl} alt="" className="sb-thumb" loading="lazy" />
                  ) : (
                    <span className="sb-thumb sb-thumb--empty" />
                  )}
                  <span className="sb-text">
                    <span className="sb-name">{card.name}</span>
                    {/* The set line is the entire reason this dropdown exists. */}
                    <span className="sb-meta">
                      <span className="sb-game">{GAME_LABEL[card.game] || card.game}</span>
                      {card.setName || 'Unknown set'}
                      {card.number ? ` · ${card.number}` : ''}
                    </span>
                  </span>
                  {card.price != null && (
                    <span className="sb-price">${Number(card.price).toFixed(2)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: 6, fontSize: 9, color: '#605C54', fontFamily: "'JetBrains Mono', monospace", textAlign: 'left' }}>
        Scan a card, or type a name, number, or name + last digits.
      </div>

      {scanError && (
        <div style={{
          marginTop: 8,
          padding: '8px 12px',
          background: 'rgba(196, 64, 64, 0.08)',
          border: '1px solid rgba(196, 64, 64, 0.3)',
          borderRadius: 2,
          fontSize: 11,
          color: '#C44040',
          fontFamily: "'JetBrains Mono', monospace",
          lineHeight: 1.5,
        }}>
          {scanError}
        </div>
      )}

      <CardScanner
        open={scannerOpen}
        onCancel={() => setScannerOpen(false)}
        onCapture={handleScannerCapture}
      />
    </form>
  );
}
