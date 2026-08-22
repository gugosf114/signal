import React, { useState } from 'react';
import { BrandIcon } from '../config/brandIcons';
import { GAME_LABELS, getScoreLabel, calculateOverallScore } from '../config/signals';
import { getCachedScan } from '../services/scanCache';
import CardImage from './CardImage';

// ─── Featured-scan loader ────────────────────────────────────────────────────
// On first render, pull the user's most recent scan out of localStorage.
// If found, the dashboard's bottom showcase tile reflects that scan instead
// of the static Charizard ex sample. New users (no scans) see the sample
// with a "SAMPLE" watermark chip so it doesn't read as a real result.

const SAMPLE_DATA = {
  name: 'Charizard ex',
  game: 'pokemon',
  score: 82,
  prices: {
    en_price: '$42.50',
    trend_30d: 'up — momentum stacking',
  },
  creator: {
    headline: 'Leonhart pulls Charizard ex',
    detail: '1.6M-sub channel, 284k views in 48h. Strong pull signal.',
    implication: 'up',
    level: 4,
  },
};

function loadFeaturedScan() {
  try {
    const raw = localStorage.getItem('signal_recent_scans');
    if (!raw) return null;
    const scans = JSON.parse(raw);
    if (!Array.isArray(scans) || scans.length === 0) return null;
    const top = scans[0];
    if (!top?.name) return null;
    const cached = getCachedScan(top.name, top.game, top.pin || null);
    if (!cached) {
      // Fallback: we know name + game + score from the recents row even if
      // the full scan body isn't in cache anymore. Render minimal real data.
      return {
        name: top.name,
        game: top.game,
        score: typeof top.score === 'number' ? top.score : 0,
        prices: {},
        creator: null,
      };
    }
    const score = calculateOverallScore(cached.signals || [], top.game);
    const creatorSignal = (cached.signals || []).find((s) => s.key === 'creator');
    const creatorSrc = creatorSignal?.sources?.[0];
    return {
      name: top.name,
      game: top.game,
      score,
      prices: cached.prices || {},
      creator: creatorSrc
        ? {
            headline: creatorSrc.title || creatorSignal?.detail || 'Creator coverage',
            detail: creatorSignal?.detail || creatorSrc.summary || '',
            implication: creatorSrc.implication || 'neutral',
            level: creatorSignal?.level || 0,
          }
        : null,
    };
  } catch {
    return null;
  }
}

function trendSym(trend) {
  if (!trend) return { sym: '—', color: '#605C54' };
  const t = String(trend).toLowerCase();
  if (t.includes('up') || t.includes('rising') || t.includes('increas') || t.includes('lead')) {
    return { sym: '▲', color: '#608870' };
  }
  if (t.includes('down') || t.includes('falling') || t.includes('decreas')) {
    return { sym: '▼', color: '#C44040' };
  }
  return { sym: '►', color: '#A09060' };
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const label = {
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: '0.16em',
  fontFamily: "'Syne', sans-serif",
  textTransform: 'uppercase',
  marginBottom: 4,
};

// ─── Tiles ───────────────────────────────────────────────────────────────────

function ScoreTile({ data, isSample }) {
  const gameMeta = GAME_LABELS[data.game] || GAME_LABELS.pokemon;
  const scoreMeta = getScoreLabel(data.score ?? 50);

  return (
    <div style={{
      position: 'relative',
      flex: 1,
      background: '#0E1014',
      border: '1px solid #1A1D24',
      borderRadius: 3,
      padding: '18px 20px',
      display: 'flex',
      gap: 16,
      alignItems: 'center',
      minWidth: 0,
      overflow: 'hidden',
    }}>
      {isSample && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 12,
          fontFamily: "'Syne', sans-serif",
          fontSize: 7,
          fontWeight: 700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: '#92897C',
          border: '1px solid #494640',
          background: 'rgba(196,64,64,0.04)',
          padding: '3px 8px 2px',
          borderRadius: 2,
          zIndex: 2,
          pointerEvents: 'none',
        }}>
          Sample
        </div>
      )}

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minWidth: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <BrandIcon brand={data.game} size={12} style={{ opacity: 0.6 }} />
          <span style={{
            fontSize: 9,
            fontFamily: "'Syne', sans-serif",
            color: gameMeta.color,
            letterSpacing: '0.14em',
            fontWeight: 700,
            textTransform: 'uppercase',
          }}>{gameMeta.label}</span>
        </div>
        <div style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: 18,
          fontStyle: 'italic',
          color: '#E8E4DC',
          lineHeight: 1.1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {data.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            fontSize: 44,
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            color: scoreMeta.color,
            lineHeight: 1,
            letterSpacing: '-0.04em',
          }}>{data.score}</span>
          <span style={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono', monospace",
            color: '#2A2D34',
          }}>/100</span>
        </div>
        <div style={{
          fontSize: 9,
          fontFamily: "'Syne', sans-serif",
          letterSpacing: '0.14em',
          color: scoreMeta.color,
          fontWeight: 700,
          textTransform: 'uppercase',
        }}>{scoreMeta.label}</div>
      </div>

      <CardImage
        cardName={data.name}
        game={data.game}
        size={132}
        glowColor={scoreMeta.color}
      />
    </div>
  );
}

