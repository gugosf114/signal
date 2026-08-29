import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadCollection, saveCollection, importCollection, addOne, removeOne, removeAll,
  countCards, collectionValueSummary, cardKey,
  collectionFormLabel, formatCollectionMoney,
  collectionView,
} from '../services/collection';
import {
  parseCollectionBackup, saveCollectionBackup, saveCollectionCsv,
} from '../services/collectionFiles';
import {
  addTcgplayerPrice,
  fetchTcgplayerPrice,
  tcgplayerProductImageUrl,
} from '../services/fetchTcgplayerPrice';
import { fetchCardImage } from '../services/fetchCardImage';
import CardLightbox from './CardLightbox';
import CardBrowser from './CardBrowser';
import SearchBar from './SearchBar';

const CONDITION_LABEL = {
  near_mint: 'Near mint',
  lightly_played: 'Lightly played',
  moderately_played: 'Moderately played',
  heavily_played: 'Heavily played',
  damaged: 'Damaged',
};

const BINDERS = [
  { id: 'all', label: 'All cards' },
  { id: 'pokemon', label: 'Pokémon' },
  { id: 'yugioh', label: 'Yu-Gi-Oh!' },
  { id: 'mtg', label: 'MTG' },
];

function BinderArt({ id }) {
  if (id === 'pokemon') return (
    <svg viewBox="0 0 150 88" fill="none">
      <circle cx="103" cy="44" r="31" stroke="currentColor" strokeWidth="3" />
      <path d="M73 42h60M76 31q27-27 54 0" stroke="#D55A55" strokeWidth="8" opacity=".7" />
      <path d="M77 58q26 24 52 0" stroke="#5C79B8" strokeWidth="6" opacity=".55" />
      <circle cx="103" cy="44" r="10" fill="var(--signal-tile)" stroke="currentColor" strokeWidth="3" />
      <circle cx="103" cy="44" r="4" fill="currentColor" />
    </svg>
  );
  if (id === 'yugioh') return (
    <svg viewBox="0 0 150 88" fill="none">
      <path d="M66 46c9-28 56-31 68-1 10 25-20 41-42 31-18-8-12-32 7-35 15-3 25 14 15 24-8 8-24 1-21-10" stroke="currentColor" strokeWidth="3" opacity=".85" />
      <path d="m101 18 18 27-18 26-18-26z" stroke="#D7A766" strokeWidth="2" opacity=".65" />
      <path d="M78 45q23-19 47 0-24 20-47 0Z" fill="currentColor" fillOpacity=".13" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="102" cy="45" r="6" fill="#D7A766" opacity=".72" />
    </svg>
  );
  if (id === 'mtg') return (
    <svg viewBox="0 0 150 88" fill="none">
      <path d="M105 12c8 17 3 26-1 33 8-5 13-13 13-22 15 16 18 38 5 51-11 11-34 10-44-3-10-14-2-32 8-43-1 11 3 19 9 23-2-14 1-28 10-39Z" fill="currentColor" fillOpacity=".38" stroke="currentColor" strokeWidth="2.5" />
      <path d="M103 37c5 10 3 16 0 21 6-3 9-8 10-14 7 10 7 20 1 27-6 7-18 7-24 0-7-9-1-21 6-27-1 8 2 13 7 16-2-8-2-15 0-23Z" fill="#E8A15D" opacity=".62" />
    </svg>
  );
  return (
    <svg viewBox="0 0 150 88" fill="none">
      <text x="101" y="61" textAnchor="middle" fontSize="49" fontWeight="900" fill="currentColor" opacity=".16" fontFamily="'Noto Sans JP', sans-serif">株</text>
      <g stroke="currentColor" strokeWidth="2">
        <rect x="58" y="22" width="34" height="48" rx="3" transform="rotate(-13 58 22)" fill="var(--signal-panel)" fillOpacity=".72" />
        <rect x="80" y="17" width="34" height="50" rx="3" fill="var(--signal-panel)" fillOpacity=".82" />
        <rect x="105" y="22" width="34" height="48" rx="3" transform="rotate(13 105 22)" fill="var(--signal-panel)" fillOpacity=".72" />
      </g>
      <circle cx="76" cy="44" r="8" stroke="#D8C14B" strokeWidth="2" /><path d="M68 44h16" stroke="#D8C14B" />
      <path d="M92 47c4-11 19-11 23 0-5 9-18 9-23 0Z" stroke="#A9785D" strokeWidth="1.5" />
      <path d="M121 36c5 9 2 14-1 18 6-4 8-8 8-13 8 9 6 20-3 23-9 3-17-6-12-15 0 5 2 8 5 10-1-8 0-16 3-23Z" fill="#B96947" opacity=".68" />
    </svg>
  );
}

