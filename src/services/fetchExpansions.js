// Latest 6 expansions per game, pulled from each game's catalog API.
// Cached for 7 days in localStorage — set lists change rarely.
//
//   Pokemon: pokemontcg.io  (/v2/sets?orderBy=-releaseDate)
//   Magic:   scryfall       (/sets, filtered to expansion sets)
//   YGO:     YGOPRODeck     (/v7/cardsets.php, sorted by tcg_date)

import { looksLikeSetCode, lookupBySetCode } from './lookupBySetCode.js';

const CACHE_KEY = 'signal_expansions_v2';
const CACHE_TTL_MS = 60 * 60 * 1000;
const COUNT = 12;
const PAGE = 21;

function pokemonRow(c, fallbackSetName = '') {
  const variants = c.tcgplayer?.prices || {};
  const market = (value) => Number.isFinite(value?.market) ? value.market : null;
  const normalPrice = market(variants.normal)
    ?? market(variants.holofoil)
    ?? market(variants['1stEditionHolofoil'])
    ?? market(variants.unlimitedHolofoil);
  const reversePrice = market(variants.reverseHolofoil);
  return {
    id: c.id,
    printingId: c.id,
    name: c.name,
    game: 'pokemon',
    setName: c.set?.name || fallbackSetName,
    setId: c.set?.id || null,
    number: c.number || null,
    printedTotal: c.set?.printedTotal || c.set?.total || null,
    rarity: c.rarity || null,
    price: normalPrice ?? reversePrice,
    marketPrices: { normal: normalPrice, reverse: reversePrice },
    imageUrl: c.images?.small || null,
    imageLarge: c.images?.large || c.images?.small || null,
  };
}

function mtgRow(c, fallbackSetName = '') {
  const normalPrice = c.prices?.usd ? Number(c.prices.usd) : null;
  const reversePrice = c.prices?.usd_foil ? Number(c.prices.usd_foil) : null;
  return {
    id: c.id,
    printingId: c.id,
    name: c.name,
    game: 'mtg',
    setName: c.set_name || fallbackSetName,
    setId: c.set || null,
    number: c.collector_number || null,
    rarity: c.rarity || null,
    price: normalPrice ?? reversePrice,
    marketPrices: { normal: normalPrice, reverse: reversePrice },
    imageUrl: c.image_uris?.small || c.card_faces?.[0]?.image_uris?.small || null,
    imageLarge: mtgLargeArt(c),
  };
}

function normalizeYgoCode(value) {
  return String(value || '').trim().toUpperCase();
}

function differsOnlyByIl(left, right) {
  const scanned = normalizeYgoCode(left);
  const catalogued = normalizeYgoCode(right);
  if (!looksLikeSetCode(scanned) || !looksLikeSetCode(catalogued)
    || scanned.length !== catalogued.length) return false;
  let mismatches = 0;
  for (let index = 0; index < scanned.length; index++) {
    if (scanned[index] === catalogued[index]) continue;
    mismatches += 1;
    const pair = `${scanned[index]}${catalogued[index]}`;
    if (mismatches > 1 || (pair !== 'IL' && pair !== 'LI')) return false;
  }
  return mismatches === 1;
}

