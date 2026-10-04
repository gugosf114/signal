import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadCollection, saveCollection, importCollection, removeAll, updateCollectionCard, collectionPriceStatus,
  countCards, collectionValueSummary, cardKey,
  collectionFormLabel, formatCollectionMoney, marketPriceFor,
  topPricedCollectionCards,
  collectionView,
  applyCollectionPricePatch,
  collectionPriceNeedsRefresh,
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
import CollectionCardDetails from './CollectionCardDetails';
import { resolvePrintingOptions } from '../services/fetchExpansions';
import { resolveCardProductImage } from '../services/mtgCardImage';
import CardBrowser from './CardBrowser';
import SearchBar from './SearchBar';
import CollectionCurrencies from './CollectionCurrencies';
import ScrollReveal from './ScrollReveal';
import { printingIdentity, printingNumber } from '../services/printing';
import { normalizeCardRecord, stampCardPrice } from '../services/cardRecord';
import { isExactScanTarget } from '../services/scanIdentity';
import { refreshPrices } from '../services/refreshPrices';
import pokeBallMark from '../assets/binders/poke-ball.svg';
import yugiohTcgLogo from '../assets/binders/yugioh-tcg-logo.png';
import magicLogo from '../assets/binders/magic-logo.png';
import gollumRing from '../assets/binders/gollum-ring.png';

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
    <img className="col-binder-mark col-binder-mark--all" src={gollumRing} alt="" />
  );

  return <img className={`col-binder-mark col-binder-mark--${id}`} src={marks[id].src} alt={marks[id].alt} />;
}

const SORTS = [
  { id: 'newest', label: 'Newest added' },
  { id: 'oldest', label: 'Oldest added' },
  { id: 'price_high', label: 'Price high → low' },
  { id: 'price_low', label: 'Price low → high' },
];

