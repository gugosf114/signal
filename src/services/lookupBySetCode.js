// Resolve a raw set-code input (e.g. "LOB-EN001", "SV7-198", "MOM-001") to a
// canonical card name + game, by hitting the same official APIs Collectr /
// TCGPlayer use under the hood. Closes the gap where typing a set code
// instead of a card name left the LLM searching blindly.
//
// Returns { name, game, setCode, number, source } on hit, or null on miss.

import { fetchWithTimeout } from './http.js';
import { toTcgdexId } from './pokemonIds.js';

// Looser-than-strict set code regex — anything resembling [A-Z0-9]{2,5}
// followed by an optional locale tag and a 1–4 digit number.
const SET_CODE_RE =
  /^([A-Za-z0-9]{2,6})[\s\-_/]+(?:(EN|JP|DE|FR|IT|PT|SP|KR|CH|SS|GR)[\s\-_/]*)?([A-Za-z]?\d{1,4}[A-Za-z]?)$/i;

export function looksLikeSetCode(input) {
  if (!input) return false;
  return SET_CODE_RE.test(input.trim());
}

export function parseSetCode(input) {
  if (!input) return null;
  const m = String(input).trim().match(SET_CODE_RE);
  if (!m) return null;
  const locale = m[2] ? m[2].toLowerCase() : null;
  const number = m[3].toLowerCase();
  const rawCode = `${m[1]}-${m[2] ? m[2] : ''}${m[3]}`.toUpperCase();
  return { rawCode, setCode: m[1].toLowerCase(), locale, number };
}

// ─── Per-game lookups ────────────────────────────────────────────────────────

async function tcgdexJson(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(url, {}, 6000);
      if (res.status === 404 || res.status === 400) return null;
      if (res.ok) return await res.json();
    } catch {}
  }
  return null;
}

// pokemontcg.io is down for about half its calls on a bad day. A typed
// `sv8pt5-161` used to return nothing on those days; a printed code such as
// `PRE 161` never resolved at all because pokemontcg.io does not index the
// abbreviation. TCGdex answers both.
async function lookupPokemonTcgdex({ setCode, number }) {
  let cardId = null;
  if (/^[a-z]{2,6}$/i.test(setCode)) {
    const sets = await tcgdexJson(`https://api.tcgdex.net/v2/en/sets?abbreviation.official=${encodeURIComponent(setCode.toUpperCase())}`);
    const set = Array.isArray(sets) && sets.length === 1
      ? await tcgdexJson(`https://api.tcgdex.net/v2/en/sets/${encodeURIComponent(sets[0].id)}`)
      : null;
    const wanted = String(number).replace(/^0+/, '').toLowerCase() || '0';
    const hit = (set?.cards || []).find((c) => String(c?.localId || '').replace(/^0+/, '').toLowerCase() === wanted);
    cardId = hit?.id || null;
  } else {
    cardId = toTcgdexId(`${setCode}-${number}`);
  }
  if (!cardId) return null;
  const card = await tcgdexJson(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(cardId)}`);
  if (!card?.id || !card?.name) return null;
  const prices = card.pricing?.tcgplayer || {};
  const market = (value) => {
    const n = Number(value?.marketPrice);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const normalPrice = market(prices.normal) ?? market(prices.holofoil);
  const reversePrice = market(prices['reverse-holofoil']);
  return {
    name: card.name,
    game: 'pokemon',
    id: card.id,
    printingId: card.id,
    setCode: card.set?.abbreviation?.official || card.set?.id || null,
    setId: card.set?.id || null,
    setName: card.set?.name || null,
    number: card.localId || null,
    printedTotal: card.set?.cardCount?.official || null,
    rarity: card.rarity || null,
    price: normalPrice ?? reversePrice,
    marketPrices: { normal: normalPrice, reverse: reversePrice },
    imageUrl: card.image ? `${card.image}/low.webp` : null,
    imageLarge: card.image ? `${card.image}/high.webp` : null,
    source: 'tcgdex',
  };
}

async function lookupPokemon({ setCode, number }) {
  // pokemontcg.io supports both set.id and number filters
  const num = number.replace(/^0+/, '') || '0';
  const q = `set.id:${setCode} number:${num}`;
  let card = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchWithTimeout(
        `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=1`
      );
      if (res.ok) { card = (await res.json()).data?.[0] || null; break; }
      if (res.status >= 400 && res.status < 500) break;
    } catch {}
    if (attempt < 2) await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
  }
  if (!card) return lookupPokemonTcgdex({ setCode, number: num });
  const variants = card.tcgplayer?.prices || {};
  const market = (value) => Number.isFinite(value?.market) ? value.market : null;
  const normalPrice = market(variants.normal) ?? market(variants.holofoil);
  const reversePrice = market(variants.reverseHolofoil);
  return {
    name: card.name,
    game: 'pokemon',
    id: card.id,
    printingId: card.id,
    setCode: card.set?.ptcgoCode || card.set?.id,
    setId: card.set?.id,
    setName: card.set?.name,
    number: card.number,
    printedTotal: card.set?.printedTotal || card.set?.total || null,
    rarity: card.rarity || null,
    price: normalPrice ?? reversePrice,
    marketPrices: { normal: normalPrice, reverse: reversePrice },
    imageUrl: card.images?.small || null,
    imageLarge: card.images?.large || card.images?.small || null,
    source: 'pokemontcg.io',
  };
}

async function lookupMtg({ setCode, number }) {
  // Scryfall has a direct endpoint for set+collector_number
  const num = number.replace(/^0+/, '') || '0';
  const res = await fetchWithTimeout(
    `https://api.scryfall.com/cards/${encodeURIComponent(setCode)}/${encodeURIComponent(num)}`
  );
  if (res.status === 404 || !res.ok) return null;
  const card = await res.json();
  if (card.object === 'error') return null;
  const normalPrice = card.prices?.usd ? Number(card.prices.usd) : null;
  const reversePrice = card.prices?.usd_foil ? Number(card.prices.usd_foil) : null;
  return {
    name: card.name,
    game: 'mtg',
    id: card.id,
    printingId: card.id,
    setCode: card.set,
    setName: card.set_name,
    number: card.collector_number,
    rarity: card.rarity || null,
    price: normalPrice ?? reversePrice,
    marketPrices: { normal: normalPrice, reverse: reversePrice },
    imageUrl: card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small || null,
    imageLarge: card.image_uris?.large || card.card_faces?.[0]?.image_uris?.large || null,
    source: 'scryfall',
  };
}

