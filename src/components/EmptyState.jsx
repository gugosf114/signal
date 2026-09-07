import React, { useEffect, useState } from 'react';
import { BrandIcon } from '../config/brandIcons';
import { GAME_LABELS, getScoreLabel, calculateOverallScore } from '../config/signals';
import { getCachedScanEntry } from '../services/scanCache';
import { refreshPrices } from '../services/refreshPrices';
import CardImage from './CardImage';
import ScrollReveal from './ScrollReveal';
import { sanitizeRecentScans } from '../services/recentScans';
import { printingLabel } from '../services/printing';

// ─── Featured-scan loader ────────────────────────────────────────────────────
// On first render, pull the user's most recent scan out of localStorage.
// If found, the dashboard's bottom showcase tile reflects that exact scan.
// With no scan there is no fake sample card and no invented market data.

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
          price_source: top.pin?.priceSource || '',
          price_checked_at: top.pin?.priceCheckedAt || '',
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
      pin: top.pin || cached.card || cached._pin || cached.printing || null,
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

// ─── Tiles ───────────────────────────────────────────────────────────────────

function LatestSignalPanel({ data }) {
  const gameMeta = GAME_LABELS[data.game] || GAME_LABELS.pokemon;
  const scoreMeta = getScoreLabel(data.score ?? 50);
  const prices = data.prices || {};
  const creator = data.creator;
  const checkedDate = new Date(prices.price_checked_at || data.pin?.priceCheckedAt || '');
  const checked = Number.isNaN(checkedDate.getTime())
    ? null
    : checkedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const priceNote = [prices.price_source || data.pin?.priceSource, checked ? `checked ${checked}` : null]
    .filter(Boolean).join(' · ');

  return (
    <section
      className="latest-signal fade-slide-up"
      style={{ '--latest-signal-color': scoreMeta.color }}
      aria-label={`Latest Signal for ${data.name}`}
    >
      <header className="latest-signal-head">
        <span>Latest Signal</span>
        <span className="latest-signal-game" style={{ color: gameMeta.color }}>
          <BrandIcon brand={data.game} size={11} style={{ opacity: 0.78 }} />
          {gameMeta.label}
        </span>
      </header>

      <div className="latest-signal-main">
        <div className="latest-signal-identity">
          <h2>{data.name}</h2>
          {printingLabel(data.pin) && <small className="latest-signal-printing">{printingLabel(data.pin)}</small>}
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
          {priceNote && <small>{priceNote}</small>}
        </div>
        {prices.history?.change30 !== null && prices.history?.change30 !== undefined && (
          <div>
            <span>30-day</span>
            <strong style={{ color: prices.history.change30 >= 3 ? '#608870' : prices.history.change30 <= -3 ? '#C44040' : '#A09060' }}>
              {prices.history.change30 > 0 ? '+' : ''}{prices.history.change30}%
            </strong>
            <small>TCGplayer · exact SKU</small>
          </div>
        )}
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
        prices: { ...current.prices, ...prices },
        needsPriceRefresh: false,
      } : current);
    });
    return () => { cancelled = true; };
  }, [featured?.name, featured?.game, featured?.needsPriceRefresh]);
  return (
    <ScrollReveal delay={70} className="latest-signal-wrap">
      {featured ? <LatestSignalPanel data={featured} /> : (
        <p className="latest-signal-note">
          Your latest exact card will appear here after its first full Signal.
        </p>
      )}
    </ScrollReveal>
  );
}
