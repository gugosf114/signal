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
import pokeBallMark from '../assets/binders/poke-ball.png';
import yugiohTcgLogo from '../assets/binders/yugioh-tcg-logo.png';
import magicLogo from '../assets/binders/magic-logo.png';

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
  const marks = {
    pokemon: { src: pokeBallMark, alt: '' },
    yugioh: { src: yugiohTcgLogo, alt: '' },
    mtg: { src: magicLogo, alt: '' },
  };

  if (id === 'all') return (
    <span className="col-binder-art-stack">
      <img className="col-binder-mark col-binder-mark--pokemon" src={pokeBallMark} alt="" />
      <img className="col-binder-mark col-binder-mark--yugioh" src={yugiohTcgLogo} alt="" />
      <img className="col-binder-mark col-binder-mark--mtg" src={magicLogo} alt="" />
    </span>
  );

  return <img className={`col-binder-mark col-binder-mark--${id}`} src={marks[id].src} alt={marks[id].alt} />;
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
