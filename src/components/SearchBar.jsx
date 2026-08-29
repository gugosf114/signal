import React, { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { scanCardImage } from '../services/scanCardImage';
import { looksLikeYgoPasscode, resolvePrintingOptions, suggestCards } from '../services/fetchExpansions';
import { looksLikeSetCode, lookupBySetCode } from '../services/lookupBySetCode';
import { withScanKeepAlive } from '../services/scanKeepAlive';
import { addTcgplayerPrice } from '../services/fetchTcgplayerPrice';
import { fetchCardImage } from '../services/fetchCardImage';
import { scannerMatchDetails, scannerMatchMeta, scannerMatchPrice } from '../services/scannerMatch';
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

const LOOKUP_MODES = [
  {
    id: 'price',
    label: 'Price only',
    detail: 'Fast · no full-report charge',
  },
  {
    id: 'full',
    label: 'Run full Signal',
    detail: 'About one minute · paid analysis',
  },
];

function LookupModeChooser({ value, onChange, disabled }) {
  return (
    <div className="lookup-mode-block">
      <div className="lookup-mode-label">Choose lookup</div>
      <div className="lookup-mode-options" role="radiogroup" aria-label="Choose price only or full Signal">
        {LOOKUP_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={value === mode.id}
            className={`lookup-mode-option lookup-mode-option--${mode.id}${value === mode.id ? ' lookup-mode-option--on' : ''}`}
            disabled={disabled}
            onClick={() => onChange(mode.id)}
          >
            <strong>{mode.label}</strong>
            <span>{mode.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickPriceResult({ card, onAdd, onDone }) {
  const details = scannerMatchDetails({ card, pin: card });
  return (
    <section className="quick-price-result" aria-label="Price lookup complete" aria-live="polite">
      <div className="quick-price-heading">
        <strong>Price lookup complete</strong>
        <span>No full Signal report ran</span>
      </div>
      <div className="quick-price-card">
        {details.imageUrl
          ? <img src={details.imageUrl} alt={details.name} />
          : <span className="quick-price-noart" aria-hidden>?</span>}
        <div>
          <strong>{details.name}</strong>
          <span>{details.gameLabel}</span>
          <small>{scannerMatchMeta(details)}</small>
        </div>
        <b>{scannerMatchPrice(details)}</b>
      </div>
      <div className="quick-price-actions">
        {onAdd && <button type="button" className="quick-price-add" onClick={onAdd}>Add to collection</button>}
        <button type="button" className="quick-price-done" onClick={onDone}>Done · Price only</button>
      </div>
    </section>
  );
}

async function withResolvedCardImage(pin, fallbackCard = null) {
  if (!pin) return pin;
  const name = pin.name || fallbackCard?.name;
  const game = pin.game || fallbackCard?.game || null;
  const tcgplayerImage = pin.tcgplayerImageUrl || null;
  const catalogueImage = tcgplayerImage || await fetchCardImage(name, game, {
    ...pin,
    scanImagePath: null,
    preferExactOwnerArt: game === 'yugioh',
  }).catch(() => null);
  return {
    ...pin,
    scanImagePath: null,
    imageUrl: catalogueImage,
    imageLarge: catalogueImage,
    imageSource: tcgplayerImage ? 'tcgplayer' : (catalogueImage ? 'exact-catalogue' : null),
  };
}

export default function SearchBar({ onSearch, onCardFound = null, onScannerAdd = null, onScannerBatch = null, loading = false }) {
  const [lookupMode, setLookupMode] = useState(null);
  const [quickResult, setQuickResult] = useState(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState('single');
  const [scannerSession, setScannerSession] = useState(0);
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

  const routeResolvedCard = async (pricedCard) => {
    const resolvedCard = await withResolvedCardImage(pricedCard);
    reqToken.current += 1;
    quietFor.current = resolvedCard.name;
    setSuggestions([]);
    setOpen(false);
    setActive(-1);
    if (lookupMode === 'price') {
      setQuery('');
      setQuickResult(resolvedCard);
      return;
    }
    if (lookupMode !== 'full') {
      setScanError('Choose Price Only or Run Full Signal first.');
      return;
    }
    if (!onSearch) throw new Error('Full Signal is unavailable.');
    setQuery(resolvedCard.name);
    await onSearch(resolvedCard.name, resolvedCard.game, {
      pin: resolvedCard,
      force: resolvedCard.priceSource === 'TCGplayer',
    });
  };

  const pick = async (card) => {
    if (!lookupMode) {
      setScanError('Choose Price Only or Run Full Signal first.');
      return;
    }
    setResolving(true);
    try {
      const pricedCard = await addTcgplayerPrice(
        card,
        undefined,
        { requireProductId: card.game === 'yugioh' },
      );
      await routeResolvedCard(pricedCard);
    } finally {
      setResolving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!lookupMode) {
      setScanError('Choose Price Only or Run Full Signal first.');
      return;
    }
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
      setResolving(true);
      try {
        const hit = await lookupBySetCode(query.trim());
        if (!hit) {
          setScanError('That exact card number was not found.');
          return;
        }
        const priced = await addTcgplayerPrice(
          hit,
          undefined,
          { requireProductId: hit.game === 'yugioh' },
        );
        await routeResolvedCard(priced);
      } catch {
        setScanError('The card catalogues could not load. Try again.');
      } finally {
        setResolving(false);
      }
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
    const candidates = await Promise.all(options.map((option) => addTcgplayerPrice(
      option,
      signal,
      { requireProductId: option.game === 'yugioh' },
    )));
    return {
      card,
      pin: candidates.length === 1 ? candidates[0] : null,
      candidates,
      file,
    };
  });

  const openPhotoMenu = () => {
    if (!lookupMode) {
      setScanError('Choose Price Only or Run Full Signal first.');
      return;
    }
    setScanError(null);
    setOpen(false);
    setPhotoMenuOpen((value) => !value);
  };

  const scanCard = () => {
    setPhotoMenuOpen(false);
    setScannerMode('single');
    setScannerSession((value) => value + 1);
    setScannerOpen(true);
  };

  const batchScan = () => {
    setPhotoMenuOpen(false);
    setScannerMode('batch');
    setScannerSession((value) => value + 1);
    setScannerOpen(true);
  };

  const uploadPhoto = () => {
    setPhotoMenuOpen(false);
    // Mount the shared scanner before clicking its hidden file input. Keeping
    // both operations inside this tap preserves Android's file-picker gesture.
    flushSync(() => {
      setScannerMode('single');
      setScannerSession((value) => value + 1);
      setScannerOpen(true);
    });
    scannerRef.current?.choosePhoto();
  };

  const preparePhotoMatch = async ({ card, pin }) => {
    if (!pin) return;
    const exactName = pin.name || card.name;
    const exactPin = await withResolvedCardImage(pin, card);
    return { card, exactPin, exactName };
  };

  const finishPhotoMatch = async (match, action) => {
    const prepared = await preparePhotoMatch(match);
    if (!prepared) return;
    const { card, exactPin, exactName } = prepared;
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

  const finishPhotoBatch = async (entries) => {
    if (!onScannerBatch) throw new Error('Batch Collection is unavailable.');
    const prepared = [];
    for (const entry of entries || []) {
      const exact = await preparePhotoMatch(entry.match);
      if (!exact) continue;
      prepared.push({
        card: exact.exactPin,
        details: {
          quantity: entry.quantity,
          condition: entry.condition,
          form: entry.form,
        },
      });
    }
    if (!prepared.length) return;
    setScannerOpen(false);
    setQuery('');
    await onScannerBatch(prepared);
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

  const chooseLookupMode = (mode) => {
    setLookupMode(mode);
    setQuickResult(null);
    setScanError(null);
    setPhotoMenuOpen(false);
  };

  const addQuickResult = async () => {
    const add = onScannerAdd || onCardFound;
    if (!add || !quickResult) return;
    setResolving(true);
    try {
      await add(quickResult);
      setQuickResult(null);
    } finally {
      setResolving(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} style={{
      position: 'relative',
      width: '100%',
      maxWidth: 580,
    }}>
      <LookupModeChooser value={lookupMode} onChange={chooseLookupMode} disabled={busy} />
      <div style={{ position: 'relative', width: '100%' }}>
        {/* Signal and Collection use this same two-choice photo menu. */}
        <button
          type="button"
          onClick={openPhotoMenu}
          disabled={busy || !lookupMode}
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
            cursor: busy || !lookupMode ? 'not-allowed' : 'pointer',
            opacity: lookupMode ? 1 : 0.35,
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
            <button type="button" role="menuitem" onClick={batchScan}>
              <span className="photo-choice-icon" aria-hidden>＋</span>
              <span><strong>Batch scan</strong><small>Camera or select many photos</small></span>
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
          onChange={(e) => { setQuery(e.target.value); setQuickResult(null); setScanError(null); }}
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
          placeholder={lookupMode ? 'Card name, number, or name + last digits' : 'Choose a lookup above first'}
          disabled={busy || !lookupMode}
          enterKeyHint="search"
          style={{
            width: '100%',
            padding: '16px 18px 16px 50px',
            background: 'var(--signal-panel)',
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
        {!lookupMode
          ? 'Choose the fast price lane or the full Signal report first.'
          : lookupMode === 'price'
            ? 'Price Only: exact printing and current market price.'
            : 'Full Signal: confirm the exact printing before the paid report runs.'}
      </div>

      {quickResult && (
        <QuickPriceResult
          card={quickResult}
          onAdd={(onScannerAdd || onCardFound) ? addQuickResult : null}
          onDone={() => setQuickResult(null)}
        />
      )}

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
        key={scannerSession}
        ref={scannerRef}
        open={scannerOpen}
        mode={scannerMode}
        lookupMode={lookupMode}
        onCancel={() => setScannerOpen(false)}
        onIdentify={identifyPhoto}
        onAdd={(match) => finishPhotoMatch(match, 'add')}
        onRun={(match) => finishPhotoMatch(match, 'run')}
        onBatchAdd={finishPhotoBatch}
        onManualSearch={searchPhotoMatch}
      />
    </form>
  );
}
