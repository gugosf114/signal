// ─── Card Image Fetcher ──────────────────────────────────────────────────────
// Uses free TCG APIs to fetch card artwork. No API keys required.
//
// Scryfall (MTG)        — https://api.scryfall.com
// YGOPRODeck (Yu-Gi-Oh) — https://db.ygoprodeck.com
// Pokémon TCG API       — https://api.pokemontcg.io
//
// 404 from any API = legitimate "card not found" — silent, returns null.
// Other failures (4xx, 5xx, network, parse) = operational issue — logged.

export async function fetchCardImage(cardName, game) {
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
