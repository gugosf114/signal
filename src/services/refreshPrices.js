// ─── Price top-up ─────────────────────────────────────────────────────────────
// A cached scan keeps its signals for 7 days but its prices for 1 (see
// scanCache.js). When only the prices have aged out there is no reason to spend
// another Anthropic call — the EN price lives in the same free TCG APIs the
// scan pre-fetch already uses. Pull it directly and patch the cached result.
//
// Returns a `prices`-shaped patch ({ en_price }) or null if nothing usable came
// back. Never throws: a failed top-up leaves the cached price in place, which
// is strictly better than blanking it.

import { fetchCardData } from './fetchCardData';

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

export async function refreshPrices(cardName, game) {
  try {
    const data = await fetchCardData(cardName, game);
    if (!data) return null;
    const en = headlinePrice(data.priceLines);
    if (!en) return null;
    return { en_price: en };
  } catch {
    return null;
  }
}
