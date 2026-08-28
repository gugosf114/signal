import React, { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { scanCardImage } from '../services/scanCardImage';
import { looksLikeYgoPasscode, resolvePrintingOptions, suggestCards } from '../services/fetchExpansions';
import { looksLikeSetCode, lookupBySetCode } from '../services/lookupBySetCode';
import { loadScannedCardImage, saveScannedCardImage } from '../services/scannedCardImage';
import { withScanKeepAlive } from '../services/scanKeepAlive';
import { addTcgplayerPrice } from '../services/fetchTcgplayerPrice';
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

export default function SearchBar({ onSearch, onCardFound = null, onScannerAdd = null, loading = false }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const formRef = useRef(null);
  const photoMenuRef = useRef(null);
  const scannerRef = useRef(null);
  // Bumped on every keystroke and every pick, so a slow catalogue reply that
  // lands after the user moved on can't repopulate the list.
  const reqToken = useRef(0);
  // The exact text we already acted on. Holding the string rather than a
  // one-shot flag matters: `loading` flips twice per scan, so a flag gets
  // consumed on the way in and the dropdown pops open again over the finished
  // result. The list stays shut until the user actually types something else.
  const quietFor = useRef(null);
  const scanSearchFor = useRef(null);

  useEffect(() => {
    const q = query.trim();
    if (q && q === quietFor.current) { setOpen(false); return; }
    if (q.length < MIN_CHARS || loading || scannerOpen) {
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
        if (scanSearchFor.current === q) {
          setScanError(hits.length ? null : 'No exact printing was found. Type the set code.');
          scanSearchFor.current = null;
        }
      } catch {
        if (myToken !== reqToken.current) return;
        setSuggestions([]);
        setOpen(false);
        setActive(-1);
        setScanError('Card catalogues could not load. Try again.');
        if (scanSearchFor.current === q) scanSearchFor.current = null;
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, loading, scannerOpen]);

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

  const pick = async (card) => {
    setResolving(true);
    try {
      const pricedCard = await addTcgplayerPrice(card);
      reqToken.current += 1;
      quietFor.current = pricedCard.name;
      setQuery(onCardFound ? '' : pricedCard.name);
      setSuggestions([]);
      setOpen(false);
      setActive(-1);
      if (onCardFound) await onCardFound(pricedCard);
      else onSearch?.(pricedCard.name, pricedCard.game, {
        pin: pricedCard,
        force: pricedCard.priceSource === 'TCGplayer',
      });
    } finally {
      setResolving(false);
    }
  };

  const handleSubmit = async (e) => {
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
      if (onCardFound) {
        setResolving(true);
        try {
          const hit = await lookupBySetCode(query.trim());
          if (!hit) {
            setScanError('That exact card number was not found.');
            return;
          }
          const priced = await addTcgplayerPrice(hit);
          setQuery('');
          await onCardFound(priced);
        } catch {
          setScanError('The card catalogues could not load. Try again.');
        } finally {
          setResolving(false);
        }
      } else onSearch?.(query.trim());
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

  const identifyPhoto = (file, { framed = false, signal } = {}) => withScanKeepAlive(async () => {
    const card = await scanCardImage(file, { framed, signal });
    // A camera guess is not yet a printing. Resolve it against the live card
    // catalogues, then show the match before spending money on the full report.
    const options = await resolvePrintingOptions(card).catch(() => []);
    const candidates = await Promise.all(options.map((option) => addTcgplayerPrice(option, signal)));
    return {
      card,
      pin: candidates.length === 1 ? candidates[0] : null,
      candidates,
      file,
    };
  });

  const openPhotoMenu = () => {
    setScanError(null);
    setOpen(false);
    setPhotoMenuOpen((value) => !value);
  };

  const scanCard = () => {
    setPhotoMenuOpen(false);
    setScannerOpen(true);
  };

  const uploadPhoto = () => {
    setPhotoMenuOpen(false);
    // Mount the shared scanner before clicking its hidden file input. Keeping
    // both operations inside this tap preserves Android's file-picker gesture.
    flushSync(() => setScannerOpen(true));
    scannerRef.current?.choosePhoto();
  };

  const finishPhotoMatch = async ({ card, pin, file }, action) => {
    if (!pin) return;
    // Save the owner's exact card only after the match is confirmed. A wrong
    // guess must never replace the art for a different printing.
    const scanImagePath = await saveScannedCardImage(file, pin).catch(() => null);
    const localImageUrl = scanImagePath ? await loadScannedCardImage(scanImagePath).catch(() => null) : null;
    const exactPin = scanImagePath ? {
      ...pin,
      scanImagePath,
      imageUrl: pin.imageUrl || localImageUrl,
      imageLarge: pin.imageLarge || localImageUrl,
    } : pin;
    const exactName = exactPin.name || card.name;
    reqToken.current += 1;
    quietFor.current = exactName;
    setQuery(action === 'add' ? '' : exactName);
    setOpen(false);
    setScannerOpen(false);
    if (action === 'add') {
      const add = onScannerAdd || onCardFound;
      if (!add) throw new Error('Adding to Collection is unavailable.');
      await add(exactPin);
      return;
    }
    if (!onSearch) throw new Error('Full Signal is unavailable.');
    await onSearch(exactName, exactPin.game || card.game || null, {
      pin: exactPin,
      // A newly found exact market price must replace a cached report whose
      // price was blank. Otherwise the match sheet shows money and the report
      // immediately erases it again.
      force: exactPin.priceSource === 'TCGplayer',
    });
  };

  const searchPhotoMatch = ({ card } = {}) => {
    const lookupValue = card?.number || card?.passcode || '';
    const name = looksLikeSetCode(lookupValue) || looksLikeYgoPasscode(lookupValue)
      ? lookupValue
      : (card?.name || '');
    reqToken.current += 1;
    quietFor.current = null;
    scanSearchFor.current = name;
    setQuery(name);
    setOpen(false);
    setScannerOpen(false);
    setScanError('Finding the exact printing…');
  };

  const busy = loading || resolving;

  return (
    <form ref={formRef} onSubmit={handleSubmit} style={{
      position: 'relative',
      width: '100%',
      maxWidth: 580,
    }}>
      <div style={{ position: 'relative', width: '100%' }}>
        {/* Signal and Collection use this same two-choice photo menu. */}
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
            color: '#A8A498',
            cursor: busy ? 'not-allowed' : 'pointer',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { if (!busy) e.currentTarget.style.color = '#C44040'; }}
          onMouseLeave={(e) => { if (!busy) e.currentTarget.style.color = '#A8A498'; }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>

        {photoMenuOpen && !busy && (
          <div ref={photoMenuRef} className="photo-choice-menu" role="menu" aria-label="Card photo source">
            <button type="button" role="menuitem" onClick={scanCard}>
              <span className="photo-choice-icon" aria-hidden>◎</span>
              <span><strong>Scan card</strong><small>Open the live camera</small></span>
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
          placeholder="Card name, number, or name + last digits"
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
        ref={scannerRef}
        open={scannerOpen}
        onCancel={() => setScannerOpen(false)}
        onIdentify={identifyPhoto}
        onAdd={(match) => finishPhotoMatch(match, 'add')}
        onRun={(match) => finishPhotoMatch(match, 'run')}
        onManualSearch={searchPhotoMatch}
      />
    </form>
  );
}