const SORTS = [
  { id: 'newest', label: 'Newest added' },
  { id: 'oldest', label: 'Oldest added' },
  { id: 'price_high', label: 'Price high → low' },
  { id: 'price_low', label: 'Price low → high' },
];

function addedLabel(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Collection({ onLookup, onAddCard, onAddBatch }) {
  const [cards, setCards] = useState(() => loadCollection());
  const [status, setStatus] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [binder, setBinder] = useState('all');
  const [sort, setSort] = useState('newest');
  const importRef = useRef(null);
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

  useEffect(() => {
    const unresolved = cards.filter((card) => (
      (!card.imageUrl && !card.imageLarge)
      || (card.game === 'yugioh' && !['tcgplayer', 'exact-catalogue'].includes(card.imageSource))
    )).slice(0, 12);
    if (!unresolved.length) return undefined;
    let cancelled = false;
    Promise.all(unresolved.map(async (card) => {
      let productId = null;
      let imageUrl = null;
      let imageSource = null;
      if (card.game === 'yugioh') {
        const exactProduct = await fetchTcgplayerPrice(card).catch(() => null);
        productId = exactProduct?.productId || null;
        imageUrl = tcgplayerProductImageUrl(productId);
        if (imageUrl) imageSource = 'tcgplayer';
      }
      if (!imageUrl) {
        imageUrl = await fetchCardImage(card.name, card.game, {
          ...card,
          scanImagePath: null,
          preferExactOwnerArt: card.game === 'yugioh',
        }).catch(() => null);
        if (imageUrl) imageSource = 'exact-catalogue';
      }
      return [cardKey(card), imageUrl ? { imageUrl, imageSource, productId } : null];
    })).then((resolved) => {
      if (cancelled) return;
      const images = new Map(resolved.filter(([, value]) => value));
      if (!images.size) return;
      setCards((current) => saveCollection(current.map((card) => {
        const image = images.get(cardKey(card));
        return image ? {
          ...card,
          imageUrl: image.imageUrl,
          imageLarge: image.imageUrl,
          imageSource: image.imageSource,
          scanImagePath: null,
          tcgplayerProductId: image.productId || card.tcgplayerProductId || null,
          tcgplayerImageUrl: image.imageSource === 'tcgplayer' ? image.imageUrl : null,
        } : card;
      })));
    });
    return () => { cancelled = true; };
  }, [cards]);

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  const flash = useCallback((kind, text) => {
    setStatus({ kind, text });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setStatus((value) => value?.text === text ? null : value), 4200);
  }, []);

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

  const visibleCards = useMemo(() => collectionView(cards, binder, sort), [cards, binder, sort]);
  const binderCounts = useMemo(() => Object.fromEntries(BINDERS.map(({ id }) => [
    id,
    countCards(id === 'all' ? cards : cards.filter((card) => card.game === id)),
  ])), [cards]);
  const activeBinder = BINDERS.find((item) => item.id === binder) || BINDERS[0];
  const total = countCards(visibleCards);
  const market = collectionValueSummary(visibleCards);
  const marketDisplay = market.pricedQty > 0
    ? `${formatCollectionMoney(market.total)}${market.unpricedQty > 0 ? '+' : ''}`
    : (market.unpricedQty > 0 ? '—' : '$0.00');
  const holdingMeta = (card) => {
    const details = [];
    if (card.game === 'yugioh' && card.rarity) details.push(card.rarity);
    details.push(CONDITION_LABEL[card.condition] || 'Near mint');
    const formLabel = collectionFormLabel(card.game, card.form);
    if (formLabel) details.push(formLabel);
    return details.join(' · ');
  };

  return (
    <div>
      <div className="col-intro">
        Scan or search an exact printing, then add your copy here.
      </div>

      <div className="col-finder">
        <SearchBar
          onSearch={onLookup}
          onCardFound={(card) => onAddCard?.(card)}
          onScannerAdd={(card) => onAddCard?.(card)}
          onScannerBatch={onAddBatch}
        />
      </div>

      {status && (
        <div className={`col-status ${status.kind === 'bad' ? 'col-status--bad' : ''}`}>{status.text}</div>
      )}

      <input ref={importRef} type="file" accept="application/json,.json" onChange={restoreBackup} hidden />

      <div className="col-binders" role="tablist" aria-label="Collection binders">
        {BINDERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={binder === item.id}
            className={`col-binder col-binder--${item.id}${binder === item.id ? ' col-binder--on' : ''}`}
            onClick={() => setBinder(item.id)}
          >
            <span className="col-binder-art" aria-hidden="true"><BinderArt id={item.id} /></span>
            <strong>{item.label}</strong>
            <span>{binderCounts[item.id]} card{binderCounts[item.id] === 1 ? '' : 's'}</span>
          </button>
        ))}
      </div>

      <div className="col-summary">
        <div>
          <span className="col-summary-label">{activeBinder.label} · cards</span>
          <strong>{total}</strong>
        </div>
        <div>
          <span className="col-summary-label">{activeBinder.label} · market total</span>
          <strong>{marketDisplay}</strong>
          {market.unpricedQty > 0 && (
            <small className="col-summary-note">{market.unpricedQty} unpriced</small>
          )}
        </div>
      </div>

      <div className="col-view-controls">
        <div>
          <span>Viewing</span>
          <strong>{activeBinder.label}</strong>
        </div>
        <label>
          <span>Sort</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            {SORTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
      </div>

      <div className="col-tools">
        <button type="button" onClick={() => saveFile('backup')} disabled={!cards.length}>Backup</button>
        <button type="button" onClick={() => saveFile('csv')} disabled={!cards.length}>Export CSV</button>
        <button type="button" onClick={() => importRef.current?.click()}>Restore</button>
      </div>

      {cards.length === 0 ? (
        <div className="col-empty">
          <div className="col-empty-mark" aria-hidden="true"><span /><span /></div>
          <strong>No cards saved yet</strong>
          <p>Use the scanner or search above to add your first card.</p>
        </div>
      ) : visibleCards.length === 0 ? (
        <div className="col-empty col-empty--binder">
          <div className="col-empty-mark" aria-hidden="true"><span /><span /></div>
          <strong>No {activeBinder.label} cards yet</strong>
          <p>Cards from this game will appear in this binder after you add them.</p>
        </div>
      ) : (
        <div className="col-grid">
          {visibleCards.map((card) => (
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
              </button>
              <div className="col-count-control" role="group" aria-label={`Quantity for ${card.name}`}>
                <button
                  type="button"
                  aria-label={`Remove one ${card.name}`}
                  onClick={() => setCards(removeOne(card))}
                >−</button>
                <span aria-live="polite">{card.qty}</span>
                <button
                  type="button"
                  aria-label={`Add one ${card.name}`}
                  onClick={() => setCards(addOne(card))}
                >+</button>
              </div>
              <div className="col-name">{card.name}</div>
              <div className="col-card-meta">
                <strong>{formatCollectionMoney(card.marketPrice)}</strong>
                <span>{holdingMeta(card)}</span>
                {card.paidPerCard != null && <span>Paid {formatCollectionMoney(card.paidPerCard)}</span>}
                <span>Added {addedLabel(card.addedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <CardBrowser
        actionLabel="Add to collection"
        onCardSelect={async (_name, _game, options = {}) => {
          if (options.pin) onAddCard?.(await addTcgplayerPrice(
            options.pin,
            undefined,
            { requireProductId: options.pin.game === 'yugioh' },
          ));
        }}
      />

      <CardLightbox
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        imageUrl={viewing?.imageLarge || viewing?.imageUrl}
        cardName={viewing?.name}
        cardMeta={viewing ? [
          [viewing.setName, viewing.number].filter(Boolean).join(' · '),
          `${formatCollectionMoney(viewing.marketPrice)} each`,
          `${viewing.qty} cop${viewing.qty === 1 ? 'y' : 'ies'}`,
          holdingMeta(viewing),
          `Added ${addedLabel(viewing.addedAt)}`,
        ].filter(Boolean).join('  ·  ') : null}
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
