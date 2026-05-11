import React, { useState, useEffect, useRef } from 'react';
import { fetchTCGNews } from '../services/fetchTCGNews';

function timeAgo(date) {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function ArticleCard({ article, onCardClick }) {
  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 240,
        flexShrink: 0,
        background: '#0E1014',
        border: '1px solid #1A1D24',
        borderRadius: 4,
        overflow: 'hidden',
        textDecoration: 'none',
        transition: 'border-color 0.15s, transform 0.15s',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = article.source.color + '60';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#1A1D24';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Image */}
      <div style={{
        height: 130,
        background: `linear-gradient(135deg, ${article.source.color}22 0%, #0A0C10 100%)`,
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}>
        {article.imageUrl ? (
          <img
            src={article.imageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center top',
              opacity: 0.88,
              position: 'relative',
              zIndex: 1,
            }}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        ) : null}

        {/* Always render fallback behind the image — visible when image fails or is absent */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 0,
        }}>
          <span style={{
            fontSize: 48,
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
        {/* Source badge overlay */}
        <div style={{
          position: 'absolute',
          bottom: 6,
          left: 6,
          background: 'rgba(8,9,10,0.85)',
          border: `1px solid ${article.source.color}50`,
          borderRadius: 2,
          padding: '2px 7px',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}>
          <div style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: article.source.color,
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 8,
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: article.source.color,
            textTransform: 'uppercase',
          }}>
            {article.source.label}
          </span>
        </div>
      </div>

      {/* Text */}
      <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{
          fontSize: 9,
          fontFamily: "'JetBrains Mono', monospace",
          color: '#3A3830',
          letterSpacing: '0.06em',
        }}>
          {timeAgo(article.pubDate)}
        </div>
        <div style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: 13,
          fontStyle: 'italic',
          color: '#E8E4DC',
          lineHeight: 1.35,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        }}>
          {article.title}
        </div>
        {article.description && (
          <div style={{
            fontSize: 10,
            fontFamily: "'Syne', sans-serif",
            color: '#4A4840',
            lineHeight: 1.5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {article.description}
          </div>
        )}
      </div>
    </a>
  );
}

export default function NewsStrip() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTCGNews()
      .then(setArticles)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ marginTop: 40, marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontFamily: "'Syne'", fontWeight: 700, letterSpacing: '0.22em', color: '#3A3830', textTransform: 'uppercase', marginBottom: 14 }}>
          TCG Intelligence
        </div>
        <div style={{ display: 'flex', gap: 12, overflow: 'hidden' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="loading-shimmer" style={{ width: 220, height: 200, borderRadius: 4, flexShrink: 0 }} />
          ))}
        </div>
      </div>
    );
  }

  if (articles.length === 0) return null;

  // Duplicate for seamless loop
  const doubled = [...articles, ...articles];

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <span style={{
          fontSize: 9,
          fontFamily: "'Syne', sans-serif",
          fontWeight: 700,
          letterSpacing: '0.22em',
          color: '#3A3830',
          textTransform: 'uppercase',
        }}>
          TCG Intelligence
        </span>
        <span style={{
          fontSize: 8,
          fontFamily: "'JetBrains Mono', monospace",
          color: '#2A2820',
          letterSpacing: '0.08em',
        }}>
          PkmnCards · SixPrizes · MTGGoldfish · YGOrganization
        </span>
      </div>

      {/* Scrolling strip */}
      <div style={{ overflow: 'hidden', position: 'relative' }}>
        {/* Fade edges */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 40,
          background: 'linear-gradient(90deg, #08090A, transparent)',
          zIndex: 2,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 40,
          background: 'linear-gradient(270deg, #08090A, transparent)',
          zIndex: 2,
          pointerEvents: 'none',
        }} />

        <div className="news-strip-track">
          {doubled.map((article, i) => (
            <ArticleCard key={article.id + '-' + i} article={article} />
          ))}
        </div>
      </div>
    </div>
  );
}
