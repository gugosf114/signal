import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CardLightbox from './CardLightbox';
import { collectionFormLabel, formatCollectionMoney, marketPriceFor } from '../services/collection';
import { printingLabel } from '../services/printing';
import { scannerPrintingKey } from '../services/scannerMatch';

const CONDITIONS = [
  ['near_mint', 'Near mint'], ['lightly_played', 'Lightly played'],
  ['moderately_played', 'Moderately played'], ['heavily_played', 'Heavily played'], ['damaged', 'Damaged'],
];

export default function CollectionCardDetails({ card, onClose, onSave, onRemove, onLookup, onLoadFinishes }) {
  const [quantity, setQuantity] = useState(String(card.qty));
  const [condition, setCondition] = useState(card.condition || 'near_mint');
  const [paid, setPaid] = useState(card.paidPerCard == null ? '' : String(card.paidPerCard));
  const [paidEdited, setPaidEdited] = useState(false);
  const [picked, setPicked] = useState(null);
  const [choices, setChoices] = useState(null);
  const [loadingFinishes, setLoadingFinishes] = useState(false);
  const [error, setError] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const dialogRef = useRef(null);
  const backdropRef = useRef(null);
  const closeRef = useRef(null);
  const alive = useRef(true);
  const viewerRef = useRef(false);
  viewerRef.current = viewerOpen;
  const shown = picked || card;
  const price = marketPriceFor(shown);
  const qty = Number(quantity);
  const validQty = Number.isInteger(qty) && qty >= 1 && qty <= 999;
  const total = price == null || !validQty ? null : price * qty;
  const dirty = quantity !== String(card.qty) || condition !== card.condition || paidEdited || Boolean(picked);
  const finish = collectionFormLabel(shown.game, shown.form, shown) || shown.rarity || 'Exact printing';

  useEffect(() => {
    alive.current = true;
    const priorFocus = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    const viewport = window.visualViewport;
    const fitViewport = () => {
      backdropRef.current?.style.setProperty('--detail-viewport-height', `${viewport?.height || window.innerHeight}px`);
      backdropRef.current?.style.setProperty('--detail-viewport-top', `${viewport?.offsetTop || 0}px`);
    };
    fitViewport();
    viewport?.addEventListener('resize', fitViewport);
    viewport?.addEventListener('scroll', fitViewport);
    window.addEventListener('resize', fitViewport);
    const keydown = (event) => {
      if (viewerRef.current) return;
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const items = [...dialogRef.current.querySelectorAll('button:not(:disabled), input, select, a[href]')];
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      alive.current = false;
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', keydown);
      viewport?.removeEventListener('resize', fitViewport);
      viewport?.removeEventListener('scroll', fitViewport);
      window.removeEventListener('resize', fitViewport);
      priorFocus?.focus?.({ preventScroll: true });
    };
  }, []);

  const loadFinishes = async () => {
    setLoadingFinishes(true); setError(null);
    try {
      const rows = await onLoadFinishes(card);
      if (!alive.current) return;
      if (!rows.length) throw new Error('No other finish could be checked. Your saved card is kept.');
      setChoices(rows);
    } catch (failure) { if (alive.current) setError(failure.message || 'Finishes could not be checked.'); }
    finally { if (alive.current) setLoadingFinishes(false); }
  };

  const save = (event) => {
    event.preventDefault(); setError(null);
    try {
      onSave({ quantity, condition, ...(paidEdited ? { paidPerCard: paid } : {}) }, picked);
    } catch (failure) { setError(failure.message || 'Changes could not be saved.'); }
  };

  return createPortal(<>
    <div ref={backdropRef} className="col-detail-backdrop">
      <section ref={dialogRef} className="col-detail" role="dialog" aria-modal="true" aria-labelledby="col-detail-title">
        <header className="col-detail-header">
          <div><span>Your card</span><h2 id="col-detail-title">{shown.name}</h2></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close card details">×</button>
        </header>
        <form onSubmit={save} className="col-detail-body">
          <p className="col-detail-printing">{printingLabel(shown)}</p>
          <div className="col-detail-overview">
            <button type="button" className="col-detail-art" onClick={() => setViewerOpen(true)} aria-label={`Enlarge ${shown.name}`} disabled={!shown.imageUrl && !shown.imageLarge}>
              {shown.imageUrl || shown.imageLarge ? <img src={shown.imageLarge || shown.imageUrl} alt={shown.name} /> : <span>No picture</span>}
            </button>
            <div className="col-detail-values">
              <span>Market estimate</span>
              <strong>{formatCollectionMoney(price)} <small>each</small></strong>
              <span>{validQty ? `${qty} ${qty === 1 ? 'copy' : 'copies'}` : 'Your copies'}</span>
              <strong>{formatCollectionMoney(total)} <small>total</small></strong>
              <span className="col-finish-badge">{finish}</span>
            </div>
          </div>
          <div className="col-detail-fields">
            <label><span>Quantity</span><input aria-label="Quantity" type="number" min="1" max="999" step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
            <label><span>Condition</span><select aria-label="Condition" value={condition} onChange={(event) => setCondition(event.target.value)}>{CONDITIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label className="col-detail-paid"><span>Paid per copy (USD)</span><input aria-label="Paid per copy" type="number" min="0" step="0.01" inputMode="decimal" placeholder="Not recorded" value={paid} onChange={(event) => { setPaid(event.target.value); setPaidEdited(true); }} />
              <small>{!paidEdited && card.paidPerCard != null && card.paidKnownQty < qty ? `Paid amount recorded for ${card.paidKnownQty} of these copies.` : 'Leave blank when the cost is unknown.'}</small>
            </label>
          </div>

          <div className="col-detail-finish-heading"><strong>Finish / version</strong><button type="button" onClick={loadFinishes} disabled={loadingFinishes}>{loadingFinishes ? 'Checking…' : choices ? 'Check again' : 'Change finish'}</button></div>
          {choices ? <div className="col-detail-finishes" role="group" aria-label="Choose saved card finish">
            {choices.map((option) => {
              const selected = scannerPrintingKey(option) === scannerPrintingKey(shown);
              const label = collectionFormLabel(option.game, option.form, option) || option.finish || option.rarity || 'This printing';
              return <button type="button" className="live-batch-choice" key={scannerPrintingKey(option)} aria-pressed={selected} onClick={() => setPicked(option)}>
                <span>{selected ? '✓ ' : ''}{label}</span><strong>{formatCollectionMoney(marketPriceFor(option))}</strong>
              </button>;
            })}
          </div> : <p className="col-detail-current-finish">{finish}</p>}
          {error && <p className="col-detail-error" role="alert">{error}</p>}
          <div className="col-detail-save"><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={!dirty || loadingFinishes}>Save changes</button></div>
          <div className="col-detail-more">
            {onLookup && <button type="button" onClick={() => onLookup(card)} disabled={dirty}>{dirty ? 'Save changes to open Signal' : 'Open Signal for this card'}</button>}
            <button type="button" className="col-detail-remove" onClick={() => setConfirmRemove(true)}>Remove from Collection</button>
          </div>
          {confirmRemove && <div className="col-detail-confirm" role="alert">
            <strong>Remove all {card.qty} {card.qty === 1 ? 'copy' : 'copies'} of this saved version?</strong>
            <button type="button" onClick={() => setConfirmRemove(false)}>Keep card</button>
            <button type="button" onClick={() => { try { onRemove(); } catch (failure) { setError(failure.message); } }}>Remove copies</button>
          </div>}
        </form>
      </section>
    </div>
    <CardLightbox isOpen={viewerOpen} lockScroll={false} onClose={() => setViewerOpen(false)} imageUrl={shown.imageLarge || shown.imageUrl} cardName={shown.name} card={shown} cardMeta={[printingLabel(shown), `${formatCollectionMoney(price)} each`].join(' · ')} />
  </>, document.body);
}
