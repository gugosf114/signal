import React, { useState, useEffect, useRef } from 'react';
import { fetchTCGNews } from '../services/fetchTCGNews';

const CARD_W = 178;
const GAP = 14;
const STEP = CARD_W + GAP;
const SPEED = 0.35; // px per animation frame — slow crawl

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

function ArticleCard({ article, fallbackImg, onHover, onLeave }) {
  const imgSrc = article.imageUrl || fallbackImg;
  const isGameCard = !article.imageUrl && !!fallbackImg;
  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="npc-outer"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* The full card — image on top, article text below.
          Outer clips at image height. 40px headroom above lets card rise. */}
      <div className="npc-card">

        {/* IMAGE — top half, always visible in pocket opening */}
        <div className="npc-img">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              style={{
                width: '100%',
                height: '100%',
                objectFit: isGameCard ? 'contain' : 'cover',
                objectPosition: 'center top',
                background: '#08090A',
              }}
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(160deg, ${article.source.color}25 0%, #08090A 100%)`,
            }}>
              <span style={{
                fontSize: 44, fontFamily: "'Syne',sans-serif", fontWeight: 800,
                color: article.source.color, opacity: 0.2, letterSpacing: '-0.04em',
                userSelect: 'none',
              }}>
                {article.source.label.replace('r/','').slice(0,4).toUpperCase()}
              </span>
            </div>
          )}
          {/* Pocket edge gradient */}
          <div className="npc-edge" />
          {/* Source badge on image */}
          <div className="npc-badge" style={{ '--c': article.source.color }}>
            <span className="npc-dot" />
            <span className="npc-src">{article.source.label}</span>
            <span className="npc-age">{timeAgo(article.pubDate)}</span>
          </div>
        </div>

        {/* ARTICLE TEXT — bottom half, hidden inside pocket */}
        <div className="npc-text" style={{ '--ac': article.source.color }}>
          <div className="npc-title">{article.title}</div>
          {article.description && <div className="npc-desc">{article.description}</div>}
          <div className="npc-read">Read →</div>
        </div>

      </div>
    </a>
  );
}

export default function NewsStrip() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [fallbacks, setFallbacks] = useState({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused]       = useState(false);

  const trackRef = useRef(null);
  const posRef   = useRef(0);
  const rafRef   = useRef(null);
  const pausedRef = useRef(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    fetchTCGNews()
      .then(all => {
        setArticles(all);
        const games = [...new Set(all.map(a => a.source.game).filter(Boolean))];
        games.forEach(async game => {
          const url = await fetchGameFallback(game);
          if (url) setFallbacks(f => ({ ...f, [game]: url }));
        });
      })
      .finally(() => setLoading(false));
  }, []);

  // JS-driven scroll — gives dots real control over position
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

  if (loading) {
    return (
      <div style={{ marginTop: 40 }}>
        <div className="ns-header">
          <span className="ns-label">TCG Intelligence</span>
        </div>
        <div style={{ display: 'flex', gap: GAP, paddingTop: 40, height: 180 + 40, overflow: 'hidden' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="loading-shimmer" style={{ width: CARD_W, height: 180, borderRadius: 8, flexShrink: 0 }} />
          ))}
        </div>
      </div>
    );
  }

  if (articles.length === 0) return null;

  // Triple the articles for a seamless infinite loop with no jumps
  const tripled = [...articles, ...articles, ...articles];

  return (
    <div style={{ marginTop: 40 }}>
      {/* Header + navigation dots */}
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

      {/* Strip — 40px headroom above cards + fade edges */}
      <div className="ns-track-outer"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="ns-fade-l" />
        <div className="ns-fade-r" />
        {/* 40px headroom + 110px visible image = 150px total. Cards are 360px — clearly cropped. */}
        <div style={{ paddingTop: 40, height: 150, overflow: 'hidden' }}>
          <div ref={trackRef} className="ns-track">
            {tripled.map((article, i) => (
              <ArticleCard
                key={i}
                article={article}
                fallbackImg={fallbacks[article.source.game] || null}
                onHover={() => setPaused(true)}
                onLeave={() => setPaused(false)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