export function ygoPrintingRows(card, wantedSet = null) {
  const prints = Array.isArray(card?.card_sets) ? card.card_sets : [];
  const wantedCode = normalizeYgoCode(wantedSet?.code || wantedSet?.id);
  const wantedName = String(wantedSet?.name || '').trim().toLowerCase();
  const selected = wantedSet
    ? prints.filter((entry) => {
        const code = normalizeYgoCode(entry?.set_code);
        const name = String(entry?.set_name || '').trim().toLowerCase();
        return (wantedCode && (code === wantedCode || code.startsWith(`${wantedCode}-`)))
          || (wantedName && name === wantedName);
      })
    : prints;
  const rows = selected.length ? selected : (wantedSet ? [] : [null]);
  return rows.map((entry) => {
    const exactPrice = Number(entry?.set_price);
    const broadPrice = Number(card?.card_prices?.[0]?.tcgplayer_price);
    const exactPrinting = Boolean(entry?.set_code);
    const price = Number.isFinite(exactPrice) && exactPrice > 0
      ? exactPrice
      : (!exactPrinting && Number.isFinite(broadPrice) && broadPrice > 0 ? broadPrice : null);
    return {
    id: card?.id != null ? String(card.id) : null,
    printingId: entry?.set_code && card?.id != null ? `${card.id}:${entry.set_code}` : (card?.id != null ? String(card.id) : null),
    name: card?.name || '',
    game: 'yugioh',
    setName: entry?.set_name || card?.type || '',
    setId: entry?.set_code || null,
    number: entry?.set_code || null,
    rarity: entry?.set_rarity || null,
    price,
    marketPrices: { normal: price, reverse: null },
    priceScope: Number.isFinite(exactPrice) && exactPrice > 0
      ? 'set-code printing'
      : (exactPrinting ? 'exact-print price unavailable' : 'card-level across all printings'),
    imageUrl: card?.card_images?.[0]?.image_url_small || null,
    imageLarge: card?.card_images?.[0]?.image_url || card?.card_images?.[0]?.image_url_small || null,
    };
  });
}

// "Captain 123" means: search the name Captain, then keep cards whose printed
// number ends in 123. This mirrors how a person reads a card in their hand — a
// memorable first word plus the few digits they can see at the bottom.
export function parseCardLookupQuery(query) {
  const raw = String(query || '').trim().replace(/\s+/g, ' ');
  if (!raw) return { name: '', numberSuffix: null };
  if (/^\d{1,4}[A-Za-z]?$/i.test(raw)) return { name: '', numberSuffix: raw.toLowerCase() };
  const combined = raw.match(/^(.+?[A-Za-z][^#]*?)\s+#?(\d{1,4}[A-Za-z]?)$/i);
  if (!combined) return { name: raw, numberSuffix: null };
  return { name: combined[1].trim(), numberSuffix: combined[2].toLowerCase() };
}

export function cardNumberEndsWith(value, suffix) {
  if (!suffix) return true;
  const wanted = String(suffix).trim().toLowerCase();
  const printed = String(value || '').trim().toLowerCase();
  const tail = printed.match(/(\d{1,4}[a-z]?)$/i)?.[1];
  if (!tail) return false;
  if (tail === wanted || tail.endsWith(wanted)) return true;
  if (/^0/.test(wanted)) {
    return /^\d+$/.test(printed) && Number(tail) === Number(wanted);
  }
  return (tail.replace(/^0+/, '') || '0') === (wanted.replace(/^0+/, '') || '0');
}

// pokemontcg.io returns 500/502 intermittently — often enough that a single
// unretried failure was the reason the Pokémon browse grid would come up empty
// and stay empty until you switched games. Scryfall and YGOPRODeck are steadier
// but get the same treatment for free. Throws after the last attempt so callers
// can tell "nothing found" from "couldn't reach it".
async function getJSON(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(6000),
        // Scryfall 400s on a default library User-Agent. Browsers forbid
        // setting this header and drop it silently, so it costs nothing on
        // device and makes these functions testable from Node.
        headers: { 'User-Agent': 'SignalTCG/1.0 (card market intelligence)' },
      });
      if (res.status === 404 || res.status === 400) return null;   // genuine no-match
      if (!res.ok) throw new Error(`${res.status}`);
      return await res.json();
    } catch (e) {
      last = e;
      // Short, linear backoff: pokemontcg.io fails fast and recovers fast, and
      // this sits under a typeahead, so the whole retry chain has to fit inside
      // roughly three seconds to be worth doing at all.
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 200 * (i + 1)));
    }
  }
  throw last;
}

async function fetchPokemonSets() {
  try {
    const data = await getJSON('https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=12');
    if (!data) return [];
    const today = new Date().toISOString().slice(0, 10);
    return (data.data || [])
      .filter((set) => !set.releaseDate || set.releaseDate <= today)
      .slice(0, COUNT)
      .map((s) => ({
        id: s.id,
        name: s.name,
        code: s.ptcgoCode || s.id,
        releaseDate: s.releaseDate || '',
        game: 'pokemon',
      }));
  } catch { return []; }
}

