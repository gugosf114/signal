// ─── Price top-up ─────────────────────────────────────────────────────────────
// A cached scan keeps its signals for 7 days but its prices for 1 (see
// scanCache.js). When only the prices have aged out there is no reason to spend
// another Anthropic call — the EN price lives in the same free TCG APIs the
// scan pre-fetch already uses. Pull it directly and patch the cached result.
//
// Returns a `prices`-shaped patch ({ en_price }) or null if nothing usable came
// back. Never throws. A failed top-up keeps the cached price, except when the
// exact-print source explicitly says no exact price exists; that clears an old
// broad card-level number instead of preserving a known wrong price.

import { fetchCardData } from './fetchCardData.js';
import { fetchTcgplayerPrice } from './fetchTcgplayerPrice.js';
import { fetchPriceHistory } from './priceHistory.js';

// priceLines come back per game as:
//   pokemon  "Holofoil: $12.34 market / $10.00 low / $15.00 high"
//   mtg      "Non-foil: $293.41"
//   yugioh   "TCGPlayer: $12.34"
// The first dollar figure on the first line is the headline market price in all
// three shapes.
function headlinePrice(priceLines) {
  for (const line of priceLines || []) {
    const m = String(line).match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
    if (m) return `$${m[1]}`;
  }
  return null;
}

// `pin` is the printing this cached scan is actually about. Without it the
// top-up looks the name up fresh and can come back with a different printing's
// price — a $7 card quietly wearing a $1,499 number a day later.
async function withHistory(patch, pin) {
  if (!patch || !pin) return patch;
  const history = await fetchPriceHistory(pin).catch(() => null);
  return history ? { ...patch, history } : patch;
}

export async function refreshPrices(cardName, game, pin = null) {
  try {
    // The card catalogues are often blank for new or premium Pokémon and
    // Yu-Gi-Oh! printings even when TCGplayer has a live exact-product market
    // price. Use the same strict name + set + number + rarity selector as
    // search. It returns null rather than borrowing another printing's price.
    if (['pokemon', 'yugioh'].includes(game) && pin) {
      const tcgplayer = await fetchTcgplayerPrice(pin).catch(() => null);
      const exactPatch = pricePatchFromTcgplayer(tcgplayer);
      if (exactPatch) return withHistory({ ...exactPatch, tcgplayer_product_id: exactPatch.tcgplayer_product_id }, { ...pin, tcgplayerProductId: pin.tcgplayerProductId || exactPatch.tcgplayer_product_id });
    }
    const data = await fetchCardData(cardName, game, pin);
    return withHistory(pricePatchFromCardData(data), pin);
  } catch {
    return null;
  }
}

export function pricePatchFromTcgplayer(data) {
  const price = Number(data?.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    en_price: `$${price.toFixed(2)}`,
    price_source: data.source || 'TCGplayer',
    price_url: data.url || '',
    tcgplayer_product_id: data.productId || null,
    price_checked_at: new Date().toISOString(),
  };
}

export function pricePatchFromCardData(data) {
  if (!data) return null;
  const checked = new Date().toISOString();
  if (data.priceScope === 'exact-print price unavailable') {
    return { en_price: '', price_source: '', price_url: '', price_checked_at: checked };
  }
  const en = headlinePrice(data.priceLines);
  return en ? {
    en_price: en,
    price_source: data.priceSource || '',
    price_url: data.priceUrl || data.tcgplayerUrl || data.scryfallUri || '',
    price_checked_at: checked,
  } : null;
}