export default function Collection({
  onLookup,
  onAddCard,
  onAddBatch,
  entryActive = false,
}) {
  const [cards, setCards] = useState(() => loadCollection());
  const [status, setStatus] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [refreshingPrices, setRefreshingPrices] = useState(0);
  const [binder, setBinder] = useState('all');
  const [sort, setSort] = useState('newest');
  const importRef = useRef(null);
  const flashTimer = useRef(null);
  const priceRefreshAttempted = useRef(new Set());
  const mountedRef = useRef(true);

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

  useEffect(() => {
    const unique = new Map();
    for (const card of cards) {
      const key = printingIdentity(card);
      if (key && !unique.has(key)) unique.set(key, card);
    }
    const stale = [...unique.entries()].filter(([key, card]) => {
      return isExactScanTarget(card.game, card)
        && collectionPriceNeedsRefresh(card)
        && !priceRefreshAttempted.current.has(key);
    }).slice(0, 12);
    if (!stale.length) return undefined;
    for (const [key] of stale) priceRefreshAttempted.current.add(key);
    setRefreshingPrices((count) => count + stale.length);
    Promise.all(stale.map(async ([key, card]) => [
      key,
      await refreshPrices(card.name, card.game, card).catch(() => null),
    ])).then((updates) => {
      if (!mountedRef.current) return;
      setRefreshingPrices((count) => Math.max(0, count - stale.length));
      const byKey = new Map(updates.filter(([, patch]) => patch));
      if (!byKey.size) return;
      setCards((current) => saveCollection(current.map((card) => {
        const patch = byKey.get(printingIdentity(card));
        return patch ? applyCollectionPricePatch(card, patch) : card;
      })));
    });
    return undefined;
  }, [cards]);

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

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
  const priceStatus = collectionPriceStatus(visibleCards);
  const viewedCard = viewing ? cards.find((card) => cardKey(card) === cardKey(viewing)) || viewing : null;
  const checkedDate = (value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const topPricedCards = useMemo(() => topPricedCollectionCards(visibleCards, 3), [visibleCards]);
  const marketDisplay = market.pricedQty > 0
    ? `${formatCollectionMoney(market.total)}${market.unpricedQty > 0 ? '+' : ''}`
    : (market.unpricedQty > 0 ? '—' : '$0.00');
  const loadFinishes = async (card) => {
    const options = await resolvePrintingOptions({
      name: card.name, game: card.game, set: card.setId || card.setName,
      number: card.number, passcode: card.game === 'yugioh' ? card.id : null,
    });
    const number = (value) => String(value || '').split('/')[0].replace(/^0+(?=\d)/, '').toUpperCase();
    const exact = options.filter((option) => isExactScanTarget(option.game, option)
      && option.game === card.game && number(option.number) === number(card.number)
      && (card.game === 'yugioh' || (option.printingId || option.id) === (card.printingId || card.id)));
    return Promise.all(exact.map(async (option) => resolveCardProductImage(
      await addTcgplayerPrice(option, undefined, { requireProductId: option.game === 'yugioh' }),
    )));
  };

  return (
    <div className={`collection-page${entryActive ? ' collection-page--entry' : ''}`}>
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

      <ScrollReveal className="col-binders" role="tablist" aria-label="Collection binders">
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
      </ScrollReveal>

      <ScrollReveal delay={70} className="col-summary col-summary--stacked">
        <div className="col-summary-heading">
          <div className="col-summary-count">
            <span className="col-summary-label">{activeBinder.label}</span>
            <strong className="col-summary-count-value">{total} <small>cards</small></strong>
          </div>
          <div className="col-summary-market">
            <span className="col-summary-label">Market estimate</span>
            <strong className="col-summary-market-value">{marketDisplay}</strong>
          </div>
        </div>
        {topPricedCards.length > 0 && <div className="col-summary-highlights">
          <span className="col-summary-section-label">Highest priced · per card</span>
          <div className="col-top-cards" aria-label={`${activeBinder.label}: three highest unit-price cards`}>
            {topPricedCards.map((card, index) => {
              const imageUrl = card.imageUrl || card.imageLarge;
              return <button
                type="button"
                className="col-top-card"
                key={cardKey(card)}
                onClick={() => setViewing(card)}
                aria-label={`Open ${card.name} · ${formatCollectionMoney(marketPriceFor(card))} each`}
                style={{ '--top-card-entry-delay': `${0.72 + (index * 0.09)}s` }}
              >
                <span className="col-top-card-art">
                  <span className="col-top-card-noart" aria-hidden="true">?</span>
                  {imageUrl && <img src={imageUrl} alt={card.name} loading="eager" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                  <b aria-hidden="true">{index + 1}</b>
                </span>
                <span className="col-top-card-price">{formatCollectionMoney(marketPriceFor(card))}</span>
                <span className="col-top-card-name">{card.name}</span>
              </button>;
            })}
          </div>
        </div>}
        <div className="col-summary-footer">
          <CollectionCurrencies usdTotal={market.total} hasKnownValue={market.pricedQty > 0 || market.unpricedQty === 0} partial={market.unpricedQty > 0} />
          <div className="col-price-coverage" role="status">
            <span>{market.pricedQty} of {total} priced</span>
            {market.unpricedQty > 0 && <span>{market.unpricedQty} missing prices</span>}
            {priceStatus.oldestCheckedAt && <span>Prices checked {checkedDate(priceStatus.oldestCheckedAt)}{checkedDate(priceStatus.oldestCheckedAt) !== checkedDate(priceStatus.newestCheckedAt) ? ` – ${checkedDate(priceStatus.newestCheckedAt)}` : ''}</span>}
            {refreshingPrices > 0 && <span>Updating…</span>}
            {priceStatus.staleQty > 0 && <span>{priceStatus.staleQty} need a fresh check</span>}
            {priceStatus.undatedQty > 0 && <span>{priceStatus.undatedQty} have no price date</span>}
            <small>These prices do not adjust for wear.</small>
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={140} className="col-view-controls">
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
      </ScrollReveal>

      <ScrollReveal delay={210} className="col-tools">
        <button type="button" onClick={() => saveFile('backup')} disabled={!cards.length}>Backup</button>
        <button type="button" onClick={() => saveFile('csv')} disabled={!cards.length}>Export CSV</button>
        <button type="button" onClick={() => importRef.current?.click()}>Restore</button>
      </ScrollReveal>

      {cards.length === 0 ? (
        <ScrollReveal className="col-empty">
          <div className="col-empty-mark" aria-hidden="true"><span /><span /></div>
          <strong>No cards saved yet</strong>
          <p>Use the scanner or search above to add your first card.</p>
        </ScrollReveal>
      ) : visibleCards.length === 0 ? (
        <ScrollReveal className="col-empty col-empty--binder">
          <div className="col-empty-mark" aria-hidden="true"><span /><span /></div>
          <strong>No {activeBinder.label} cards yet</strong>
          <p>Cards from this game will appear in this binder after you add them.</p>
        </ScrollReveal>
      ) : (
        <ScrollReveal className="col-grid">
          {visibleCards.map((card) => {
            const finish = collectionFormLabel(card.game, card.form, card) || card.rarity;
            return <div className="col-cell" key={cardKey(card)}>
              <button type="button" className="col-card-face" onClick={() => setViewing(card)} aria-label={['Manage ' + card.name, printingNumber(card), finish].filter(Boolean).join(' · ')}>
                <span className="col-card">
                  {card.imageUrl || card.imageLarge
                    ? <img src={card.imageUrl || card.imageLarge} alt={card.name} loading="lazy" />
                    : <span className="col-noart">{card.name}</span>}
                  <span className="col-copy-badge">×{card.qty}</span>
                </span>
                <span className="col-face-copy">
                  <strong className="col-face-name">{card.name}</strong>
                  <span className="col-face-number">{printingNumber(card) || card.setName}</span>
                  {finish && <span className="col-finish-badge">{finish}</span>}
                  <span className="col-face-price">{card.marketPrice == null ? 'Price unavailable' : <>{formatCollectionMoney(card.marketPrice)} <small>each</small></>}</span>
                  {card.qty > 1 && card.marketPrice != null && <span className="col-face-total">{formatCollectionMoney(card.marketPrice * card.qty)} for {card.qty} copies</span>}
                </span>
              </button>
            </div>;
          })}
        </ScrollReveal>
      )}

      <CardBrowser
        actionLabel="Add to collection"
        onCardSelect={async (_name, _game, options = {}) => {
          if (options.pin) onAddCard?.(stampCardPrice(normalizeCardRecord(await addTcgplayerPrice(
            options.pin,
            undefined,
            { requireProductId: options.pin.game === 'yugioh' },
          ))));
        }}
      />

      {viewedCard && <CollectionCardDetails
        key={cardKey(viewedCard)}
        card={viewedCard}
        onClose={() => setViewing(null)}
        onSave={(details, replacement) => {
          const next = updateCollectionCard(viewedCard, details, replacement);
          setCards(next);
          setViewing(null);
          flash('ok', 'Card changes saved.');
        }}
        onLoadFinishes={loadFinishes}
        onLookup={onLookup && isExactScanTarget(viewedCard.game, viewedCard) ? (card) => {
          setViewing(null);
          onLookup(card.name, card.game, { pin: card });
        } : null}
        onRemove={() => {
          setCards(removeAll(viewedCard));
          setViewing(null);
          flash('ok', 'Card removed from Collection.');
        }}
      />}
    </div>
  );
}
