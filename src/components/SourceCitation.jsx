import React, { useState } from 'react';
import { TIER_META } from '../config/creators';
import { BrandIcon, brandFromUrl, extractYouTubeId, youtubeThumbUrl } from '../config/brandIcons';

// Single citation row — type icon, source, title (link), date, summary, implication.
// Aesthetic match: minimal SVG marks, three-typeface system, muted palette.

const TYPE_LABEL = {
  youtube: 'YouTube',
  tournament: 'Tournament',
  reddit: 'Reddit',
  twitter: 'X / Twitter',
  marketplace_en: 'Marketplace (EN)',
  marketplace_jp: 'Marketplace (JP)',
  editorial: 'Editorial',
  population_report: 'Population Report',
  other: 'Other',
};

const TYPE_COLOR = {
  youtube: '#B08060',
  tournament: '#7080A0',
  reddit: '#A09060',
  twitter: '#608870',
  marketplace_en: '#907888',
  marketplace_jp: '#C44040',
  editorial: '#708880',
  population_report: '#A8A498',
  other: '#7A7368',
};

const TYPE_MARK = {
  tournament: (c) => (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M8 2 L10 6.5 L14.5 6.5 L11 9.5 L12 14 L8 11 L4 14 L5 9.5 L1.5 6.5 L6 6.5 Z"
        stroke={c} strokeWidth="1" fill="none" opacity="0.55" />
    </svg>
  ),
  editorial: (c) => (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <line x1="3" y1="4" x2="13" y2="4" stroke={c} strokeWidth="1.2" opacity="0.5" />
      <line x1="3" y1="7.5" x2="13" y2="7.5" stroke={c} strokeWidth="1.2" opacity="0.4" />
      <line x1="3" y1="11" x2="9" y2="11" stroke={c} strokeWidth="1.2" opacity="0.3" />
    </svg>
  ),
  population_report: (c) => (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="9" width="2.5" height="5" fill={c} opacity="0.5" />
      <rect x="6.75" y="6" width="2.5" height="8" fill={c} opacity="0.5" />
      <rect x="11.5" y="3" width="2.5" height="11" fill={c} opacity="0.5" />
    </svg>
  ),
  other: (c) => (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3" stroke={c} strokeWidth="1.2" fill="none" opacity="0.5" />
    </svg>
  ),
};

const IMPLICATION_META = {
  up: { sym: '▲', color: '#608870', label: 'BULLISH' },
  down: { sym: '▼', color: '#C44040', label: 'BEARISH' },
  neutral: { sym: '►', color: '#A09060', label: 'NEUTRAL' },
};

function tryHostname(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.hostname.replace(/^www\./, '');
  }
  catch { return null; }
}

function safeHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch { return null; }
}

function ReachChip({ reach }) {
  const meta = TIER_META[reach] || TIER_META.unknown;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '1px 5px',
      border: `1px solid ${meta.color}55`,
      borderRadius: 2,
      fontSize: 8,
      fontFamily: "'JetBrains Mono', monospace",
      fontWeight: 700,
      letterSpacing: '0.08em',
      color: meta.color,
      background: `${meta.color}10`,
      lineHeight: 1.1,
    }}>
      {meta.label}
    </span>
  );
}

function YouTubeEmbed({ videoId, title }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="yt-embed" style={{
      marginTop: 10,
      borderRadius: 3,
      overflow: 'hidden',
      position: 'relative',
      maxWidth: 360,
      aspectRatio: '16 / 9',
      background: 'var(--signal-tile)',
      border: '1px solid #1A1D24',
    }}>
      {playing ? (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title || 'YouTube video'}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      ) : (
        <button
          type="button"
          className="yt-play-button"
          onClick={(event) => { event.stopPropagation(); setPlaying(true); }}
          aria-label="Play video"
          style={{
            display: 'block',
            position: 'absolute',
            inset: 0,
            border: 'none',
            padding: 0,
            background: 'transparent',
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          <img
            src={youtubeThumbUrl(videoId, 'mqdefault')}
            alt={title || ''}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.85,
              transition: 'opacity 0.2s',
            }}
            onError={(e) => {
              // Fallback to default quality if mqdefault is missing
              e.currentTarget.src = youtubeThumbUrl(videoId, 'default');
            }}
          />
          {/* Play button overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 100%)',
            transition: 'background 0.2s',
          }}>
            <div style={{
              width: 56,
              height: 40,
              borderRadius: 8,
              background: '#FF0033',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 24px rgba(255, 0, 51, 0.4)',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                <polygon points="8,5 8,19 19,12" />
              </svg>
            </div>
          </div>
          {/* YouTube logo bottom-right */}
          <div style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            background: 'rgba(0, 0, 0, 0.7)',
            padding: '3px 6px',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <BrandIcon brand="youtube" size={12} />
            <span style={{
              fontSize: 12,
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.08em',
            }}>YOUTUBE</span>
          </div>
        </button>
      )}
    </div>
  );
}

