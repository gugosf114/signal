import React, { useState, useRef, useEffect, useCallback } from 'react';

// ─── Card viewer ─────────────────────────────────────────────────────────────
// Hold the card up to the light: drag to turn it, pinch or double-tap to zoom.
//
// The previous version tilted on `onMouseMove` only, so on the phone — the only
// device this app runs on — the card just appeared slightly larger and sat
// there. It also carried five absolutely-positioned annotation chips offset at
// left/right: -10 and -90, numbers chosen against a desktop layout: on a 375px
// screen the EN-price chip ran off both edges (its value is a sentence, not a
// number), the 30-day chip sat underneath the top-signal chip, and the close
// hint read "ESC to close" on a device with no keyboard. All of it is gone; the
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

export default function CardLightbox({ isOpen, onClose, imageUrl, cardName, onScan, onRemove }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [settling, setSettling] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  // Live gesture state. Refs, not state — these change on every pointermove and
  // must not queue a re-render each time.
  const pointers = useRef(new Map());
  const dragStart = useRef(null);
  const pinchStart = useRef(null);
  const movedFar = useRef(false);
  const lastTap = useRef(0);

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
    pointers.current.clear();
    dragStart.current = null;
    pinchStart.current = null;

    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '0') reset();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const hintTimer = setTimeout(() => setHintVisible(false), 3200);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      clearTimeout(hintTimer);
    };
  }, [isOpen, onClose, reset]);

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

  // The light stays put while the card turns under it.
  const shineX = 50 - tilt.y * 0.55;
  const shineY = 50 + tilt.x * 0.55;
  const lit = (Math.abs(tilt.x) + Math.abs(tilt.y)) / (TILT_LIMIT * 2);
  const moved = Math.abs(tilt.x) > 1 || Math.abs(tilt.y) > 1 || Math.abs(scale - 1) > 0.02;

  return (
    <div className="cl-backdrop" onClick={onClose}>
      <button type="button" className="cl-close" onClick={onClose} aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {cardName && <div className="cl-name">{cardName}</div>}

      <div
        className="cl-stage"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <div
          className="cl-card"
          style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${scale})`,
            transition,
          }}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={cardName || ''} className="cl-img" draggable={false} />
          ) : (
            <div className="cl-placeholder">?</div>
          )}

          {/* Gloss — travels opposite the tilt, so the card reads as catching a
              light that isn't moving. */}
          <div
            className="cl-shine"
            style={{
              background:
                `radial-gradient(circle at ${shineX}% ${shineY}%, rgba(255,255,255,0.28) 0%, ` +
                `rgba(255,255,255,0.06) 42%, transparent 68%)`,
            }}
          />
          {/* Foil sheen, only once it's off-square. */}
          <div
            className="cl-foil"
            style={{
              opacity: Math.min(0.85, lit * 1.7),
              background:
                `linear-gradient(${tilt.y * 2.2}deg, rgba(196,64,64,0.22) 0%, ` +
                `rgba(160,144,96,0.18) 35%, rgba(96,136,112,0.2) 68%, rgba(112,128,160,0.2) 100%)`,
            }}
          />
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
            Scan this card
          </button>
        )}
        {/* Collection view: take the card off the shelf, all copies. */}
        {onRemove && (
          <button
            type="button"
            className="cl-btn cl-btn--drop"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