async function fetchMtgSets() {
  try {
    const data = await getJSON('https://api.scryfall.com/sets');
    if (!data) return [];
    const today = new Date().toISOString().slice(0, 10);
    const sets = (data.data || [])
      .filter((s) => s.set_type === 'expansion' && s.released_at && s.released_at <= today)
      .sort((a, b) => b.released_at.localeCompare(a.released_at));
    return sets.slice(0, COUNT).map((s) => ({
      id: s.code,
      name: s.name,
      code: s.code,
      releaseDate: s.released_at || '',
      game: 'mtg',
    }));
  } catch { return []; }
}

export function selectRecentYugiohSets(data, today, limit = COUNT) {
  return (Array.isArray(data) ? data : [])
    .filter((set) => set.tcg_date && set.tcg_date <= today && set.set_name && (set.num_of_cards || 0) > 0)
    .sort((a, b) => b.tcg_date.localeCompare(a.tcg_date))
    .slice(0, limit)
    .map((set) => ({
      id: set.set_code || set.set_name,
      name: set.set_name,
      code: set.set_code || '',
      releaseDate: set.tcg_date || '',
      game: 'yugioh',
    }));
}

async function fetchYugiohSets() {
  try {
    const data = await getJSON('https://db.ygoprodeck.com/api/v7/cardsets.php');
    if (!data) return [];
    // The API returns an array of {set_name, set_code, num_of_cards, tcg_date}.
    // Filter to entries with a real TCG release date and sort desc.
    const today = new Date().toISOString().slice(0, 10);
    return selectRecentYugiohSets(data, today);
  } catch { return []; }
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    const age = Date.now() - ts;
    if (age < 0 || age > CACHE_TTL_MS) return null;
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch { return null; }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

export async function getExpansions({ force = false } = {}) {
  const cached = force ? null : readCache();
  if (cached) return cached;
  const [pokemon, mtg, yugioh] = await Promise.all([
    fetchPokemonSets(),
    fetchMtgSets(),
    fetchYugiohSets(),
  ]);
  const all = { pokemon, mtg, yugioh };
  if (pokemon.length && mtg.length && yugioh.length) writeCache(all);
  return all;
}

// Latest-cards fallback per game — used when the expansions list hasn't
// returned yet (or returned empty) so the grid never sits at "No cards found"
// while the user waits on a slow set-list fetch. Mirrors the original
// default-query behavior the browser had before the expansion picker landed.
// priceSort: 'asc' | 'desc' | null. When set, the API queries (or client-side
// sort for YGO) reorder the grid by current market price.
function pokemonOrderBy(priceSort) {
  return '-set.releaseDate';
}

function pokemonMarketPrice(card) {
  const prices = Object.values(card?.tcgplayer?.prices || {})
    .map((value) => Number(value?.market))
    .filter((value) => Number.isFinite(value) && value > 0);
  return prices.length ? Math.max(...prices) : null;
}

function sortPokemonByPrice(cards, priceSort) {
  if (!priceSort) return cards;
  return [...cards].sort((a, b) => {
    const ap = pokemonMarketPrice(a);
    const bp = pokemonMarketPrice(b);
    if (ap == null) return 1;
    if (bp == null) return -1;
    return priceSort === 'asc' ? ap - bp : bp - ap;
  });
}
function mtgOrder(priceSort) {
  if (priceSort) return `order=usd&dir=${priceSort === 'asc' ? 'asc' : 'desc'}`;
  return 'order=released&dir=desc';
}
// Scryfall's best available still: png is the sharpest, then large. Falls back
// through the faces array for double-sided cards.
function mtgLargeArt(c) {
  const u = c.image_uris || c.card_faces?.[0]?.image_uris || {};
  return u.png || u.large || u.normal || u.small || null;
}

function sortYugiohByPrice(cards, priceSort) {
  if (!priceSort) return cards;
  const priceOf = (c) => {
    const raw = c.card_prices?.[0]?.tcgplayer_price;
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : (priceSort === 'asc' ? Infinity : -Infinity);
  };
  return [...cards].sort((a, b) => priceSort === 'asc' ? priceOf(a) - priceOf(b) : priceOf(b) - priceOf(a));
}

export async function fetchLatestCardsForGame(game, priceSort = null) {
  try {
    if (game === 'pokemon') {
      const today = new Date().toISOString().slice(0, 10);
      const data = await getJSON(
        'https://api.pokemontcg.io/v2/cards?q=' + encodeURIComponent(`set.releaseDate:[* TO ${today}]`) +
        `&pageSize=${priceSort ? 100 : PAGE}&orderBy=${encodeURIComponent(pokemonOrderBy(priceSort))}`
      );
      if (!data) return [];
      return sortPokemonByPrice(data.data || [], priceSort).slice(0, PAGE).map((c) => pokemonRow(c));
    }
    if (game === 'mtg') {
      const data = await getJSON(
        'https://api.scryfall.com/cards/search?q=' + encodeURIComponent(`game:paper date<=${new Date().toISOString().slice(0, 10)}`) +
        `&${mtgOrder(priceSort)}&unique=cards`
      );
      if (!data) return [];
      return (data.data || []).slice(0, PAGE).map((c) => mtgRow(c));
    }
    if (game === 'yugioh') {
      const sets = await fetchYugiohSets();
      return sets[0] ? fetchCardsBySet('yugioh', sets[0], priceSort) : [];
    }
  } catch (err) {
    // Surfaced so the grid can say "couldn't load" with a retry, instead of
    // rendering an empty shelf that looks like the game simply has no cards.
    throw err;
  }
  return [];
}

// Card-by-expansion fetch for the grid. Returns the array shape CardBrowser
// already expects: { id, name, game, setName, imageUrl }. Optional priceSort
// reorders the grid by current market price.
export async function fetchCardsBySet(game, set, priceSort = null) {
  if (!set?.id) return [];
  try {
    if (game === 'pokemon') {
      const orderBy = '-number';
      const data = await getJSON(
        `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent('set.id:' + set.id)}&pageSize=${priceSort ? 100 : PAGE}&orderBy=${encodeURIComponent(orderBy)}`
      );
      if (!data) return [];
      return sortPokemonByPrice(data.data || [], priceSort).slice(0, PAGE).map((c) => pokemonRow(c, set.name));
    }
    if (game === 'mtg') {
      const orderStr = priceSort
        ? `order=usd&dir=${priceSort === 'asc' ? 'asc' : 'desc'}`
        : 'order=released&dir=desc';
      const data = await getJSON(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent('s:' + set.code + ' game:paper')}&${orderStr}&unique=cards`
      );
      if (!data) return [];
      return (data.data || []).slice(0, PAGE).map((c) => mtgRow(c, set.name));
    }
    if (game === 'yugioh') {
      const fetchSize = priceSort ? 60 : 21;
      const data = await getJSON(
        `https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(set.name)}&num=${fetchSize}&offset=0`
      );
      if (!data) return [];
      const cards = data.data || [];
      return sortYugiohByPrice(cards, priceSort)
        .flatMap((card) => ygoPrintingRows(card, set))
        .slice(0, PAGE);
    }
  } catch (err) {
    throw err;
  }
  return [];
}

// ─── Name search ─────────────────────────────────────────────────────────────
// Searches the same free catalogues the browse grid already reads — this looks
// a card up in the library, it does NOT run a scan. Tapping a result is what
// starts a scan, exactly as tapping a browsed card does.
export async function searchCardsByName(game, query, priceSort = null) {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  if (looksLikeSetCode(q)) {
    const hit = await lookupBySetCode(q);
    if (!hit || hit.game !== game) return [];
    return [{
      ...hit,
      setId: hit.setId || hit.setCode || null,
    }];
  }
  const { name: nameQuery, numberSuffix } = parseCardLookupQuery(q);
  const pageSize = numberSuffix ? 100 : (priceSort ? 100 : PAGE);
  const keepNumber = (cards) => numberSuffix
    ? cards.filter((card) => cardNumberEndsWith(card.number, numberSuffix))
    : cards;

  if (game === 'pokemon') {
    // pokemontcg.io wants wildcards spelled out; quote it so multi-word names work.
    // Alphabetical, not newest-first, when the user isn't sorting by price:
    // "Charizard" has far more than one page of printings, and release order
    // filled that page entirely with "Charizard ex" — the plain card the user
    // actually typed never appeared. A-Z puts exact names at the top.
      const order = priceSort ? '-set.releaseDate' : 'name';
      const pokemonQuery = nameQuery
        ? `name:"*${nameQuery}*"`
        : `number:${numberSuffix.replace(/^0+/, '') || '0'}`;
      const data = await getJSON(
        `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(pokemonQuery)}` +
      `&pageSize=${pageSize}&orderBy=${encodeURIComponent(order)}`
      );
      if (!data) return [];
    const rows = sortPokemonByPrice(data.data || [], priceSort).map((c) => pokemonRow(c));
    return keepNumber(rows).slice(0, PAGE);
  }

  if (game === 'mtg') {
    // Scryfall answers a no-match with 404, which getJSON maps to null.
    const mtgQuery = nameQuery ? `${nameQuery} game:paper` : `cn:${numberSuffix} game:paper`;
    const data = await getJSON(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent(mtgQuery)}` +
      `&${mtgOrder(priceSort)}&unique=prints`
    );
    if (!data) return [];
    return keepNumber((data.data || []).map((c) => mtgRow(c))).slice(0, PAGE);
  }

  if (game === 'yugioh') {
    // fname is YGOPRODeck's fuzzy match; it 400s on no-match. It also matches
    // card TEXT, so searching "reinforcement" returns Charge Into a Dark World
    // ahead of Reinforcement of the Army in the API's alphabetical order. Pull
    // name matches to the front, earliest position first, before any price sort.
    if (!nameQuery) return [];
    const fetchSize = numberSuffix ? 100 : (priceSort ? 60 : PAGE * 3);
    const data = await getJSON(
      `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(nameQuery)}&num=${fetchSize}&offset=0`
    );
    if (!data || data.error) return [];
    const needle = nameQuery.toLowerCase();
    const rank = (c) => {
      const i = (c.name || '').toLowerCase().indexOf(needle);
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };
    const cards = priceSort
      ? sortYugiohByPrice(data.data || [], priceSort)
      : [...(data.data || [])].sort((a, b) => rank(a) - rank(b));
    return keepNumber(cards.flatMap((card) => ygoPrintingRows(card))).slice(0, PAGE);
  }

  return [];
}


