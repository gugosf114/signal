// Latest 6 expansions per game, pulled from each game's catalog API.
// Cached for 7 days in localStorage — set lists change rarely.
//
//   Pokemon: pokemontcg.io  (/v2/sets?orderBy=-releaseDate)
//   Magic:   scryfall       (/sets, filtered to expansion sets)
//   YGO:     YGOPRODeck     (/v7/cardsets.php, sorted by tcg_date)

const CACHE_KEY = 'signal_expansions_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COUNT = 6;

async function fetchPokemonSets() {
  try {
    const r = await fetch('https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=12');
    if (!r.ok) return [];
    const data = await r.json();
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
    const r = await fetch('https://api.scryfall.com/sets');
    if (!r.ok) return [];
    const data = await r.json();
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
    const r = await fetch('https://db.ygoprodeck.com/api/v7/cardsets.php');
    if (!r.ok) return [];
    const data = await r.json();
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
      const r = await fetch(
        'https://api.pokemontcg.io/v2/cards?q=' + encodeURIComponent('-set.releaseDate:[* TO 2010-01-01]') +
        `&pageSize=21&orderBy=${encodeURIComponent(pokemonOrderBy(priceSort))}`
      );
      if (!r.ok) return [];
      const data = await r.json();
      return (data.data || []).map((c) => ({
        id: c.id, name: c.name, game: 'pokemon',
        setName: c.set?.name || '', imageUrl: c.images?.small || null,
      }));
    }
    if (game === 'mtg') {
      const r = await fetch(
        'https://api.scryfall.com/cards/search?q=' + encodeURIComponent('game:paper r:mythic') +
        `&${mtgOrder(priceSort)}&unique=cards`
      );
      if (!r.ok) return [];
      const data = await r.json();
      return (data.data || []).slice(0, 21).map((c) => ({
        id: c.id, name: c.name, game: 'mtg',
        setName: c.set_name || '',
        imageUrl: c.image_uris?.small || c.card_faces?.[0]?.image_uris?.small || null,
      }));
    }
    if (game === 'yugioh') {
      // YGOPRODeck has no native price sort; pull a wider sample + sort
      // client-side by tcgplayer_price.
      const fetchSize = priceSort ? 60 : 21;
      const r = await fetch(
        `https://db.ygoprodeck.com/api/v7/cardinfo.php?sort=new&num=${fetchSize}&offset=0`
      );
      if (!r.ok) return [];
      const data = await r.json();
      const cards = data.data || [];
      return sortYugiohByPrice(cards, priceSort).slice(0, 21).map((c) => ({
        id: String(c.id), name: c.name, game: 'yugioh',
        setName: c.type || '',
        imageUrl: c.card_images?.[0]?.image_url_small || null,
      }));
    }
  } catch {}
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
      const r = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent('set.id:' + set.id)}&pageSize=21&orderBy=${encodeURIComponent(orderBy)}`
      );
      if (!r.ok) return [];
      const data = await r.json();
      return (data.data || []).map((c) => ({
        id: c.id, name: c.name, game: 'pokemon',
        setName: c.set?.name || set.name, imageUrl: c.images?.small || null,
      }));
    }
    if (game === 'mtg') {
      const orderStr = priceSort
        ? `order=usd&dir=${priceSort === 'asc' ? 'asc' : 'desc'}`
        : 'order=released&dir=desc';
      const r = await fetch(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent('s:' + set.code + ' game:paper')}&${orderStr}&unique=cards`
      );
      if (!r.ok) return [];
      const data = await r.json();
      return (data.data || []).slice(0, 21).map((c) => ({
        id: c.id, name: c.name, game: 'mtg',
        setName: c.set_name || set.name,
        imageUrl: c.image_uris?.small || c.card_faces?.[0]?.image_uris?.small || null,
      }));
    }
    if (game === 'yugioh') {
      const fetchSize = priceSort ? 60 : 21;
      const r = await fetch(
        `https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(set.name)}&num=${fetchSize}&offset=0`
      );
      if (!r.ok) return [];
      const data = await r.json();
      const cards = data.data || [];
      return sortYugiohByPrice(cards, priceSort).slice(0, 21).map((c) => ({
        id: String(c.id), name: c.name, game: 'yugioh',
        setName: set.name,
        imageUrl: c.card_images?.[0]?.image_url_small || null,
      }));
    }
  } catch {}
  return [];
}
