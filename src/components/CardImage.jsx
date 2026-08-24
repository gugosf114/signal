import React, { useEffect, useState } from 'react';
import { fetchCardImage } from '../services/fetchCardImage';

export default function CardImage({ cardName, game, pin = null, size = 200, glowColor = '#C44040', onLoad, onClick }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const pinKey = [pin?.printingId || pin?.number || pin?.setId || pin?.id || '', pin?.scanImagePath || ''].join(':');

  useEffect(() => {
    if (!cardName) return;
    let cancelled = false;
    setLoaded(false);
    setError(false);
    setImageUrl(null);
    fetchCardImage(cardName, game, pin).then((url) => {
      if (cancelled) return;
      if (url) { setImageUrl(url); onLoad?.(url); }
      else setError(true);
    });
    return () => { cancelled = true; };
  }, [cardName, game, pinKey]);

  const w = size * 0.72;
  const Wrapper = onClick ? 'button' : 'div';

  if (error || !cardName) {
    return (
      <div style={{
        width: w, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0A0C10',
        border: '1px solid #1A1D24',
        borderRadius: 2,
        color: '#1A1D24',
        fontSize: 28,
        fontFamily: "'JetBrains Mono'",
      }}>?</div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="loading-shimmer" style={{
        width: w, height: size,
        background: '#0A0C10',
        border: '1px solid #1A1D24',
        borderRadius: 2,
      }} />
    );
  }

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      className="card-image-reveal"
      style={{ position: 'relative', flexShrink: 0, cursor: onClick ? 'zoom-in' : 'default', padding: 0, border: 'none', background: 'transparent' }}
      onClick={onClick}
      title={onClick ? 'Open card viewer' : undefined}
      aria-label={onClick ? `Open ${cardName} card viewer` : undefined}
    >
      <div style={{
        position: 'absolute',
        inset: -2,
        borderRadius: 6,
        opacity: 0.2,
        filter: 'blur(12px)',
        zIndex: 0,
        pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, ${glowColor}20 0%, transparent 70%)`,
      }} />
      <img
        src={imageUrl}
        alt={cardName}
        style={{
          display: 'block',
          width: w, height: size,
          borderRadius: 3,
          objectFit: 'contain',
          transition: 'opacity 0.5s, transform 0.4s',
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'scale(1)' : 'scale(0.97)',
          position: 'relative',
          zIndex: 1,
        }}
        onLoad={() => setLoaded(true)}
        onError={() => {
          console.warn(`[CardImage] image load failed: ${imageUrl}`);
          setError(true);
        }}
      />
    </Wrapper>
  );
}
