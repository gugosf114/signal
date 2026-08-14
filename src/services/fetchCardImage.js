// ─── Card Image Fetcher ──────────────────────────────────────────────────────
// Uses free TCG APIs to fetch card artwork. No API keys required.
//
// Scryfall (MTG)        — https://api.scryfall.com
// YGOPRODeck (Yu-Gi-Oh) — https://db.ygoprodeck.com
// Pokémon TCG API       — https://api.pokemontcg.io
//
// 404 from any API = legitimate "card not found" — silent, returns null.
// Other failures (4xx, 5xx, network, parse) = operational issue — logged.

// ─── Image URL cache ─────────────────────────────────────────────────────────
// The same card's art is requested by up to four components at once —
// LoadingTheater's CardSlate, OverallScore's CardImage, EmptyState's tile and
// the NewsStrip fallback — each firing its own round trip for an identical
// answer. The resolved URL is stable for days, so cache it: in memory for the
// session (also de-duping concurrent in-flight requests) and in localStorage
// across launches.
const IMG_CACHE_KEY = 'signal_card_image_cache_v1';
const IMG_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const IMG_MAX_ENTRIES = 300;

const memCache = new Map();     // key -> resolved URL (or null for a known miss)
const inFlight = new Map();     // key -> Promise, so four callers share one fetch

function imgKey(name, game) {
  return `${(game || 'auto').toLowerCase()}::${String(name || '').trim().toLowerCase()}`;
}

function readImgCache() {
  try {
    const raw = localStorage.getItem(IMG_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeImgCache(cache) {
  try {
    const entries = Object.entries(cache);
    const trimmed = entries.length > IMG_MAX_ENTRIES
      ? Object.fromEntries(
          entries.sort((a, b) => (b[1]?.ts || 0) - (a[1]?.ts || 0)).slice(0, IMG_MAX_ENTRIES)
        )
      : cache;
    localStorage.setItem(IMG_CACHE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full / disabled — the in-memory cache still does its job.
  }
}

export async function fetchCardImage(cardName, game) {
  if (!cardName) return null;
  const key = imgKey(cardName, game);

  if (memCache.has(key)) return memCache.get(key);
  if (inFlight.has(key)) return inFlight.get(key);

  const persisted = readImgCache()[key];
  if (persisted && Date.now() - (persisted.ts || 0) < IMG_TTL_MS) {
    memCache.set(key, persisted.url ?? null);
    return persisted.url ?? null;
  }

  const promise = fetchCardImageUncached(cardName, game)
    .then((url) => {
      memCache.set(key, url ?? null);
      // Cache misses are cached too — a card with no art shouldn't re-query
      // three free APIs on every render.
      const cache = readImgCache();
      cache[key] = { ts: Date.now(), url: url ?? null };
      writeImgCache(cache);
      return url ?? null;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, promise);
  return promise;
}

async function fetchCardImageUncached(cardName, game) {
  try {
    if (game === 'mtg') return await fetchMTGImage(cardName);
    if (game === 'yugioh') return await fetchYuGiOhImage(cardName);
    if (game === 'pokemon') return await fetchPokemonImage(cardName);

    // Unknown game — try all three
    const result =
      (await fetchYuGiOhImage(cardName).catch((e) => {
        console.warn(`[fetchCardImage] yugioh threw for "${cardName}":`, e);
        return null;
      })) ||
      (await fetchMTGImage(cardName).catch((e) => {
        console.warn(`[fetchCardImage] mtg threw for "${cardName}":`, e);
        return null;
      })) ||
      (await fetchPokemonImage(cardName).catch((e) => {
        console.warn(`[fetchCardImage] pokemon threw for "${cardName}":`, e);
        return null;
      }));
    return result;
  } catch (err) {
    console.error(`[fetchCardImage] unexpected error for "${cardName}"/${game}:`, err);
    return null;
  }
}

async function fetchMTGImage(name) {
  const res = await fetch(
    `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    console.warn(`[fetchCardImage] scryfall ${res.status} for "${name}"`);
    return null;
  }
  const data = await res.json();
  return (
    data.image_uris?.large ||
    data.image_uris?.normal ||
    data.card_faces?.[0]?.image_uris?.large ||
    null
  );
}

async function fetchYuGiOhImage(name) {
  const res = await fetch(
    `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(name)}`
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    console.warn(`[fetchCardImage] ygoprodeck ${res.status} for "${name}"`);
    return null;
  }
  const data = await res.json();
  return data.data?.[0]?.card_images?.[0]?.image_url || null;
}

async function fetchPokemonImage(name) {
  // Strip suffixes like "ex", "V", "VMAX" for better search matching.
  // Also strip embedded quotes — encodeURIComponent doesn't escape them and
  // they break the name:"..." Pokémon API query syntax.
  const cleanName = name
    .replace(/"/g, '')
    .replace(/\s+(ex|EX|V|VMAX|VSTAR|GX)\s*$/i, '')
    .trim();
  const res = await fetch(
    `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(cleanName)}"&pageSize=1&orderBy=-set.releaseDate`
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    console.warn(`[fetchCardImage] pokemontcg ${res.status} for "${cleanName}"`);
    return null;
  }
  const data = await res.json();
  return data.data?.[0]?.images?.large || data.data?.[0]?.images?.small || null;
}