function PriceTile({ prices }) {
  const trend = trendSym(prices.trend_30d);
  return (
    <div style={{
      flex: 1,
      background: '#0B0D10',
      border: '1px solid #1A1D24',
      borderRadius: 3,
      overflow: 'hidden',
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #1A1D24' }}>
        <div style={{ flex: 1, padding: '12px 14px' }}>
          <div style={{ ...label, color: '#7A7368' }}>EN Price</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 600, color: '#E8E4DC' }}>
            {prices.en_price || '—'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex' }}>
        <div style={{ flex: 1, padding: '10px 14px' }}>
          <div style={{ ...label, color: '#7A7368' }}>30-Day Trend</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, color: trend.color, fontWeight: 700 }}>
            {trend.sym}
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalTile({ creator }) {
  return (
    <div style={{
      flex: 1,
      background: '#0E1014',
      border: '1px solid #1A1D24',
      borderRadius: 3,
      padding: '18px 20px',
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 11,
          color: '#B08060',
          letterSpacing: '0.04em',
          fontWeight: 500,
          flex: 1,
        }}>Creator Attention</span>
        <div style={{ display: 'flex', gap: 3 }} aria-label={`Creator signal ${creator?.level || 0} of 5`}>
          {[1,2,3,4,5].map((value) => (
            <div key={value} style={{ width: 6, height: 6, borderRadius: '50%', background: value <= (creator?.level || 0) ? '#B08060' : '#1A1D24' }} />
          ))}
        </div>
      </div>
      <div style={{ paddingLeft: 12, borderLeft: '1px solid #1A1D24' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <BrandIcon brand="youtube" size={12} />
          <span style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 13,
            fontStyle: 'italic',
            color: '#E8E4DC',
          }}>
            {creator?.headline || '—'}
          </span>
        </div>
        <div style={{
          fontSize: 11,
          fontFamily: "'Syne', sans-serif",
          color: '#92897C',
          lineHeight: 1.5,
        }}>
          {creator?.detail || ''}
        </div>
        {creator && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
            <span style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono'",
              color: creator.implication === 'up' ? '#608870' : creator.implication === 'down' ? '#C44040' : '#A09060',
              fontWeight: 700,
            }}>{creator.implication === 'up' ? '▲' : creator.implication === 'down' ? '▼' : '►'}</span>
            <span style={{
              fontSize: 7,
              fontFamily: "'Syne', sans-serif",
              letterSpacing: '0.14em',
              color: creator.implication === 'up' ? '#608870' : creator.implication === 'down' ? '#C44040' : '#A09060',
              opacity: 0.7,
              fontWeight: 700,
              textTransform: 'uppercase',
            }}>{creator.implication === 'up' ? 'Bullish' : creator.implication === 'down' ? 'Bearish' : 'Neutral'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EmptyState() {
  // Lazy init from localStorage — synchronous, no flicker between sample and real.
  const [featured] = useState(() => loadFeaturedScan());
  const isSample = !featured;
  const data = featured || SAMPLE_DATA;

  return (
    <div style={{ padding: '40px 0 20px' }}>
      <div className="empty-state-tiles">
        <ScoreTile data={data} isSample={isSample} />
        <PriceTile prices={data.prices || {}} />
        <SignalTile creator={data.creator} />
      </div>
      {isSample && (
        <p style={{
          marginTop: 20,
          textAlign: 'center',
          fontFamily: "'Syne', sans-serif",
          fontSize: 12,
          color: '#605C54',
          lineHeight: 1.7,
          maxWidth: 520,
          marginLeft: 'auto',
          marginRight: 'auto',
          letterSpacing: '0.01em',
        }}>
          Compare the exact printing, verified sources, and eight market signals. A full scan can take up to two minutes.
        </p>
      )}
    </div>
  );
}
