import React, { useEffect, useRef } from 'react';
import { ambientPointerOffset, ambientTiltOffset } from '../services/ambientMotion';

export default function SignalAmbient({ active }) {
  const fieldRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    const field = fieldRef.current;
    if (!field) return undefined;
    let origin = null;

    const move = ({ x, y }) => {
      field.style.setProperty('--ambient-x', `${x.toFixed(2)}px`);
      field.style.setProperty('--ambient-y', `${y.toFixed(2)}px`);
    };
    const onOrientation = (event) => {
      if (event.beta == null || event.gamma == null
        || !Number.isFinite(Number(event.beta)) || !Number.isFinite(Number(event.gamma))) return;
      if (!origin) origin = { beta: Number(event.beta), gamma: Number(event.gamma) };
      move(ambientTiltOffset(event.beta, event.gamma, origin.beta, origin.gamma));
    };
    const onPointer = (event) => move(ambientPointerOffset(
      event.clientX,
      event.clientY,
      window.innerWidth,
      window.innerHeight,
    ));
    const reset = () => move({ x: 0, y: 0 });

    window.addEventListener('deviceorientation', onOrientation, { passive: true });
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', reset);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('pointermove', onPointer);
      document.documentElement.removeEventListener('pointerleave', reset);
    };
  }, [active]);

  if (!active) return null;
  return (
    <div ref={fieldRef} className="signal-ambient" aria-hidden="true">
      <span className="signal-ambient-field signal-ambient-field--red" />
      <span className="signal-ambient-field signal-ambient-field--gold" />
      <span className="signal-ambient-field signal-ambient-field--cool" />
      <span className="signal-ambient-grid" />
    </div>
  );
}
