import React, { useEffect, useState } from 'react';
import { BrandIcon } from '../config/brandIcons';
import { GAME_LABELS, getScoreLabel, calculateOverallScore } from '../config/signals';
import { getCachedScanEntry } from '../services/scanCache';
import { refreshPrices } from '../services/refreshPrices';
import CardImage from './CardImage';
import ScrollReveal from './ScrollReveal';
import { sanitizeRecentScans } from '../services/recentScans';

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
    const scans = sanitizeRecentScans(JSON.parse(raw));
    if (scans.length === 0) return null;
    const top = scans[0];
    if (!top?.name) return null;
    const cachedEntry = getCachedScanEntry(top.name, top.game, top.pin || null);
    if (!cachedEntry) {
      // Fallback: we know name + game + score from the recents row even if
      // the full scan body isn't in cache anymore. Keep the exact saved price
      // on screen while its free catalogue refresh runs.
      const savedPrice = Number(top.pin?.price);
      return {
        name: top.name,
        game: top.game,
        score: typeof top.score === 'number' ? top.score : 0,
        pin: top.pin || null,
        prices: {
          en_price: Number.isFinite(savedPrice) && savedPrice > 0
            ? `$${savedPrice.toFixed(2)}`
            : '',
          trend_30d: '',
        },
        creator: null,
        needsPriceRefresh: true,
      };
    }
    const cached = cachedEntry.data;
    const score = calculateOverallScore(cached.signals || [], top.game);
    const creatorSignal = (cached.signals || []).find((s) => s.key === 'creator');
    const creatorSrc = creatorSignal?.sources?.[0];
    return {
      name: top.name,
      game: top.game,
      score,
      pin: top.pin || cached._pin || cached.printing || null,
      prices: cached.prices || {},
      creator: creatorSrc
        ? {
            headline: creatorSrc.title || creatorSignal?.detail || 'Creator coverage',
            detail: creatorSignal?.detail || creatorSrc.summary || '',
            implication: creatorSrc.implication || 'neutral',
            level: creatorSignal?.level || 0,
          }
        : null,
      needsPriceRefresh: cachedEntry.pricesStale,
    };
  } catch {
    return null;
  }
}

function trendSym(trend) {
  if (!trend) return { sym: '—', color: 'var(--signal-text-muted)' };
  const t = String(trend).toLowerCase();
  if (t.includes('up') || t.includes('rising') || t.includes('increas') || t.includes('lead')) {
    return { sym: '▲', color: '#608870' };
  }
  if (t.includes('down') || t.includes('falling') || t.includes('decreas')) {
    return { sym: '▼', color: '#C44040' };
  }
  return { sym: '►', color: '#A09060' };
}

// ─── Tiles ───────────────────────────────────────────────────────────────────

function LatestSignalPanel({ data, isSample }) {
  const gameMeta = GAME_LABELS[data.game] || GAME_LABELS.pokemon;
  const scoreMeta = getScoreLabel(data.score ?? 50);
  const prices = data.prices || {};
  const trend = trendSym(prices.trend_30d);
  const creator = data.creator;

  return (
    <section
      className="latest-signal fade-slide-up"
      style={{ '--latest-signal-color': scoreMeta.color }}
      aria-label={`${isSample ? 'Sample' : 'Latest'} Signal for ${data.name}`}
    >
      <header className="latest-signal-head">
        <span>{isSample ? 'Sample Signal' : 'Latest Signal'}</span>
        <span className="latest-signal-game" style={{ color: gameMeta.color }}>
          <BrandIcon brand={data.game} size={11} style={{ opacity: 0.78 }} />
          {gameMeta.label}
        </span>
      </header>

      <div className="latest-signal-main">
        <div className="latest-signal-identity">
          <h2>{data.name}</h2>
          <div className="latest-signal-score">
            <strong style={{ color: scoreMeta.color }}>{data.score}</strong>
            <span>/100</span>
            <b style={{ color: scoreMeta.color }}>{scoreMeta.label}</b>
          </div>
        </div>
        <CardImage cardName={data.name} game={data.game} pin={data.pin || null} size={104} glowColor={scoreMeta.color} />
      </div>

      <div className="latest-signal-market">
        <div>
          <span>EN price</span>
          <strong>{prices.en_price || 'No exact price'}</strong>
        </div>
        <div>
          <span>30-day trend</span>
          <strong style={{ color: trend.color }}>{trend.sym}</strong>
          <small style={{ color: trend.color }}>{prices.trend_30d || 'No exact data'}</small>
        </div>
      </div>

      <div className="latest-signal-creator">
        <div className="latest-signal-creator-head">
          <span>Creator Attention</span>
          <div aria-label={`Creator signal ${creator?.level || 0} of 5`}>
            {[1, 2, 3, 4, 5].map((value) => (
              <i key={value} className={value <= (creator?.level || 0) ? 'is-on' : ''} />
            ))}
          </div>
        </div>
        <div className="latest-signal-creator-line">
          <BrandIcon brand="youtube" size={13} />
          <strong>{creator?.headline || 'No exact-print creator source'}</strong>
          {creator && (
            <b style={{ color: creator.implication === 'up' ? '#608870' : creator.implication === 'down' ? '#C44040' : '#A09060' }}>
              {creator.implication === 'up' ? '▲ Bullish' : creator.implication === 'down' ? '▼ Bearish' : '► Neutral'}
            </b>
          )}
        </div>
        {creator?.detail && <p>{creator.detail}</p>}
      </div>
    </section>
  );
}

export default function EmptyState() {
  // Lazy init from localStorage — synchronous, no flicker between sample and real.
  const [featured, setFeatured] = useState(() => loadFeaturedScan());
  useEffect(() => {
    if (!featured?.needsPriceRefresh || !featured.pin) return;
    let cancelled = false;
    refreshPrices(featured.name, featured.game, featured.pin).then((prices) => {
      if (cancelled || !prices) return;
      setFeatured((current) => current ? {
        ...current,
        prices: { ...current.prices, ...prices, trend_30d: '' },
        needsPriceRefresh: false,
      } : current);
    });
    return () => { cancelled = true; };
  }, [featured?.name, featured?.game, featured?.needsPriceRefresh]);
  const isSample = !featured;
  const data = featured || SAMPLE_DATA;

  return (
    <ScrollReveal delay={70} className="latest-signal-wrap">
      <LatestSignalPanel data={data} isSample={isSample} />
      {isSample && (
        <p className="latest-signal-note">
          Compare the exact printing, verified sources, and eight market signals. A full scan can take up to two minutes.
        </p>
      )}
    </ScrollReveal>
  );
}