export default function SourceCitation({ source }) {
  const type = source.type || 'other';
  const color = TYPE_COLOR[type] || TYPE_COLOR.other;
  const markFn = TYPE_MARK[type] || TYPE_MARK.other;
  const impl = IMPLICATION_META[source.implication] || IMPLICATION_META.neutral;
  const host = tryHostname(source.url);
  // Resolve from URL only — `resolveBrand(source.source)` would substring-match
  // arbitrary text like "limitless options" to the Limitless TCG brand.
  const brand = brandFromUrl(source.url);
  const ytId = extractYouTubeId(source.url);
  const href = safeHttpUrl(source.url);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '16px 1fr auto',
      gap: 10,
      padding: '10px 0',
      borderBottom: '1px solid rgba(26, 29, 36, 0.5)',
      alignItems: 'start',
    }}>
      {/* Brand or type mark */}
      <div style={{ paddingTop: 2 }}>
        {brand
          ? <BrandIcon brand={brand} size={14} />
          : markFn(color)}
      </div>

      {/* Body */}
      <div style={{ minWidth: 0 }}>
        {/* Source line */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 3,
        }}>
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "'Syne', sans-serif",
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color,
            opacity: 0.85,
          }}>
            {TYPE_LABEL[type] || 'Source'}
          </span>
          <span style={{
            fontSize: 14,
            color: '#A8A498',
            fontFamily: "'Syne', sans-serif",
            fontWeight: 500,
          }}>
            {source.source || host || '—'}
          </span>
          {source.reach && source.reach !== 'unknown' && (
            <ReachChip reach={source.reach} />
          )}
          {source.audience && (
            <span style={{
              fontSize: 14,
              color: '#8A8678',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              letterSpacing: '0.02em',
              background: 'rgba(138,134,120,0.08)',
              border: '1px solid rgba(138,134,120,0.2)',
              borderRadius: 2,
              padding: '1px 6px',
            }}>
              {source.audience}
            </span>
          )}
          {source.date && (
            <>
              <span style={{
                width: 2, height: 2, borderRadius: '50%', background: '#2A2D34',
              }} />
              <span style={{
                fontSize: 13,
                color: '#605C54',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {source.date}
              </span>
            </>
          )}
        </div>

        {/* Title — link */}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: 15,
              fontStyle: 'italic',
              color: '#E8E4DC',
              lineHeight: 1.35,
              textDecoration: 'none',
              borderBottom: '1px solid rgba(232, 228, 220, 0.15)',
              transition: 'border-color 0.15s, color 0.15s',
              display: 'inline-block',
              marginBottom: 4,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderBottomColor = color;
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderBottomColor = 'rgba(232, 228, 220, 0.15)';
              e.currentTarget.style.color = '#E8E4DC';
            }}
          >
            {source.title || 'Untitled source'}
          </a>
        ) : (
          <div style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 15,
            fontStyle: 'italic',
            color: '#E8E4DC',
            lineHeight: 1.35,
            marginBottom: 4,
          }}>
            {source.title || 'Untitled source'}
          </div>
        )}

        {/* Summary */}
        {source.summary && (
          <div style={{
            fontSize: 15,
            color: '#92897C',
            fontFamily: "'Syne', sans-serif",
            fontWeight: 400,
            lineHeight: 1.55,
          }}>
            {source.summary}
          </div>
        )}

        {/* YouTube thumbnail + click-to-play embed */}
        {ytId && <YouTubeEmbed videoId={ytId} title={source.title} />}
      </div>

      {/* Implication arrow */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        paddingTop: 4,
      }}>
        <span style={{
          fontSize: 15,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700,
          color: impl.color,
          lineHeight: 1,
        }}>
          {impl.sym}
        </span>
        <span style={{
          fontSize: 7,
          fontFamily: "'Syne', sans-serif",
          fontWeight: 700,
          letterSpacing: '0.14em',
          color: impl.color,
          opacity: 0.65,
        }}>
          {impl.label}
        </span>
      </div>
    </div>
  );
}