// ─── Suggestions across all three games ──────────────────────────────────────
// The dashboard search bar has no game picker, so a typed name could belong to
// any of the three catalogues. Ask all three at once and merge. Each entry
// carries its set and printing, which is the point: "Charizard" matches
// hundreds of cards, and without showing the set the app just silently scans
// whichever one the API happened to return first.
export async function suggestCards(query, limit = 8) {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  if (looksLikeSetCode(q)) {
    const hit = await lookupBySetCode(q);
    return hit ? [{ ...hit, setId: hit.setId || hit.setCode || null }] : [];
  }
  const parsed = parseCardLookupQuery(q);

  const games = ['pokemon', 'mtg', 'yugioh'];
  const settled = await Promise.allSettled(
    games.map((g) => searchCardsByName(g, q, null))
  );

  const needle = parsed.name.toLowerCase();
  const rank = (c) => {
    const n = (c.name || '').toLowerCase();
    if (n === needle) return 0;              // exact name
    if (n.startsWith(needle)) return 1;      // starts with it
    if (n.includes(needle)) return 2;        // contains it
    return 3;                                // matched on card text
  };

  // "Nobody answered" is not the same fact as "this card doesn't exist", and
  // the caller renders them very differently — an empty list versus keeping
  // what it already had. Only the first is worth showing.
  if (settled.every((r) => r.status === 'rejected')) {
    throw settled[0].reason || new Error('all catalogues unreachable');
  }

  // Interleave the three lists so one game with many hits can't crowd out the
  // others — someone typing "dragon" should see all three games represented.
  const lists = settled.map((r) => (r.status === 'fulfilled' ? r.value : []));
  const merged = [];
  for (let i = 0; merged.length < limit * 3 && i < PAGE; i++) {
    for (const list of lists) if (list[i]) merged.push(list[i]);
  }

  return merged
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, limit);
}

