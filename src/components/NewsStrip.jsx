import React, { useState, useEffect, useRef } from 'react';
import { fetchTCGNews } from '../services/fetchTCGNews';

const CARD_W = 178;
const GAP = 14;
const STEP = CARD_W + GAP;
const SPEED = 0.35;

function timeAgo(d) {
  const stamp = d instanceof Date ? d.getTime() : NaN;
  if (!Number.isFinite(stamp)) return '—';
  const s = Math.max(0, (Date.now() - stamp) / 1000);
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// The complete card = image above (sticking out) + pocket below (always visible)
// On hover: image section rises 28px into the headroom above the strip.
// The pocket never moves. The gap that appears IS the pocket interior / dark fabric.
function ArticleCard({ article }) {
  const imgSrc = article.imageUrl;
  const c = article.source.color;
  let href = null;
  try {
    const parsed = new URL(article.link);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') href = parsed.href;
  } catch {}
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="npc-outer"
    >
      {/* ── CARD IMAGE — the part sticking out of the pocket ──────── */}
      {/* All images render inside a centered portrait sub-frame so YGO cards
          and article banners share the same visual footprint regardless of
          source aspect ratio. */}
      <div className="npc-above" style={{ background: '#08090A' }}>
        {imgSrc ? (
          <div style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            transform: 'translateX(-50%)',
            height: '100%',
            aspectRatio: '0.716',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 6,
            boxSizing: 'border-box',
          }}>
            <img
              src={imgSrc}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                objectPosition: 'center',
                background: 'transparent',
                display: 'block',
              }}
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: `linear-gradient(160deg, ${c}25 0%, #08090A 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: 40, fontFamily: "'Syne',sans-serif", fontWeight: 800,
              color: c, opacity: 0.2, userSelect: 'none', letterSpacing: '-0.04em',
            }}>
              {article.source.label.replace('r/','').slice(0,4).toUpperCase()}
            </span>
          </div>
        )}
        {/* Gradient at bottom of image fading into the pocket seam */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />
        {/* Source badge at the bottom of the image, right above the pocket */}
        <div style={{
          position: 'absolute', bottom: 8, left: 8,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: 'rgba(8,9,10,0.9)',
          border: `1px solid ${c}50`,
          borderRadius: 2, padding: '3px 8px', zIndex: 2,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: c, flexShrink: 0 }} />
          <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: c }}>
            {article.source.label}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: '#7A7368' }}>
            {timeAgo(article.pubDate)}
          </span>
        </div>
      </div>

      {/* ── POCKET — fixed, always visible below the card image ───── */}
      <div className="npc-pocket" style={{ '--c': c }}>
        <div style={{
          fontFamily: "'Instrument Serif',serif",
          fontSize: 15, fontStyle: 'italic',
          color: '#C8C4BC', lineHeight: 1.35,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          marginBottom: 6,
        }}>
          {article.title}
        </div>
        {article.description && (
          <div style={{
            fontFamily: "'Syne',sans-serif", fontSize: 12, color: '#7A7368', lineHeight: 1.5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            flex: 1,
          }}>
            {article.description}
          </div>
        )}
        <div style={{
          fontFamily: "'JetBrains Mono',monospace", fontSize: 8,
          fontWeight: 700, letterSpacing: '0.1em', color: c, opacity: 0.65,
          marginTop: 6,
        }}>
          Read →
        </div>
      </div>
    </a>
  );
}

export default function NewsStrip() {
  const [articles, setArticles]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused]       = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const trackRef       = useRef(null);
  const posRef         = useRef(0);
  const rafRef         = useRef(null);
  const pausedRef      = useRef(false);
  const dragStartRef   = useRef(null);
  const isDraggingRef  = useRef(false);
  const draggedRef     = useRef(false);
  const resumeTimerRef = useRef(null);
  const activeRef      = useRef(0);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchTCGNews()
      .then((all) => { if (!cancelled) setArticles(Array.isArray(all) ? all : []); })
      .catch(() => { if (!cancelled) setArticles([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!articles.length || reducedMotion) return;
    const total = articles.length * STEP;
    const tick = () => {
      if (!pausedRef.current) {
        posRef.current = (posRef.current + SPEED) % total;
        if (trackRef.current) {
          trackRef.current.style.transform = `translateX(-${posRef.current}px)`;
          const nextActive = Math.floor(posRef.current / STEP) % articles.length;
          if (nextActive !== activeRef.current) {
            activeRef.current = nextActive;
            setActiveIdx(nextActive);
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [articles.length, reducedMotion]);

  useEffect(() => () => { if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current); }, []);

  const jumpTo = (idx) => {
    posRef.current = idx * STEP;
    activeRef.current = idx;
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(-${posRef.current}px)`;
      setActiveIdx(idx);
    }
  };

  // ── Manual swipe / drag — pointer events unify touch + mouse ──────────
  // touch-action: pan-y in the style below lets vertical page scroll work
  // while horizontal touches fire JS so we can drive the strip ourselves.
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!articles.length) return;
    dragStartRef.current = { x: e.clientX, pos: posRef.current };
    isDraggingRef.current = true;
    draggedRef.current = false;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    setPaused(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };

  const onPointerMove = (e) => {
    if (!isDraggingRef.current || !dragStartRef.current || !trackRef.current) return;
    const delta = dragStartRef.current.x - e.clientX;
    if (Math.abs(delta) > 5) draggedRef.current = true;
    const total = articles.length * STEP;
    if (total <= 0) return;
    let next = (dragStartRef.current.pos + delta) % total;
    if (next < 0) next += total;
    posRef.current = next;
    trackRef.current.style.transform = `translateX(-${next}px)`;
    setActiveIdx(Math.floor(next / STEP) % articles.length);
    activeRef.current = Math.floor(next / STEP) % articles.length;
  };

  const onPointerEnd = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    dragStartRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    // Brief pause so the user can see where they landed before auto-scroll resumes.
    resumeTimerRef.current = setTimeout(() => setPaused(false), 1200);
  };

  const onClickCapture = (e) => {
    if (draggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      draggedRef.current = false;
    }
  };

  if (loading) return null;
  if (!articles.length) return null;

  const tripled = reducedMotion ? articles : [...articles, ...articles, ...articles];

  return (
    <div style={{ marginTop: 40, overflow: 'hidden' }}>
      <div className="ns-header">
        <span className="ns-label">TCG Intelligence</span>
        <div className="ns-dots">
          {articles.map((a, i) => (
            <button
              key={i}
              className={`ns-dot ${i === activeIdx ? 'ns-dot--on' : ''}`}
              style={{ '--dc': a.source.color }}
              onClick={() => jumpTo(i)}
              title={a.title?.slice(0, 60)}
              aria-label={`Show article ${i + 1}: ${a.title || 'untitled'}`}
            />
          ))}
        </div>
      </div>

      {/* Outer container — 32px headroom above cards + card height below */}
      <div
        className="ns-track-outer"
        style={{
          paddingTop: 32,
          overflow: 'visible',
          touchAction: 'pan-y',
          cursor: isDraggingRef.current ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
      >
        <div className="ns-fade-l" />
        <div className="ns-fade-r" />
        <div ref={trackRef} className="ns-track">
          {tripled.map((article, index) => <ArticleCard key={index} article={article} />)}
        </div>
      </div>
    </div>
  );
}
