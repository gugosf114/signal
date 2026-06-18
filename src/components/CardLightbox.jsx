import React, { useState, useRef, useEffect, useCallback } from 'react';

function AnnotationChip({ label, value, color, style }) {
  return (
    <div style={{
      position: 'absolute',
      background: '#0E1014',
      border: `1px solid ${color || '#2A2D34'}`,
      borderRadius: 3,
      padding: '5px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      minWidth: 80,
      pointerEvents: 'none',
      ...style,
    }}>
      <span style={{
        fontSize: 7,
        fontFamily: "'Syne', sans-serif",
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: color || '#A8A498',
        opacity: 0.8,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 600,
        color: color || '#E8E4DC',
        letterSpacing: '-0.01em',
        lineHeight: 1.2,
      }}>
        {value}
      </span>
    </div>
  );
}

export default function CardLightbox({
  isOpen,
  onClose,
  imageUrl,
  cardName,
  score,
  scoreLabel,
  scoreColor,
  enPrice,
  jpPrice,
  trend,
  topSignal,
}) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, sx: 50, sy: 50 });
  const [settling, setSettling] = useState(false);
  const animRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setSettling(false);
    setTilt({ rx: (y - 0.5) * -22, ry: (x - 0.5) * 22, sx: x * 100, sy: y * 100 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setSettling(true);
    setTilt({ rx: 0, ry: 0, sx: 50, sy: 50 });
  }, []);

  if (!isOpen) return null;

  const tiltTransition = settling
    ? 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)'
    : 'transform 0.08s ease-out';

  const iridescenceAngle = tilt.ry * 3;
  const iridescenceOpacity = (Math.abs(tilt.rx) + Math.abs(tilt.ry)) > 1 ? 0.7 : 0;

  const trendDisplay = (() => {
    if (!trend) return '—';
    const t = trend.toLowerCase();
    if (t.includes('up') || t.includes('rising') || t.includes('increas')) return '▲ ' + trend;
    if (t.includes('down') || t.includes('falling') || t.includes('decreas')) return '▼ ' + trend;
    return '► ' + trend;
  })();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(4, 5, 7, 0.94)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      {/* Close hint */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 24,
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        color: '#605C54',
        letterSpacing: '0.08em',
        pointerEvents: 'none',
      }}>
        ESC to close
      </div>

      {/* Card + annotations container — stop click propagation */}
      <div
        style={{ position: 'relative', padding: '60px 80px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 3D tilt card */}
        <div
          ref={cardRef}
          style={{ perspective: '900px', cursor: 'grab' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div style={{
            transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(1.01)`,
            transition: tiltTransition,
            transformStyle: 'preserve-3d',
            position: 'relative',
            borderRadius: 12,
            boxShadow: `0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px #1A1D24`,
          }}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={cardName}
                style={{
                  display: 'block',
                  width: 'min(280px, 55vw)',
                  height: 'auto',
                  borderRadius: 12,
                }}
                draggable={false}
              />
            ) : (
              <div style={{
                width: 220,
                height: 308,
                borderRadius: 12,
                background: '#0A0C10',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
                color: '#1A1D24',
                fontFamily: "'JetBrains Mono'",
              }}>?</div>
            )}

            {/* Shine overlay — follows mouse */}
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 12,
              background: `radial-gradient(circle at ${tilt.sx}% ${tilt.sy}%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 45%, transparent 65%)`,
              pointerEvents: 'none',
              transform: 'translateZ(1px)',
            }} />

            {/* Iridescent foil layer — shifts with tilt angle */}
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 12,
              background: `linear-gradient(${iridescenceAngle}deg, rgba(196,64,64,0.1) 0%, rgba(160,144,96,0.08) 40%, rgba(96,136,112,0.1) 80%, rgba(112,128,160,0.08) 100%)`,
              pointerEvents: 'none',
              opacity: iridescenceOpacity,
              transition: 'opacity 0.3s',
              transform: 'translateZ(2px)',
              mixBlendMode: 'overlay',
            }} />
          </div>
        </div>

        {/* Annotation chips — 5 key data points */}
        {score !== null && score !== undefined && (
          <AnnotationChip
            label="Score"
            value={`${score} ${scoreLabel}`}
            color={scoreColor}
            style={{ top: 20, left: -10 }}
          />
        )}
        {enPrice && (
          <AnnotationChip
            label="EN Price"
            value={enPrice}
            color="#A8A498"
            style={{ top: 20, right: -10 }}
          />
        )}
        {jpPrice && (
          <AnnotationChip
            label="JP Price"
            value={jpPrice}
            color="#C44040"
            style={{ top: '45%', right: -90, transform: 'translateY(-50%)' }}
          />
        )}
        {trend && (
          <AnnotationChip
            label="30-Day"
            value={trendDisplay}
            color="#608870"
            style={{ bottom: 20, right: -10 }}
          />
        )}
        {topSignal && (
          <AnnotationChip
            label="Top Signal"
            value={topSignal.label}
            color={topSignal.color}
            style={{ bottom: 20, left: -10 }}
          />
        )}
      </div>
    </div>
  );
}
