import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadCollection, importCollection, removeOne, removeAll,
  countCards, collectionValueSummary, cardKey,
  collectionFormLabel, formatCollectionMoney,
} from '../services/collection';
import {
  parseCollectionBackup, saveCollectionBackup, saveCollectionCsv,
} from '../services/collectionFiles';
import { addTcgplayerPrice } from '../services/fetchTcgplayerPrice';
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

export default function Collection({ onLookup, onAddCard }) {
  const [cards, setCards] = useState(() => loadCollection());
  const [status, setStatus] = useState(null);
  const [viewing, setViewing] = useState(null);
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

  const total = countCards(cards);
  const market = collectionValueSummary(cards);
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
        <SearchBar onCardFound={(card) => onAddCard?.(card)} />
      </div>

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
          <strong>{marketDisplay}</strong>
          {market.unpricedQty > 0 && (
            <small className="col-summary-note">{market.unpricedQty} unpriced</small>
          )}
        </div>
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
                <strong>{formatCollectionMoney(card.marketPrice)}</strong>
                <span>{holdingMeta(card)}</span>
                {card.paidPerCard != null && <span>Paid {formatCollectionMoney(card.paidPerCard)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <CardBrowser
        actionLabel="Add to collection"
        onCardSelect={async (_name, _game, options = {}) => {
          if (options.pin) onAddCard?.(await addTcgplayerPrice(options.pin));
        }}
      />

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
