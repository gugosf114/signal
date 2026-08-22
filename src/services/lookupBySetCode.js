// Resolve a raw set-code input (e.g. "LOB-EN001", "SV7-198", "MOM-001") to a
// canonical card name + game, by hitting the same official APIs Collectr /
// TCGPlayer use under the hood. Closes the gap where typing a set code
// instead of a card name left the LLM searching blindly.
//
// Returns { name, game, setCode, number, source } on hit, or null on miss.

import { fetchWithTimeout } from './http.js';

// Looser-than-strict set code regex — anything resembling [A-Z0-9]{2,5}
// followed by an optional locale tag and a 1–4 digit number.
const SET_CODE_RE =
  /^([A-Za-z0-9]{2,6})[\s\-_/]+(?:(EN|JP|DE|FR|IT|PT|SP|KR|CH|SS|GR)[\s\-_/]*)?(\d{1,4}[A-Za-z]?)$/i;

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

async function lookupPokemon({ setCode, number }) {
  // pokemontcg.io supports both set.id and number filters
  const num = number.replace(/^0+/, '') || '0';
  const q = `set.id:${setCode} number:${num}`;
  const res = await fetchWithTimeout(
    `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=1`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const card = data.data?.[0];
  if (!card) return null;
  return {
    name: card.name,
    game: 'pokemon',
    id: card.id,
    printingId: card.id,
    setCode: card.set?.id,
    setName: card.set?.name,
    number: card.number,
    printedTotal: card.set?.printedTotal || card.set?.total || null,
    rarity: card.rarity || null,
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
  return {
    name: card.name,
    game: 'mtg',
    id: card.id,
    printingId: card.id,
    setCode: card.set,
    setName: card.set_name,
    number: card.collector_number,
    rarity: card.rarity || null,
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
