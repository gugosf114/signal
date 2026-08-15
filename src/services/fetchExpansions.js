// Latest 6 expansions per game, pulled from each game's catalog API.
// Cached for 7 days in localStorage — set lists change rarely.
//
//   Pokemon: pokemontcg.io  (/v2/sets?orderBy=-releaseDate)
//   Magic:   scryfall       (/sets, filtered to expansion sets)
//   YGO:     YGOPRODeck     (/v7/cardsets.php, sorted by tcg_date)

const CACHE_KEY = 'signal_expansions_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COUNT = 6;
const PAGE = 21;

// pokemontcg.io returns 500/502 intermittently — often enough that a single
// unretried failure was the reason the Pokémon browse grid would come up empty
// and stay empty until you switched games. Scryfall and YGOPRODeck are steadier
// but get the same treatment for free. Throws after the last attempt so callers
// can tell "nothing found" from "couldn't reach it".
async function getJSON(url, tries = 6) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
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
    return (data.data || [])
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
    const sets = (data.data || [])
      .filter((s) => s.set_type === 'expansion' && s.released_at)
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

async function fetchYugiohSets() {
  try {
    const data = await getJSON('https://db.ygoprodeck.com/api/v7/cardsets.php');
    if (!data) return [];
    // The API returns an array of {set_name, set_code, num_of_cards, tcg_date}.
    // Filter to entries with a real TCG release date and sort desc.
    const sets = (Array.isArray(data) ? data : [])
      .filter((s) => s.tcg_date && s.set_name && (s.num_of_cards || 0) > 20)
      .sort((a, b) => b.tcg_date.localeCompare(a.tcg_date));
    return sets.slice(0, COUNT).map((s) => ({
      id: s.set_code || s.set_name,
      name: s.set_name,
      code: s.set_code || '',
      releaseDate: s.tcg_date || '',
      game: 'yugioh',
    }));
  } catch { return []; }
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch { return null; }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

export async function getExpansions() {
  const cached = readCache();
  if (cached) return cached;
  const [pokemon, mtg, yugioh] = await Promise.all([
    fetchPokemonSets(),
    fetchMtgSets(),
    fetchYugiohSets(),
  ]);
  const all = { pokemon, mtg, yugioh };
  writeCache(all);
  return all;
}

// Latest-cards fallback per game — used when the expansions list hasn't
// returned yet (or returned empty) so the grid never sits at "No cards found"
// while the user waits on a slow set-list fetch. Mirrors the original
// default-query behavior the browser had before the expansion picker landed.
// priceSort: 'asc' | 'desc' | null. When set, the API queries (or client-side
// sort for YGO) reorder the grid by current market price.
function pokemonOrderBy(priceSort) {
  if (priceSort === 'asc')  return 'cardmarket.prices.averageSellPrice';
  if (priceSort === 'desc') return '-cardmarket.prices.averageSellPrice';
  return '-set.releaseDate';
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
      const data = await getJSON(
        'https://api.pokemontcg.io/v2/cards?q=' + encodeURIComponent('-set.releaseDate:[* TO 2010-01-01]') +
        `&pageSize=${PAGE}&orderBy=${encodeURIComponent(pokemonOrderBy(priceSort))}`
      );
      if (!data) return [];
      return (data.data || []).map((c) => ({
        id: c.id, name: c.name, game: 'pokemon',
        setName: c.set?.name || '', imageUrl: c.images?.small || null,
        imageLarge: c.images?.large || c.images?.small || null,
      }));
    }
    if (game === 'mtg') {
      const data = await getJSON(
        'https://api.scryfall.com/cards/search?q=' + encodeURIComponent('game:paper r:mythic') +
        `&${mtgOrder(priceSort)}&unique=cards`
      );
      if (!data) return [];
      return (data.data || []).slice(0, PAGE).map((c) => ({
        id: c.id, name: c.name, game: 'mtg',
        setName: c.set_name || '',
        imageUrl: c.image_uris?.small || c.card_faces?.[0]?.image_uris?.small || null,
        imageLarge: mtgLargeArt(c),
      }));
    }
    if (game === 'yugioh') {
      // YGOPRODeck has no native price sort; pull a wider sample + sort
      // client-side by tcgplayer_price.
      const fetchSize = priceSort ? 60 : 21;
      const data = await getJSON(
        `https://db.ygoprodeck.com/api/v7/cardinfo.php?sort=new&num=${fetchSize}&offset=0`
      );
      if (!data) return [];
      const cards = data.data || [];
      return sortYugiohByPrice(cards, priceSort).slice(0, PAGE).map((c) => ({
        id: String(c.id), name: c.name, game: 'yugioh',
        setName: c.type || '',
        imageUrl: c.card_images?.[0]?.image_url_small || null,
        imageLarge: c.card_images?.[0]?.image_url || c.card_images?.[0]?.image_url_small || null,
      }));
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
      const orderBy = priceSort
        ? (priceSort === 'asc' ? 'cardmarket.prices.averageSellPrice' : '-cardmarket.prices.averageSellPrice')
        : '-number';
      const data = await getJSON(
        `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent('set.id:' + set.id)}&pageSize=${PAGE}&orderBy=${encodeURIComponent(orderBy)}`
      );
      if (!data) return [];
      return (data.data || []).map((c) => ({
        id: c.id, name: c.name, game: 'pokemon',
        setName: c.set?.name || set.name, imageUrl: c.images?.small || null,
        imageLarge: c.images?.large || c.images?.small || null,
      }));
    }
    if (game === 'mtg') {
      const orderStr = priceSort
        ? `order=usd&dir=${priceSort === 'asc' ? 'asc' : 'desc'}`
        : 'order=released&dir=desc';
      const data = await getJSON(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent('s:' + set.code + ' game:paper')}&${orderStr}&unique=cards`
      );
      if (!data) return [];
      return (data.data || []).slice(0, PAGE).map((c) => ({
        id: c.id, name: c.name, game: 'mtg',
        setName: c.set_name || set.name,
        imageUrl: c.image_uris?.small || c.card_faces?.[0]?.image_uris?.small || null,
        imageLarge: mtgLargeArt(c),
      }));
    }
    if (game === 'yugioh') {
      const fetchSize = priceSort ? 60 : 21;
      const data = await getJSON(
        `https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(set.name)}&num=${fetchSize}&offset=0`
      );
      if (!data) return [];
      const cards = data.data || [];
      return sortYugiohByPrice(cards, priceSort).slice(0, PAGE).map((c) => ({
        id: String(c.id), name: c.name, game: 'yugioh',
        setName: set.name,
        imageUrl: c.card_images?.[0]?.image_url_small || null,
        imageLarge: c.card_images?.[0]?.image_url || c.card_images?.[0]?.image_url_small || null,
      }));
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

  if (game === 'pokemon') {
    // pokemontcg.io wants wildcards spelled out; quote it so multi-word names work.
    // Alphabetical, not newest-first, when the user isn't sorting by price:
    // "Charizard" has far more than one page of printings, and release order
    // filled that page entirely with "Charizard ex" — the plain card the user
    // actually typed never appeared. A-Z puts exact names at the top.
    const order = priceSort ? pokemonOrderBy(priceSort) : 'name';
    const data = await getJSON(
      `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(`name:"*${q}*"`)}` +
      `&pageSize=${PAGE}&orderBy=${encodeURIComponent(order)}`
    );
    if (!data) return [];
    return (data.data || []).map((c) => ({
      id: c.id, name: c.name, game: 'pokemon',
      setName: c.set?.name || '', setId: c.set?.id || null, number: c.number || null,
      price: c.tcgplayer?.prices
        ? Object.values(c.tcgplayer.prices).map((v) => v.market).filter(Boolean)[0] || null
        : null,
      imageUrl: c.images?.small || null,
      imageLarge: c.images?.large || c.images?.small || null,
    }));
  }

  if (game === 'mtg') {
    // Scryfall answers a no-match with 404, which getJSON maps to null.
    const data = await getJSON(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q + ' game:paper')}` +
      `&${mtgOrder(priceSort)}&unique=cards`
    );
    if (!data) return [];
    return (data.data || []).slice(0, PAGE).map((c) => ({
      id: c.id, name: c.name, game: 'mtg',
      setName: c.set_name || '', setId: c.set || null, number: c.collector_number || null,
      price: c.prices?.usd ? Number(c.prices.usd) : null,
      imageUrl: c.image_uris?.small || c.card_faces?.[0]?.image_uris?.small || null,
      imageLarge: mtgLargeArt(c),
    }));
  }

  if (game === 'yugioh') {
    // fname is YGOPRODeck's fuzzy match; it 400s on no-match. It also matches
    // card TEXT, so searching "reinforcement" returns Charge Into a Dark World
    // ahead of Reinforcement of the Army in the API's alphabetical order. Pull
    // name matches to the front, earliest position first, before any price sort.
    const fetchSize = priceSort ? 60 : PAGE * 3;
    const data = await getJSON(
      `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(q)}&num=${fetchSize}&offset=0`
    );
    if (!data || data.error) return [];
    const needle = q.toLowerCase();
    const rank = (c) => {
      const i = (c.name || '').toLowerCase().indexOf(needle);
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };
    const cards = priceSort
      ? sortYugiohByPrice(data.data || [], priceSort)
      : [...(data.data || [])].sort((a, b) => rank(a) - rank(b));
    return cards.slice(0, PAGE).map((c) => ({
      id: String(c.id), name: c.name, game: 'yugioh',
      setName: c.card_sets?.[0]?.set_name || c.type || '', setId: null, number: null,
      price: Number(c.card_prices?.[0]?.tcgplayer_price) || null,
      imageUrl: c.card_images?.[0]?.image_url_small || null,
      imageLarge: c.card_images?.[0]?.image_url || c.card_images?.[0]?.image_url_small || null,
    }));
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

  const games = ['pokemon', 'mtg', 'yugioh'];
  const settled = await Promise.allSettled(
    games.map((g) => searchCardsByName(g, q, null))
  );

  const needle = q.toLowerCase();
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