async function lookupYgo({ rawCode }) {
  // YGOPRODeck has a direct exact-print endpoint. Using it avoids the old
  // suffix check where input "1" also matched a code ending in "101".
  const res = await fetchWithTimeout(
    `https://db.ygoprodeck.com/api/v7/cardsetsinfo.php?setcode=${encodeURIComponent(rawCode)}`
  );
  if (!res.ok) return null;
  const card = await res.json();
  if (!card || card.error || !card.name || !card.set_code) return null;
  const id = card.id != null ? String(card.id) : null;
  const code = String(card.set_code).toUpperCase();
  const setPrice = Number(card.set_price);
  const price = Number.isFinite(setPrice) && setPrice > 0 ? setPrice : null;
  return {
    id,
    printingId: id ? `${id}:${code}` : code,
    name: card.name,
    game: 'yugioh',
    setCode: code,
    setId: code,
    setName: card.set_name,
    number: code,
    rarity: card.set_rarity || null,
    price,
    marketPrices: { normal: price, reverse: null },
    source: 'ygoprodeck',
  };
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function lookupBySetCode(input) {
  const parsed = parseSetCode(input);
  if (!parsed) return null;

  // A locale marker is a Yu-Gi-Oh set code. Use the exact endpoint and avoid
  // two unrelated catalogue calls.
  if (parsed.locale) return lookupYgo(parsed).catch(() => null);

  // Without a locale the shape can belong to Pokémon, MTG, or Yu-Gi-Oh.
  // Return only an unambiguous hit instead of silently preferring one game.
  const results = await Promise.allSettled([
    lookupPokemon(parsed).catch(() => null),
    lookupMtg(parsed).catch(() => null),
    lookupYgo(parsed).catch(() => null),
  ]);

  const hits = results.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
  return hits.length === 1 ? hits[0] : null;
}
