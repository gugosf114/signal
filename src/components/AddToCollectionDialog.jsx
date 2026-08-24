import React, { useEffect, useRef, useState } from 'react';
import {
  addToCollection,
  collectionFormOptions,
  formatCollectionMoney,
  marketPriceFor,
} from '../services/collection';

const CONDITIONS = [
  ['near_mint', 'Near mint'],
  ['lightly_played', 'Lightly played'],
  ['moderately_played', 'Moderately played'],
  ['heavily_played', 'Heavily played'],
  ['damaged', 'Damaged'],
];

export default function AddToCollectionDialog({ card, isOpen, onClose, onAdded }) {
  const [condition, setCondition] = useState('near_mint');
  const [form, setForm] = useState('normal');
  const [quantity, setQuantity] = useState(1);
  const [paid, setPaid] = useState('');
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setCondition('near_mint');
    setForm('normal');
    setQuantity(1);
    setPaid('');
    const prior = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => closeRef.current?.focus(), 0);
    const onKey = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.();
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll('button, input, select') || [])]
        .filter((element) => !element.disabled);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = oldOverflow;
      prior?.focus?.();
    };
  }, [isOpen, card]);

  if (!isOpen || !card) return null;

  const marketPrice = marketPriceFor(card, form);
  const formOptions = collectionFormOptions(card.game);
  const submit = (event) => {
    event.preventDefault();
    const list = addToCollection(card, {
      condition,
      form,
      quantity,
      paidPerCard: paid,
    });
    window.dispatchEvent(new Event('signal-collection-updated'));
    onAdded?.(list, { quantity, card });
    onCloseRef.current?.();
  };

  return (
    <div
      className="ac-backdrop"
      role="presentation"
      onPointerDown={(event) => { if (event.target === event.currentTarget) onCloseRef.current?.(); }}
    >
      <form
        ref={dialogRef}
        className="ac-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-card-title"
        onSubmit={submit}
      >
        <button ref={closeRef} type="button" className="ac-close" onClick={() => onCloseRef.current?.()} aria-label="Close add card form">×</button>

        <div className="ac-head">
          {card.imageUrl || card.imageLarge ? (
            <img src={card.imageUrl || card.imageLarge} alt="" className="ac-art" />
          ) : <div className="ac-art ac-art--empty">?</div>}
          <div className="ac-title-wrap">
            <div className="ac-kicker">Add to collection</div>
            <h2 id="add-card-title" className="ac-title">{card.name}</h2>
            <div className="ac-meta">
              {card.setName || 'Set not listed'}{card.number ? ` · ${card.number}` : ''}
            </div>
            <div className="ac-market">
              <span>Market price</span>
              <strong>{formatCollectionMoney(marketPrice)}</strong>
              {marketPrice == null && <em>Exact price unavailable</em>}
            </div>
          </div>
        </div>

        <div className="ac-grid">
          <label className="ac-field ac-field--wide">
            <span>Condition</span>
            <select value={condition} onChange={(event) => setCondition(event.target.value)}>
              {CONDITIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          {formOptions.length > 0 && (
            <fieldset className="ac-field ac-field--wide">
              <legend>Finish</legend>
              <div className="ac-segments">
                {formOptions.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={form === value ? 'ac-segment ac-segment--on' : 'ac-segment'}
                  onClick={() => setForm(value)}
                  aria-pressed={form === value}
                >
                  {label}
                </button>
              ))}
              </div>
            </fieldset>
          )}

          <label className="ac-field">
            <span>Quantity</span>
            <div className="ac-stepper">
              <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity">−</button>
              <input
                type="number"
                min="1"
                max="999"
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Math.min(999, Number(event.target.value) || 1)))}
                aria-label="Quantity"
              />
              <button type="button" onClick={() => setQuantity((value) => Math.min(999, value + 1))} aria-label="Increase quantity">+</button>
            </div>
          </label>

          <label className="ac-field">
            <span>Paid per card <em>optional</em></span>
            <div className="ac-money-input">
              <span>$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={paid}
                onChange={(event) => setPaid(event.target.value)}
                placeholder="0.00"
              />
            </div>
          </label>
        </div>

        <div className="ac-actions">
          <button type="button" className="ac-cancel" onClick={() => onCloseRef.current?.()}>Cancel</button>
          <button type="submit" className="ac-add">Add {quantity > 1 ? `${quantity} cards` : 'card'}</button>
        </div>
      </form>
    </div>
  );
}
