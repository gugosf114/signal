import React, { useState, useEffect, useRef } from 'react';
import { fetchTCGNews } from '../services/fetchTCGNews';

const CARD_W = 178;
const GAP = 14;
const STEP = CARD_W + GAP;
const SPEED = 0.35;

async function fetchGameFallback(game) {
  try {
    if (game === 'pokemon') {
      const r = await fetch('https://api.pokemontcg.io/v2/cards?q=set.id:sv7&pageSize=6&orderBy=-set.releaseDate');
      const cards = (await r.json()).data || [];
      return cards[Math.floor(Math.random() * cards.length)]?.images?.large || null;
    }
    if (game === 'mtg') {
      const r = await fetch('https://api.scryfall.com/cards/search?q=s:dsk+(rarity:r+or+rarity:m)&order=released&dir=desc');
      const cards = (await r.json()).data || [];
      const c = cards[Math.floor(Math.random() * Math.min(6, cards.length))];
      return c?.image_uris?.large || c?.card_faces?.[0]?.image_uris?.large || null;
    }
    if (game === 'yugioh') {
      const r = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php?sort=new&num=6&offset=0');
      const cards = (await r.json()).data || [];
      return cards[Math.floor(Math.random() * cards.length)]?.card_images?.[0]?.image_url || null;
    }
  } catch {}
  return null;
}

function timeAgo(d) {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// The complete card = image above (sticking out) + pocket below (always visible)
// On hover: image section rises 28px into the headroom above the strip.
// The pocket never moves. The gap that appears IS the pocket interior / dark fabric.
function ArticleCard({ article, fallbackImg }) {
  const imgSrc = article.imageUrl || fallbackImg;
  const isGameCard = !article.imageUrl && !!fallbackImg;
  const c = article.source.color;

  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="npc-outer"
    >
      {/* ── CARD IMAGE — the part sticking out of the pocket ──────── */}
      <div className="npc-above">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            style={{
              width: '100%', height: '100%',
              objectFit: isGameCard ? 'contain' : 'cover',
              objectPosition: 'center top',
              background: '#08090A',
              display: 'block',
            }}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
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
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: '#4A4840' }}>
            {timeAgo(article.pubDate)}
          </span>
        </div>
      </div>

      {/* ── POCKET — fixed, always visible below the card image ───── */}
      <div className="npc-pocket" style={{ '--c': c }}>
        <div style={{
          fontFamily: "'Instrument Serif',serif",
          fontSize: 12, fontStyle: 'italic',
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
            fontFamily: "'Syne',sans-serif", fontSize: 9, color: '#4A4840', lineHeight: 1.5,
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
  const [fallbacks, setFallbacks] = useState({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused]       = useState(false);

  const trackRef       = useRef(null);
  const posRef         = useRef(0);
  const rafRef         = useRef(null);
  const pausedRef      = useRef(false);
  const dragStartRef   = useRef(null);
  const isDraggingRef  = useRef(false);
  const draggedRef     = useRef(false);
  const resumeTimerRef = useRef(null);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    fetchTCGNews().then(all => {
      setArticles(all);
      const games = [...new Set(all.map(a => a.source.game).filter(Boolean))];
      games.forEach(async game => {
        const url = await fetchGameFallback(game);
        if (url) setFallbacks(f => ({ ...f, [game]: url }));
      });
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!articles.length) return;
    const total = articles.length * STEP;
    const tick = () => {
      if (!pausedRef.current) {
        posRef.current = (posRef.current + SPEED) % total;
        if (trackRef.current) {
          trackRef.current.style.transform = `translateX(-${posRef.current}px)`;
          setActiveIdx(Math.floor(posRef.current / STEP) % articles.length);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [articles.length]);

  const jumpTo = (idx) => {
    posRef.current = idx * STEP;
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

  const tripled = [...articles, ...articles, ...articles];

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
          {tripled.map((article, i) => (
            <ArticleCard
              key={i}
              article={article}
              fallbackImg={fallbacks[article.source.game] || null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