// ─── Camera → exact printing ─────────────────────────────────────────────────
// The photo scanner already reads the set and collector number off the card,
// then handed back only the name — so photographing the $1,499 Umbreon ex and
// the $7 one produced identical scans. This turns what the camera read into a
// catalogue row, which becomes the pin.
//
// Returns null when nothing matches confidently; the caller falls back to a
// plain name search, which is what it did before.
export async function resolvePrinting({ name, game, number, set } = {}) {
  const n = (name || '').trim();
  if (n.length < 2) return null;

  // A full printed set code is already the strongest possible lookup. Use the
  // direct live endpoint before a name search can trim a 47-printing card down
  // to its first page and hide the new release.
  if (number && looksLikeSetCode(String(number))) {
    const direct = await lookupBySetCode(String(number)).catch(() => null);
    if (direct && (!game || direct.game === game)
      && String(direct.name || '').trim().toLowerCase() === n.toLowerCase()) return direct;
    // Foil glare can make a printed L look like I. Recover only that one glyph,
    // only for Yu-Gi-Oh, and only when the exact card name leaves one catalogue
    // code. Any wider or ambiguous mismatch must still stop instead of guessing.
    if (!direct && (!game || game === 'yugioh')) {
      const data = await getJSON(
        `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(n)}`
      ).catch(() => null);
      const exactCards = (data?.data || [])
        .filter((card) => String(card?.name || '').trim().toLowerCase() === n.toLowerCase());
      const candidates = exactCards
        .flatMap((card) => ygoPrintingRows(card))
        .filter((card) => differsOnlyByIl(number, card.number));
      const correctedCodes = [...new Set(candidates.map((card) => normalizeYgoCode(card.number)))];
      if (correctedCodes.length === 1) {
        const corrected = await lookupBySetCode(correctedCodes[0]).catch(() => null);
        if (corrected && corrected.game === 'yugioh'
          && String(corrected.name || '').trim().toLowerCase() === n.toLowerCase()) return corrected;
      }
    }
  }

  // "199/198" is printed on the card; catalogues store "199".
  const num = number ? String(number).split('/')[0].trim().toLowerCase() : null;
  const rawSetText = (set || '').trim().toLowerCase();
  const setText = /unknown|unable|unreadable|not (?:clear|visible)/i.test(rawSetText) ? '' : rawSetText;

  const games = game ? [game] : ['pokemon', 'mtg', 'yugioh'];
  const settled = await Promise.allSettled(
    games.map((g) => searchCardsByName(g, n, null))
  );
  const hits = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  if (!hits.length) return null;

  const exactName = hits.filter((c) => (c.name || '').toLowerCase() === n.toLowerCase());
  const pool = exactName.length ? exactName : hits;

  // If the photo cannot expose a tiny code but the live catalogue has exactly
  // one card with that exact name, there is no ambiguity to ask the user about.
  if (!num && (!setText || /unknown|unable|unreadable/i.test(setText))) {
    const unique = [...new Map(pool.map((card) => [card.printingId || card.id || card.number, card])).values()];
    return unique.length === 1 ? unique[0] : null;
  }

  const numberMatches = (card) => {
    const stored = String(card.number || '').trim().toLowerCase();
    if (!num) return true;
    if (stored === num) return true;
    const trailing = stored.match(/(\d+[a-z]?)$/i)?.[1]?.replace(/^0+/, '') || '';
    return trailing === num.replace(/^0+/, '');
  };
  const setMatches = (card) => {
    if (!setText) return true;
    const name = String(card.setName || '').trim().toLowerCase();
    const code = String(card.setId || '').trim().toLowerCase();
    return name === setText || code === setText
      || (name && (name.includes(setText) || setText.includes(name)));
  };
  const exact = pool.find((card) => numberMatches(card) && setMatches(card));
  if (exact) return exact;
  return null;
}
