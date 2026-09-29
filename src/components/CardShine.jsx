import React from 'react';
import { cardShinePreview } from '../services/cardShine';

export default function CardShine({ card, follow = false, tilt = null }) {
  const kind = cardShinePreview(card);
  if (!kind) return null;
  return <span
    className={`card-shine card-shine--${kind}`}
    data-follow={follow || undefined}
    aria-hidden="true"
    style={tilt ? {
      '--shine-x': `${tilt.y / 78 * 18}%`,
      '--shine-y': `${-tilt.x / 78 * 12}%`,
    } : undefined}
  />;
}
