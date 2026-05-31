// Resolve a raw set-code input (e.g. "LOB-EN001", "SV7-198", "MOM-001") to a
// canonical card name + game, by hitting the same official APIs Collectr /
// TCGPlayer use under the hood. Closes the gap where typing a set code
// instead of a card name left the LLM searching blindly.
//
// Returns { name, game, setCode, number, source } on hit, or null on miss.

// Looser-than-strict set code regex — anything resembling [A-Z0-9]{2,5}
// followed by an optional locale tag and a 1–4 digit number.
const SET_CODE_RE =
  /^([A-Za-z0-9]{2,6})[\s\-_/]+(?:(?:EN|JP|DE|FR|IT|PT|SP|KR|CH|SS|GR)[\s\-_/]*)?(\d{1,4})[A-Za-z]*$/;

export function looksLikeSetCode(input) {
  if (!input) return false;
  return SET_CODE_RE.test(input.trim());
}

export function parseSetCode(input) {
  if (!input) return null;
  const m = String(input).trim().match(SET_CODE_RE);
  if (!m) return null;
  return { setCode: m[1].toLowerCase(), number: m[2] };
}

// ─── Per-game lookups ────────────────────────────────────────────────────────

async function lookupPokemon({ setCode, number }) {
  // pokemontcg.io supports both set.id and number filters
  const num = number.replace(/^0+/, '') || '0';
  const q = `set.id:${setCode} number:${num}`;
  const res = await fetch(
    `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=1`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const card = data.data?.[0];
  if (!card) return null;
  return {
    name: card.name,
    game: 'pokemon',
    setCode: card.set?.id,
    setName: card.set?.name,
    number: card.number,
    source: 'pokemontcg.io',
  };
}

async function lookupMtg({ setCode, number }) {
  // Scryfall has a direct endpoint for set+collector_number
  const num = number.replace(/^0+/, '') || '0';
  const res = await fetch(
    `https://api.scryfall.com/cards/${encodeURIComponent(setCode)}/${encodeURIComponent(num)}`
  );
  if (res.status === 404 || !res.ok) return null;
  const card = await res.json();
  if (card.object === 'error') return null;
  return {
    name: card.name,
    game: 'mtg',
    setCode: card.set,
    setName: card.set_name,
    number: card.collector_number,
    source: 'scryfall',
  };
}

async function lookupYgo({ setCode, number }) {
  // YGOPRODeck doesn't have a direct (set, number) endpoint. Fetch the whole
  // set, then match the print whose set_code starts with the input set code
  // and ends with the right number.
  const res = await fetch(
    `https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(setCode.toUpperCase())}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (data.error) return null;
  const cards = Array.isArray(data.data) ? data.data : [];

  // Each card has card_sets[]: { set_name, set_code: "LOB-EN001", set_rarity, set_price }
  const padded = number.padStart(3, '0');
  for (const c of cards) {
    const prints = Array.isArray(c.card_sets) ? c.card_sets : [];
    for (const p of prints) {
      const code = String(p.set_code || '').toUpperCase();
      if (!code.startsWith(setCode.toUpperCase())) continue;
      // Match either the unpadded or 3-zero-padded collector number at the end
      if (code.endsWith(padded) || code.endsWith(`-${padded}`) ||
          code.endsWith(number) || code.endsWith(`-${number}`)) {
        return {
          name: c.name,
          game: 'yugioh',
          setCode: code,
          setName: p.set_name,
          number: padded,
          source: 'ygoprodeck',
        };
      }
    }
  }
  return null;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function lookupBySetCode(input) {
  const parsed = parseSetCode(input);
  if (!parsed) return null;

  // Race all three games in parallel — whichever returns a hit wins.
  const results = await Promise.allSettled([
    lookupPokemon(parsed).catch(() => null),
    lookupMtg(parsed).catch(() => null),
    lookupYgo(parsed).catch(() => null),
  ]);

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) return r.value;
  }
  return null;
}
