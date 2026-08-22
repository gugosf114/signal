import { SIGNAL_KEYS } from '../config/signals.js';

const GAMES = new Set(['pokemon', 'yugioh', 'mtg']);
const SOURCE_TYPES = new Set([
  'youtube', 'tournament', 'reddit', 'twitter', 'marketplace_en',
  'marketplace_jp', 'editorial', 'population_report', 'other',
]);
const IMPLICATIONS = new Set(['up', 'down', 'neutral']);
const REACH = new Set(['T1', 'T2', 'T3', 'unknown']);

function text(value, max = 500) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function alignment(value) {
  const raw = text(value, 240).toLowerCase();
  if (!raw) return 'unknown';
  if (raw.includes('disagree') || raw.includes('not agree') || raw.includes('conflict')) return 'disagree';
  if (/\bagree(?:s|d|ment)?\b/.test(raw) || raw.includes('align')) return 'agree';
  return 'mixed';
}

function cleanSource(source) {
  if (!source || typeof source !== 'object') return null;
  return {
    type: SOURCE_TYPES.has(source.type) ? source.type : 'other',
    source: text(source.source, 120),
    title: text(source.title, 240),
    date: text(source.date, 40) || null,
    summary: text(source.summary, 500),
    implication: IMPLICATIONS.has(source.implication) ? source.implication : 'neutral',
    url: typeof source.url === 'string' ? source.url.trim() : '',
    reach: REACH.has(source.reach) ? source.reach : 'unknown',
    audience: text(source.audience, 80) || null,
  };
}

function cleanSignal(signal) {
  if (!signal || typeof signal !== 'object' || !SIGNAL_KEYS.includes(signal.key)) return null;
  return {
    key: signal.key,
    level: Math.max(0, Math.min(5, Math.round(finite(signal.level, 0)))),
    detail: text(signal.detail, 500),
    sources: (Array.isArray(signal.sources) ? signal.sources : [])
      .map(cleanSource)
      .filter(Boolean),
  };
}

function cleanListing(listing, auction = false) {
  if (!listing || typeof listing !== 'object') return null;
  const priceKey = auction ? 'current_bid_usd' : 'price_usd';
  return {
    title: text(listing.title, 240),
    [priceKey]: Math.max(0, finite(listing[priceKey], 0)),
    condition: text(listing.condition, 80),
    ...(auction
      ? { bid_count: Math.max(0, Math.floor(finite(listing.bid_count, 0))), time_remaining: text(listing.time_remaining, 80) }
      : { shipping: text(listing.shipping, 80), seller: text(listing.seller, 120) }),
    url: typeof listing.url === 'string' ? listing.url.trim() : '',
  };
}

export function normalizeAnalysis(parsed, { cardName = '', game = null, now = Date.now() } = {}) {
  const input = parsed && typeof parsed === 'object' ? parsed : {};
  const byKey = new Map();
  let malformed = !Array.isArray(input.signals);
  for (const raw of Array.isArray(input.signals) ? input.signals : []) {
    const signal = cleanSignal(raw);
    if (!signal || byKey.has(signal.key)) {
      malformed = true;
      continue;
    }
    byKey.set(signal.key, signal);
  }
  if (byKey.size !== SIGNAL_KEYS.length) malformed = true;

  const resolvedGame = GAMES.has(game) ? game : (GAMES.has(input.game) ? input.game : null);
  const prices = input.prices && typeof input.prices === 'object' ? input.prices : {};
  const ebay = input.ebay_listings && typeof input.ebay_listings === 'object' ? input.ebay_listings : {};

  return {
    ...input,
    card_name: text(cardName || input.card_name, 180),
    game: resolvedGame,
    prices: {
      en_price: text(prices.en_price, 160),
      trend_30d: text(prices.trend_30d, 160),
      signal_vs_market: alignment(prices.signal_vs_market),
    },
    ebay_listings: {
      buy_it_now: (Array.isArray(ebay.buy_it_now) ? ebay.buy_it_now : []).map((item) => cleanListing(item, false)).filter(Boolean).slice(0, 2),
      auction: (Array.isArray(ebay.auction) ? ebay.auction : []).map((item) => cleanListing(item, true)).filter(Boolean).slice(0, 1),
    },
    // The app has no verified graded-sales feed. A model memory estimate is not
    // market evidence, so the calculator stays closed until a real comp exists.
    grading_roi: {
      raw_price_usd: 0,
      psa10_est_usd: 0,
      grading_cost_usd: 0,
      net_roi_usd: 0,
      net_roi_pct: 0,
      verdict: 'insufficient_data',
      confidence: 'insufficient_data',
      note: 'No verified recent PSA 10 sale was retrieved.',
    },
    signals: SIGNAL_KEYS.map((key) => byKey.get(key)).filter(Boolean),
    summary: text(input.summary, 500),
    _truncated: Boolean(input._truncated || malformed),
    _validated: true,
    _scannedAt: new Date(now).toISOString(),
  };
}
