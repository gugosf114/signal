// Pull chase cards from the latest set in each game so the quick-picks
// strip keeps up with new expansions without a code change.
//
// Sources: pokemontcg.io (Pokemon), Scryfall (MTG), YGOPRODeck (Yu-Gi-Oh).
// Cached in localStorage for 24h to avoid re-fetching on every launch.

const CACHE_KEY = 'signal_latest_chase_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const POKEMON_CHASE_RARITIES = new Set([
  'Special Illustration Rare',
  'Hyper Rare',
  'Illustration Rare',
  'Ultra Rare',
]);

async function fetchPokemonChase() {
  try {
    // Newest set
    const setRes = await fetch('https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=1');
    if (!setRes.ok) return [];
    const setData = await setRes.json();
    const set = setData.data?.[0];
    if (!set) return [];

    // Cards in newest set
    const cardRes = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=set.id:${encodeURIComponent(set.id)}&pageSize=60&orderBy=-number`
    );
    if (!cardRes.ok) return [];
    const cardData = await cardRes.json();
    const cards = cardData.data || [];

    const releaseYear = (set.releaseDate || '').slice(2, 4); // "YY"
    const chase = cards
      .filter(c => POKEMON_CHASE_RARITIES.has(c.rarity || ''))
      .slice(0, 2)
      .map(c => ({
        name: c.name,
        game: 'pokemon',
        year: releaseYear ? `'${releaseYear}` : undefined,
        classic: false,
        _setName: set.name,
      }));
    return chase;
  } catch {
    return [];
  }
}

async function fetchMtgChase() {
  try {
    const setRes = await fetch('https://api.scryfall.com/sets');
    if (!setRes.ok) return [];
    const setData = await setRes.json();
    // Filter to "expansion" sets only, sort by released_at desc
    const sets = (setData.data || [])
      .filter(s => s.set_type === 'expansion' && s.released_at)
      .sort((a, b) => b.released_at.localeCompare(a.released_at));
    const set = sets[0];
    if (!set) return [];

    const cardRes = await fetch(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`s:${set.code} r:mythic game:paper`)}&order=released&dir=desc&unique=cards`
    );
    if (!cardRes.ok) return [];
    const cardData = await cardRes.json();
    const cards = cardData.data || [];

    const releaseYear = (set.released_at || '').slice(2, 4);
    return cards.slice(0, 2).map(c => ({
      name: c.name,
      game: 'mtg',
      year: releaseYear ? `'${releaseYear}` : undefined,
      classic: false,
      _setName: set.name,
    }));
  } catch {
    return [];
  }
}

async function fetchYugiohChase() {
  try {
    // Recently-added cards proxy for "newest in a set"
    const res = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php?sort=new&num=20&offset=0');
    if (!res.ok) return [];
    const data = await res.json();
    const cards = data.data || [];

    // Prefer monsters or effect monsters with high ATK — proxy for chase candidates.
    const ranked = cards
      .filter(c => c.type && (c.type.includes('Monster') || c.type.includes('Spell')))
      .slice(0, 2);

    const thisYear = new Date().getFullYear();
    const yr = `'${String(thisYear).slice(2)}`;
    return ranked.map(c => ({
      name: c.name,
      game: 'yugioh',
      year: yr,
      classic: false,
    }));
  } catch {
    return [];
  }
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    if (!Array.isArray(data)) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // localStorage full / disabled — silently skip cache
  }
}

export async function getLatestChaseCards() {
  const cached = readCache();
  if (cached) return cached;

  const results = await Promise.all([
    fetchPokemonChase(),
    fetchMtgChase(),
    fetchYugiohChase(),
  ]);
  const flat = results.flat();
  writeCache(flat);
  return flat;
}
