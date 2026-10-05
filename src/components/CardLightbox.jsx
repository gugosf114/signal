import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import CardShine from './CardShine';
import { cardShinePreview } from '../services/cardShine';

// ─── Card viewer ─────────────────────────────────────────────────────────────
// Move the original image: drag to turn it, pinch or double-tap to zoom.
//
// The previous version tilted on `onMouseMove` only, so on the phone — the only
// device this app runs on — the card just appeared slightly larger and sat
// there. It also carried five absolutely-positioned annotation chips offset at
// left/right: -10 and -90, numbers chosen against a desktop layout: on a 375px
// screen the annotation chips ran off both edges, and the close hint read
// "ESC to close" on a device with no keyboard. All of it is gone; the
// card is the whole point of opening this.
//
// Pointer events rather than touch events, so one code path covers finger,
// mouse and stylus. `touch-action: none` on the stage stops the browser
// claiming the drag for a page scroll.

const MIN_SCALE = 0.6;
const MAX_SCALE = 4;
const ZOOMED = 2.2;             // double-tap zoom level
const TILT_LIMIT = 78;          // degrees; past ~90 you'd see a mirrored front
const DRAG_SENSITIVITY = 0.42;  // degrees per pixel dragged
const DOUBLE_TAP_MS = 300;
const TAP_SLOP = 8;             // px of travel still counted as a tap, not a drag

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default function CardLightbox({ isOpen, onClose, imageUrl, cardName, cardMeta = null, card = null, onScan, scanLabel = 'Scan this card', onRemove, lockScroll = true }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [settling, setSettling] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [loadedImage, setLoadedImage] = useState(null);
  const [failedImage, setFailedImage] = useState(null);
  const [imageShape, setImageShape] = useState({ url: null, ratio: 0.716 });

  // Live gesture state. Refs, not state — these change on every pointermove and
  // must not queue a re-render each time.
  const pointers = useRef(new Map());
  const dragStart = useRef(null);
  const pinchStart = useRef(null);
  const movedFar = useRef(false);
  const lastTap = useRef(0);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const removeConfirmRef = useRef(null);
  const priorFocus = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const reset = useCallback(() => {
    setSettling(true);
    setTilt({ x: 0, y: 0 });
    setScale(1);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    // Fresh gesture state on every open, or the card reappears at whatever
    // angle it was last left at.
    setTilt({ x: 0, y: 0 });
    setScale(1);
    setSettling(false);
    setHintVisible(true);
    setConfirmRemove(false);
    pointers.current.clear();
    dragStart.current = null;
    pinchStart.current = null;

    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
      if (e.key === '0') reset();
      if (e.key === 'Tab') {
        const focusable = [...(dialogRef.current?.querySelectorAll('button:not([disabled])') || [])];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    priorFocus.current = document.activeElement;
    const priorOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = 'hidden';
    const focusFrame = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    const viewport = window.visualViewport;
    const fitViewport = () => {
      dialogRef.current?.style.setProperty('--cl-viewport-height', `${viewport?.height || window.innerHeight}px`);
      dialogRef.current?.style.setProperty('--cl-viewport-top', `${viewport?.offsetTop || 0}px`);
    };
    fitViewport();
    viewport?.addEventListener('resize', fitViewport);
    viewport?.addEventListener('scroll', fitViewport);
    window.addEventListener('resize', fitViewport);
    const hintTimer = setTimeout(() => setHintVisible(false), 3200);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (lockScroll) document.body.style.overflow = priorOverflow;
      cancelAnimationFrame(focusFrame);
      viewport?.removeEventListener('resize', fitViewport);
      viewport?.removeEventListener('scroll', fitViewport);
      window.removeEventListener('resize', fitViewport);
      priorFocus.current?.focus?.({ preventScroll: true });
      clearTimeout(hintTimer);
    };
  }, [isOpen, reset, lockScroll]);

  useEffect(() => {
    if (confirmRemove) requestAnimationFrame(() => removeConfirmRef.current?.focus());
  }, [confirmRemove]);

  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setSettling(false);
    setHintVisible(false);
    movedFar.current = false;

    if (pointers.current.size === 2) {
      pinchStart.current = { dist: spread(), scale };
      dragStart.current = null;
    } else {
      dragStart.current = { x: e.clientX, y: e.clientY, tilt: { ...tilt } };
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two fingers: pinch to zoom, and don't also spin the card.
    if (pointers.current.size === 2 && pinchStart.current) {
      const ratio = spread() / (pinchStart.current.dist || 1);
      setScale(clamp(pinchStart.current.scale * ratio, MIN_SCALE, MAX_SCALE));
      movedFar.current = true;
      return;
    }

    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) movedFar.current = true;

    setTilt({
      // Drag right and the right edge swings away from you — the card turns
      // the same way your hand does.
      y: clamp(dragStart.current.tilt.y + dx * DRAG_SENSITIVITY, -TILT_LIMIT, TILT_LIMIT),
      x: clamp(dragStart.current.tilt.x - dy * DRAG_SENSITIVITY, -TILT_LIMIT, TILT_LIMIT),
    });
  };

  const endPointer = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;

    if (pointers.current.size === 0) {
      dragStart.current = null;
      // A tap that never became a drag: double-tap toggles zoom.
      if (!movedFar.current) {
        const now = Date.now();
        if (now - lastTap.current < DOUBLE_TAP_MS) {
          setSettling(true);
          setScale((s) => (s > 1.2 ? 1 : ZOOMED));
          lastTap.current = 0;
        } else {
          lastTap.current = now;
        }
      }
    } else {
      // Second finger lifted mid-pinch — re-anchor the drag so the card
      // doesn't jump to wherever the remaining finger happens to be.
      const [p] = [...pointers.current.values()];
      dragStart.current = { x: p.x, y: p.y, tilt: { ...tilt } };
    }
  };

  if (!isOpen) return null;

  const transition = settling
    ? 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
    : 'transform 0.06s linear';

  const moved = Math.abs(tilt.x) > 1 || Math.abs(tilt.y) > 1 || Math.abs(scale - 1) > 0.02;

  return createPortal(
    <div
      ref={dialogRef}
      className="cl-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={cardName ? `${cardName} card viewer` : 'Card viewer'}
      onClick={(event) => { if (event.target === event.currentTarget) onCloseRef.current?.(); }}
    >
      <button ref={closeRef} type="button" className="cl-close" onClick={(event) => { event.stopPropagation(); onCloseRef.current?.(); }} aria-label="Close card viewer">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div className="cl-heading">
      {cardName && <div className="cl-name">{cardName}</div>}
      {(cardMeta || cardShinePreview(card)) && <div className="cl-meta">
        {cardMeta}
        {imageUrl && cardShinePreview(card) && <span className="cl-shine-label">Shine preview</span>}
      </div>}
      </div>

      <div
        className="cl-stage"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <div
          className="cl-card card-shine-surface"
          style={{
            '--card-ratio': imageShape.url === imageUrl ? imageShape.ratio : 0.716,
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${scale})`,
            transition,
          }}
        >
          {imageUrl && failedImage !== imageUrl ? (
            <>
              <img src={imageUrl} alt={cardName || ''} className="cl-img" draggable={false}
                onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  if (naturalWidth > 0 && naturalHeight > 0) setImageShape({ url: imageUrl, ratio: naturalWidth / naturalHeight });
                  setLoadedImage(imageUrl); setFailedImage(null);
                }}
                onError={() => setFailedImage(imageUrl)} />
              {loadedImage !== imageUrl && <div className="cl-image-status" role="status">Loading image…</div>}
              <CardShine card={card} follow={moved} tilt={tilt} />
            </>
          ) : (
            <div className="cl-placeholder" role="status">Image unavailable</div>
          )}

        </div>
      </div>

      <div className={`cl-hint ${hintVisible ? 'cl-hint--on' : ''}`}>
        Drag to turn · Pinch to zoom · Double-tap to zoom
      </div>

      <div className="cl-actions">
        {moved && (
          <button
            type="button"
            className="cl-btn"
            onClick={(e) => { e.stopPropagation(); reset(); }}
          >
            Straighten
          </button>
        )}
        {/* Opening a card from the browser is free; scanning it costs money and
            a minute, so it stays a separate, deliberate tap. */}
        {onScan && (
          <button
            type="button"
            className="cl-btn cl-btn--go"
            onClick={(e) => { e.stopPropagation(); onScan(); }}
          >
            {scanLabel}
          </button>
        )}
        {/* Collection view: take the card off the shelf, all copies. */}
        {onRemove && !confirmRemove && (
          <button
            type="button"
            className="cl-btn cl-btn--drop"
            onClick={(e) => { e.stopPropagation(); setConfirmRemove(true); }}
          >
            Remove
          </button>
        )}
        {onRemove && confirmRemove && (
          <div className="cl-confirm" role="group" aria-label="Confirm removal">
            <span>Remove all copies?</span>
            <button
              ref={removeConfirmRef}
              type="button"
              className="cl-btn"
              onClick={(event) => { event.stopPropagation(); setConfirmRemove(false); }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="cl-btn cl-btn--drop"
              onClick={(event) => { event.stopPropagation(); onRemove(); }}
            >
              Remove all
            </button>
          </div>
        )}
      </div>
    </div>, document.body
  );
}
