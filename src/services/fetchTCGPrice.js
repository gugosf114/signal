// ─── TCG Price API Integration Framework ─────────────────────────────────────
// Priority order (first available key wins):
//
//   1. tcgapi.dev         — VITE_TCGAPI_DEV_KEY      — all games, 30d history, JP data
//   2. TCG Price Lookup   — VITE_TCGPL_KEY            — 8 games incl. Pokémon Japan pricing
//   3. TCGAPIs.com        — VITE_TCGAPIS_KEY          — 80+ TCGs, multi-marketplace
//   4. JustTCG            — VITE_JUSTTCG_KEY          — condition-specific, bulk lookups
//   5. Free fallback      — existing pokemontcg.io / Scryfall / YGOPRODeck (always works)
//
// To activate: add the key to .env.local, restart dev server.
// All paid APIs require signing up at their respective sites.
// tcgapi.dev and TCG Price Lookup both have free tiers (100-1000 req/day).

// ─── tcgapi.dev ──────────────────────────────────────────────────────────────
// Docs: https://tcgapi.dev/docs
// Free: 100 req/day | Pro: $49.99/mo (10k req/day, commercial license)
// Covers: Pokemon, MTG, YGO + 85 more. Daily price refresh. 30d history.
// JP note: includes Pokemon Japan pricing (verify coverage before relying on it)

