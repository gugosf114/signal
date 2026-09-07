// One Pokémon card, two catalogue id shapes.
//
// pokemontcg.io writes Prismatic Evolutions #161 as `sv8pt5-161`; TCGdex writes
// the same card as `sv08.5-161`. The app reads whichever catalogue answers
// first (pokemontcg.io fails about half its calls on a bad day), so the same
// physical card was reaching the cache, the shared report store, Recent, and
// Collection under two different identities. These two helpers translate the
// shapes so identity is computed on one of them.
//
// Only the modern families differ (sv, me). Older ids (base1, ex10, xy12,
// swsh3) are spelled the same on both sides and pass through untouched.

const PADDED_FAMILIES = new Set(['sv', 'me']);

function split(id) {
  const match = String(id || '').trim().match(/^([A-Za-z]+)(\d+)(pt5|\.5)?([A-Za-z0-9]*)-(.+)$/);
  if (!match) return null;
  const [, family, setNumber, half, setSuffix, number] = match;
  return { family, setNumber, half: half ? '5' : '', setSuffix, number };
}

// TCGdex shape → pokemontcg.io shape. `sv08.5-060` → `sv8pt5-60`.
export function toPokemontcgId(id) {
  const parts = split(id);
  if (!parts) return String(id || '').trim();
  const family = parts.family.toLowerCase();
  if (!PADDED_FAMILIES.has(family)) return String(id).trim();
  const setNumber = String(Number(parts.setNumber));
  const number = /^\d+$/.test(parts.number) ? String(Number(parts.number)) : parts.number;
  return `${family}${setNumber}${parts.half ? 'pt5' : ''}${parts.setSuffix}-${number}`;
}

// pokemontcg.io shape → TCGdex shape. `sv8pt5-60` → `sv08.5-060`.
export function toTcgdexId(id) {
  const parts = split(id);
  if (!parts) return String(id || '').trim();
  const family = parts.family.toLowerCase();
  if (!PADDED_FAMILIES.has(family)) return String(id).trim();
  const setNumber = String(Number(parts.setNumber)).padStart(2, '0');
  const number = /^\d+$/.test(parts.number) ? String(Number(parts.number)).padStart(3, '0') : parts.number;
  return `${family}${setNumber}${parts.half ? '.5' : ''}${parts.setSuffix}-${number}`;
}

// The identity every cache, list, and shared report key is computed from.
export function canonicalPokemonId(id) {
  return toPokemontcgId(id).toLowerCase();
}
