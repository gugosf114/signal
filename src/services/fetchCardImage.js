// ─── Card Image Fetcher ──────────────────────────────────────────────────────
// Uses free TCG APIs to fetch card artwork. No API keys required.
//
// Scryfall (MTG)        — https://api.scryfall.com
// YGOPRODeck (Yu-Gi-Oh) — https://db.ygoprodeck.com
// Pokémon TCG API       — https://api.pokemontcg.io
//
// Three distinct outcomes, and keeping them apart is the whole point:
//   a URL   — found it
//   null    — the API answered, and this card genuinely has no art (404)
//   FAILED  — the API did not answer properly (5xx, network, parse)
//
// Only the first two are facts about the card. FAILED is a fact about the
// server, and must never be remembered as if it were a fact about the card.

// ─── Image URL cache ─────────────────────────────────────────────────────────
// The same card's art is requested by up to four components at once —
// LoadingTheater's CardSlate, OverallScore's CardImage, EmptyState's tile and
// the NewsStrip fallback — each firing its own round trip for an identical
// answer. The resolved URL is stable for days, so cache it: in memory for the
// session (also de-duping concurrent in-flight requests) and in localStorage
// across launches.
//
// v2: v1 cached every null for 7 days, including the nulls produced by a
// transient pokemontcg.io 500. One bad minute on their end blanked a card's art
// for a week. Negatives now expire in an hour, and outright failures aren't
// cached at all. The key was bumped so poisoned v1 entries are simply dropped.
const IMG_CACHE_KEY = 'signal_card_image_cache_v2';
const IMG_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // found an image
const NEG_TTL_MS = 60 * 60 * 1000;            // genuinely no image for this card
const IMG_MAX_ENTRIES = 300;

// Distinguishes "the server broke" from "this card has no art".
const FAILED = Symbol('fetch-failed');

const memCache = new Map();     // key -> URL string, or null for a known miss
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
  if (persisted) {
    const ttl = persisted.url ? IMG_TTL_MS : NEG_TTL_MS;
    if (Date.now() - (persisted.ts || 0) < ttl) {
      memCache.set(key, persisted.url ?? null);
      return persisted.url ?? null;
    }
  }

  const promise = fetchCardImageUncached(cardName, game)
    .then((result) => {
      if (result === FAILED) {
        // The API misbehaved. Remember nothing — the next render should try
        // again rather than inherit a server outage as a permanent verdict.
        return null;
      }
      const url = result ?? null;
      memCache.set(key, url);
      const cache = readImgCache();
      cache[key] = { ts: Date.now(), url };
      writeImgCache(cache);
      return url;
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

    // Unknown game — try all three. A URL from any of them wins. Otherwise the
    // result is only a genuine "no such card" if at least one API actually
    // answered; if every one of them broke, that's FAILED and gets no cache.
    const results = [];
    for (const [label, fn] of [
      ['yugioh', fetchYuGiOhImage],
      ['mtg', fetchMTGImage],
      ['pokemon', fetchPokemonImage],
    ]) {
      const r = await fn(cardName).catch((e) => {
        console.warn(`[fetchCardImage] ${label} threw for "${cardName}":`, e);
        return FAILED;
      });
      if (typeof r === 'string' && r) return r;
      results.push(r);
    }
    return results.every((r) => r === FAILED) ? FAILED : null;
  } catch (err) {
    console.error(`[fetchCardImage] unexpected error for "${cardName}"/${game}:`, err);
    return FAILED;
  }
}

async function fetchMTGImage(name) {
  let res;
  try {
    res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
  } catch (e) {
    console.warn(`[fetchCardImage] scryfall network error for "${name}":`, e);
    return FAILED;
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    console.warn(`[fetchCardImage] scryfall ${res.status} for "${name}"`);
    return FAILED;
  }
  try {
    const data = await res.json();
    return (
      data.image_uris?.large ||
      data.image_uris?.normal ||
      data.card_faces?.[0]?.image_uris?.large ||
      null
    );
  } catch {
    return FAILED;
  }
}

async function fetchYuGiOhImage(name) {
  let res;
  try {
    res = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(name)}`);
  } catch (e) {
    console.warn(`[fetchCardImage] ygoprodeck network error for "${name}":`, e);
    return FAILED;
  }
  // YGOPRODeck answers a genuine miss with 400 as well as 404.
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) {
    console.warn(`[fetchCardImage] ygoprodeck ${res.status} for "${name}"`);
    return FAILED;
  }
  try {
    const data = await res.json();
    return data.data?.[0]?.card_images?.[0]?.image_url || null;
  } catch {
    return FAILED;
  }
}

async function fetchPokemonImage(name) {
  // Strip suffixes like "ex", "V", "VMAX" for better search matching.
  // Also strip embedded quotes — encodeURIComponent doesn't escape them and
  // they break the name:"..." Pokémon API query syntax.
  const cleanName = name
    .replace(/"/g, '')
    .replace(/\s+(ex|EX|V|VMAX|VSTAR|GX)\s*$/i, '')
    .trim();
  let res;
  try {
    res = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(cleanName)}"&pageSize=1&orderBy=-set.releaseDate`
    );
  } catch (e) {
    console.warn(`[fetchCardImage] pokemontcg network error for "${cleanName}":`, e);
    return FAILED;
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    // 500s and 429s from pokemontcg.io are routine and transient.
    console.warn(`[fetchCardImage] pokemontcg ${res.status} for "${cleanName}"`);
    return FAILED;
  }
  try {
    const data = await res.json();
    return data.data?.[0]?.images?.large || data.data?.[0]?.images?.small || null;
  } catch {
    return FAILED;
  }
}