async function fetchFromTCGApiDev(cardName, game, apiKey) {
  const gameMap = { pokemon: 'pokemon', mtg: 'magic', yugioh: 'yugioh' };
  const gameName = gameMap[game];
  if (!gameName) return null;

  const res = await fetch(
    `https://api.tcgapi.dev/v1/cards/search?game=${gameName}&name=${encodeURIComponent(cardName)}&limit=3`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const card = data.cards?.[0] || data.data?.[0];
  if (!card) return null;

  const prices = card.prices || card.market_prices || {};
  const priceLines = [];
  if (prices.usd_market)  priceLines.push(`Market: $${Number(prices.usd_market).toFixed(2)}`);
  if (prices.usd_low)     priceLines.push(`Low: $${Number(prices.usd_low).toFixed(2)}`);
  if (prices.usd_high)    priceLines.push(`High: $${Number(prices.usd_high).toFixed(2)}`);
  if (prices.usd_foil)    priceLines.push(`Foil: $${Number(prices.usd_foil).toFixed(2)}`);
  // JP pricing (if available in the response)
  const jpPrice = prices.jpy_market || prices.jp_market;
  const jpPriceLine = jpPrice ? `JP Market: ¥${Number(jpPrice).toLocaleString()}` : null;

  // 30-day price history
  const history = card.price_history || card.history || [];
  const trend30d = history.length >= 2
    ? computeTrend(history.map(h => h.price || h.usd_market))
    : null;

  return {
    source: 'tcgapi.dev',
    game,
    name: card.name,
    setName: card.set_name || card.set?.name,
    rarity: card.rarity,
    priceLines: priceLines.length ? priceLines : null,
    jpPriceLine,
    trend30d,
    legalFormats: card.legalities
      ? Object.entries(card.legalities).filter(([, v]) => v === 'Legal').map(([k]) => k)
      : null,
  };
}

// ─── TCG Price Lookup ─────────────────────────────────────────────────────────
// Docs: https://tcgpricelookup.com/docs
// Covers: Pokemon, Pokemon Japan, MTG, YGO, Lorcana, One Piece, Star Wars, F&B
// Key feature: Pokémon Japan pricing from JP marketplaces — most valuable for Signal

async function fetchFromTCGPriceLookup(cardName, game, apiKey) {
  const gameMap = { pokemon: 'pokemon', mtg: 'mtg', yugioh: 'yugioh' };
  const gameName = gameMap[game];
  if (!gameName) return null;

  const res = await fetch(
    `https://api.tcgpricelookup.com/v1/cards?name=${encodeURIComponent(cardName)}&game=${gameName}`,
    {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(5000),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const card = data.cards?.[0] || data.data?.[0];
  if (!card) return null;

  const prices = card.prices || {};
  const priceLines = [];
  if (prices.tcgplayer_market) priceLines.push(`TCGPlayer: $${Number(prices.tcgplayer_market).toFixed(2)}`);
  if (prices.ebay_avg)         priceLines.push(`eBay avg: $${Number(prices.ebay_avg).toFixed(2)}`);
  const jpPriceLine = prices.jp_market
    ? `JP Market: ¥${Number(prices.jp_market).toLocaleString()}`
    : null;
  const gradedLines = [];
  if (prices.psa_10) gradedLines.push(`PSA 10: $${Number(prices.psa_10).toFixed(2)}`);

  return {
    source: 'tcgpricelookup.com',
    game,
    name: card.name,
    setName: card.set_name,
    rarity: card.rarity,
    priceLines: priceLines.length ? priceLines : null,
    gradedLines: gradedLines.length ? gradedLines : null,
    jpPriceLine,
    trend30d: prices.change_30d ? `${prices.change_30d > 0 ? '+' : ''}${prices.change_30d.toFixed(1)}%` : null,
  };
}

// ─── TCGAPIs.com ──────────────────────────────────────────────────────────────
// Docs: https://tcgapis.com/docs
// Covers: 80+ TCGs, multi-marketplace (TCGPlayer, Cardmarket, Cardtrader, CardKingdom)

async function fetchFromTCGAPIs(cardName, game, apiKey) {
  const res = await fetch(
    `https://api.tcgapis.com/v1/cards/search?name=${encodeURIComponent(cardName)}&game=${game}`,
    {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(5000),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const card = data.cards?.[0];
  if (!card) return null;

  const prices = card.prices || {};
  const priceLines = [];
  if (prices.tcgplayer) priceLines.push(`TCGPlayer: $${Number(prices.tcgplayer).toFixed(2)}`);
  if (prices.cardmarket) priceLines.push(`Cardmarket: €${Number(prices.cardmarket).toFixed(2)}`);
  if (prices.cardkingdom) priceLines.push(`CardKingdom: $${Number(prices.cardkingdom).toFixed(2)}`);

  return {
    source: 'tcgapis.com',
    game,
    name: card.name,
    setName: card.set_name,
    rarity: card.rarity,
    priceLines: priceLines.length ? priceLines : null,
    jpPriceLine: null,
  };
}

// ─── JustTCG ──────────────────────────────────────────────────────────────────
// Docs: https://justtcg.com/docs
// Covers: MTG, Pokemon, YGO. Condition-specific, foil, bulk lookups.

async function fetchFromJustTCG(cardName, game, apiKey) {
  const res = await fetch(
    `https://api.justtcg.com/v1/cards?name=${encodeURIComponent(cardName)}&game=${game}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const card = data.cards?.[0];
  if (!card) return null;

  const prices = card.prices || {};
  const priceLines = Object.entries(prices)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}: $${Number(v).toFixed(2)}`);

  return {
    source: 'justtcg.com',
    game,
    name: card.name,
    priceLines: priceLines.length ? priceLines : null,
    jpPriceLine: null,
  };
}

// ─── Trend helper ─────────────────────────────────────────────────────────────

function computeTrend(prices) {
  if (prices.length < 2) return null;
  const recent = prices[prices.length - 1];
  const old = prices[0];
  if (!recent || !old || old === 0) return null;
  const pct = ((recent - old) / old) * 100;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}% (30d)`;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function fetchEnhancedPrice(cardName, game) {
  const keys = {
    tcgapiDev: import.meta.env.VITE_TCGAPI_DEV_KEY,
    tcgpl:     import.meta.env.VITE_TCGPL_KEY,
    tcgapis:   import.meta.env.VITE_TCGAPIS_KEY,
    justtcg:   import.meta.env.VITE_JUSTTCG_KEY,
  };

  // Try each service in priority order, return first successful result
  if (keys.tcgapiDev) {
    const r = await fetchFromTCGApiDev(cardName, game, keys.tcgapiDev).catch(() => null);
    if (r) return r;
  }
  if (keys.tcgpl) {
    const r = await fetchFromTCGPriceLookup(cardName, game, keys.tcgpl).catch(() => null);
    if (r) return r;
  }
  if (keys.tcgapis) {
    const r = await fetchFromTCGAPIs(cardName, game, keys.tcgapis).catch(() => null);
    if (r) return r;
  }
  if (keys.justtcg) {
    const r = await fetchFromJustTCG(cardName, game, keys.justtcg).catch(() => null);
    if (r) return r;
  }
  return null;
}
