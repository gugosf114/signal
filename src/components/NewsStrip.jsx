import React, { useState, useEffect, useRef } from 'react';
import { fetchTCGNews } from '../services/fetchTCGNews';

// One fallback card image per game, fetched once on mount
async function fetchGameFallback(game) {
  try {
    if (game === 'pokemon') {
      const r = await fetch('https://api.pokemontcg.io/v2/cards?q=set.id:sv7&pageSize=6&orderBy=-set.releaseDate');
      const d = await r.json();
      const cards = d.data || [];
      const pick = cards[Math.floor(Math.random() * cards.length)];
      return pick?.images?.large || null;
    }
    if (game === 'mtg') {
      const r = await fetch('https://api.scryfall.com/cards/search?q=s:dsk+(rarity:r+or+rarity:m)&order=released&dir=desc');
      const d = await r.json();
      const cards = d.data || [];
      const pick = cards[Math.floor(Math.random() * Math.min(cards.length, 6))];
      return pick?.image_uris?.large || pick?.card_faces?.[0]?.image_uris?.large || null;
    }
    if (game === 'yugioh') {
      const r = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php?sort=new&num=6&offset=0');
      const d = await r.json();
      const cards = d.data || [];
      const pick = cards[Math.floor(Math.random() * cards.length)];
      return pick?.card_images?.[0]?.image_url || null;
    }
  } catch {}
  return null;
}

function timeAgo(date) {
  const s = (Date.now() - date.getTime()) / 1000;
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function ArticleCard({ article, fallbackImg }) {
  const imgSrc = article.imageUrl || fallbackImg;
  const isGameCard = !article.imageUrl && !!fallbackImg;

  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="news-pocket-wrapper"
    >
      {/* Full card — image on top, article text below the pocket edge */}
      <div className="news-pocket-card">

        {/* IMAGE SECTION — visible by default (the "head" sticking out of pocket) */}
        <div className="news-pocket-img">
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
                background: '#0A0C10',
              }}
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            // No image at all — colored gradient with source initials
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(160deg, ${article.source.color}28 0%, #08090A 100%)`,
            }}>
              <span style={{
                fontSize: 52,
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800,
                color: article.source.color,
                opacity: 0.22,
                letterSpacing: '-0.04em',
                userSelect: 'none',
              }}>
                {article.source.label.replace('r/', '').slice(0, 4).toUpperCase()}
              </span>
            </div>
          )}
          {/* Pocket edge shadow — the visual "fold" */}
          <div className="news-pocket-edge" />
          {/* Source badge */}
          <div className="news-pocket-badge" style={{ '--badge-color': article.source.color }}>
            <span className="news-pocket-dot" />
            <span className="news-pocket-source">{article.source.label}</span>
            <span className="news-pocket-age">{timeAgo(article.pubDate)}</span>
          </div>
        </div>

        {/* ARTICLE SECTION — hidden below the pocket, revealed on hover */}
        <div className="news-pocket-text" style={{ '--accent': article.source.color }}>
          <div className="news-pocket-title">{article.title}</div>
          {article.description && (
            <div className="news-pocket-desc">{article.description}</div>
          )}
          <div className="news-pocket-read">Read →</div>
        </div>

      </div>
    </a>
  );
}

export default function NewsStrip() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSource, setActiveSource] = useState(null);
  const [fallbacks, setFallbacks] = useState({});

  useEffect(() => {
    fetchTCGNews()
      .then(all => {
        // Limit to 8 best articles
        setArticles(all.slice(0, 8));
        // Pre-fetch one game-art fallback per unique game
        const games = [...new Set(all.map(a => a.source.game).filter(Boolean))];
        games.forEach(async game => {
          const url = await fetchGameFallback(game);
          if (url) setFallbacks(f => ({ ...f, [game]: url }));
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const sources = articles.length
    ? [...new Map(articles.map(a => [a.source.id, a.source])).values()]
    : [];

  const filtered = activeSource
    ? articles.filter(a => a.source.id === activeSource)
    : articles;

  // Double for seamless loop
  const doubled = [...filtered, ...filtered];

  if (loading) {
    return (
      <div style={{ marginTop: 40, marginBottom: 8 }}>
        <div className="news-strip-header">
          <span className="news-strip-label">TCG Intelligence</span>
        </div>
        <div style={{ display: 'flex', gap: 12, overflow: 'hidden', height: 200 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="loading-shimmer" style={{ width: 180, height: 200, borderRadius: 8, flexShrink: 0 }} />
          ))}
        </div>
      </div>
    );
  }

  if (articles.length === 0) return null;

  return (
    <div style={{ marginTop: 40 }}>
      {/* Header row with source filter dots */}
      <div className="news-strip-header">
        <span className="news-strip-label">TCG Intelligence</span>
        <div className="news-strip-dots">
          <button
            className={`news-dot ${!activeSource ? 'news-dot--all' : ''}`}
            onClick={() => setActiveSource(null)}
            title="All sources"
          >
            All
          </button>
          {sources.map(src => (
            <button
              key={src.id}
              className={`news-dot ${activeSource === src.id ? 'news-dot--active' : ''}`}
              style={{ '--dot-color': src.color }}
              onClick={() => setActiveSource(activeSource === src.id ? null : src.id)}
              title={src.label}
            >
              <span className="news-dot-pip" />
              <span className="news-dot-label">{src.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scrolling strip */}
      <div className="news-strip-track-outer">
        <div className="news-strip-fade-l" />
        <div className="news-strip-fade-r" />
        <div className="news-strip-track">
          {doubled.map((article, i) => (
            <ArticleCard
              key={article.id + '-' + i}
              article={article}
              fallbackImg={fallbacks[article.source.game] || null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
