// Exact weekly movers from TCGplayer Infinite.
//
// The old parser read every <card-hover-link>. Those tags also appear in the
// article intro and side examples. It then erased `(SET-NUMBER)`, so tapping a
// chip launched a broad name scan. Only <price-history-card> tags are movers,
// and every one is resolved to a catalogue printing before it reaches the UI.

import { expandFinishRows, mtgRow, pokemonRow, searchCardsByName } from './fetchExpansions.js';
import { baseTcgplayerName } from './fetchTcgplayerPrice.js';
import { fetchCatalogueJSON } from './signalGateway.js';
import { hasPrintingPin } from './recentScans.js';

const CACHE_KEY = 'signal_top_trending_v3';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const VERTICALS = [
  { id: 'pokemon', game: 'pokemon', target: 2 },
  { id: 'magic', game: 'mtg', target: 2 },
  { id: 'yugioh', game: 'yugioh', target: 1 },
];

const TRENDING_TITLE_PATTERNS = [
  { re: /price spike/i,                      dir: 'up' },
  { re: /biggest mover/i,                    dir: null },
  { re: /bestselling cards/i,                dir: null },
  { re: /most expensive .* cards in packs/i, dir: null },
  { re: /movers and shakers/i,               dir: null },
];

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function attributes(raw) {
  const out = {};
  const re = /([:\w][\w:-]*)="([^"]*)"/g;
  let match;
  while ((match = re.exec(raw || '')) !== null) out[match[1]] = decodeEntities(match[2]);
  return out;
}

export function pokemonArticleIdentity(value) {
  const decoded = decodeEntities(value).trim();
  const match = decoded.match(/^(.*?)\s*\(([A-Z0-9-]+)-([A-Z0-9]+)\)\s*$/i);
  if (!match) return null;
  return {
    name: match[1].trim(),
    sourceCode: match[2].toUpperCase(),
    number: match[3],
  };
}

export function parseTrendingCardsFromBody(body, game, target = 5, meta = {}) {
  if (!body) return [];
  const seen = new Set();
  const refs = [];
  const tagRe = /<price-history-card\s+([^>]*?)>/gi;
  let match;
  while ((match = tagRe.exec(body)) !== null && refs.length < target) {
    const attrs = attributes(match[1]);
    const cardId = decodeEntities(attrs['card-id']).trim();
    const variantId = Number(attrs['variant-id']);
    if (!cardId || !/[A-Za-z]/.test(cardId)) continue;
    const pokemon = game === 'pokemon' ? pokemonArticleIdentity(cardId) : null;
    if (game === 'pokemon' && !pokemon) continue;
    if (game !== 'pokemon' && (!Number.isInteger(variantId) || variantId <= 0)) continue;
    const name = pokemon?.name || baseTcgplayerName(cardId);
    const identity = pokemon
      ? `${pokemon.sourceCode}-${pokemon.number}`.toLowerCase()
      : `tcgplayer:${variantId}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    refs.push({
      name,
      game,
      sourceCardId: cardId,
      sourceCode: pokemon?.sourceCode || null,
      number: pokemon?.number || null,
      variantId: Number.isInteger(variantId) ? variantId : null,
      variantSet: attrs['variant-set'] || null,
      dir: meta.dir || null,
      sourceTitle: meta.sourceTitle || null,
    });
  }
  return refs;
}

function normalizedName(value) {
  return String(value || '')
    .replace(/[δΔ]/g, ' delta ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function selectPokemonTrendingCard(cards, ref) {
  const wantedName = normalizedName(ref?.name);
  const wantedCode = String(ref?.sourceCode || '').toUpperCase();
  const wantedNumber = String(ref?.number || '').replace(/^0+/, '') || '0';
  const matches = (Array.isArray(cards) ? cards : []).filter((card) => {
    const code = String(card?.set?.ptcgoCode || card?.set?.id || '').toUpperCase();
    const number = String(card?.number || '').replace(/^0+/, '') || '0';
    return code === wantedCode
      && number === wantedNumber
      && normalizedName(card?.name) === wantedName;
  });
  return matches.length === 1 ? matches[0] : null;
}

export function selectTcgplayerTrendingProduct(rows, variantId) {
  const wanted = Number(variantId);
  const matches = (Array.isArray(rows) ? rows : [])
    .filter((row) => Number(row?.tcgplayerProductId) === wanted);
  return matches.length === 1 ? matches[0] : null;
}

async function catalogueJSON(url, tries = 3) {
  let lastError;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      try {
        const relayed = await fetchCatalogueJSON(url, AbortSignal.timeout(7000));
        if (relayed) return relayed;
      } catch (error) {
        lastError = error;
      }
      const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
      if (response.status === 400 || response.status === 404) return null;
      if (!response.ok) throw new Error(String(response.status));
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < tries - 1) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError || new Error('Catalogue did not answer.');
}

function withMeta(card, ref) {
  return {
    ...card,
    pinned: true,
    sourceCode: ref.sourceCode || card.setCode || null,
    dir: ref.dir,
    sourceTitle: ref.sourceTitle,
  };
}

async function resolvePokemon(ref) {
  const setQuery = encodeURIComponent(`ptcgoCode:${ref.sourceCode}`);
  const sets = await catalogueJSON(`https://api.pokemontcg.io/v2/sets?q=${setQuery}&pageSize=10`);
  const exactSets = (sets?.data || []).filter(
    (set) => String(set?.ptcgoCode || '').toUpperCase() === ref.sourceCode,
  );
  if (exactSets.length !== 1) return null;
  const cardQuery = encodeURIComponent(`set.id:${exactSets[0].id} number:${ref.number}`);
  const payload = await catalogueJSON(`https://api.pokemontcg.io/v2/cards?q=${cardQuery}&pageSize=20`);
  const card = selectPokemonTrendingCard(payload?.data, ref);
  if (!card) return null;
  const priced = expandFinishRows(pokemonRow(card)).filter((row) => Number.isFinite(row.price) && row.price > 0);
  // The article does not name a finish. One real finish is safe; two are a
  // choice, so omit the chip instead of silently choosing one.
  return priced.length === 1 ? withMeta(priced[0], ref) : null;
}

async function resolveMtg(ref) {
  const card = await catalogueJSON(`https://api.scryfall.com/cards/tcgplayer/${ref.variantId}`);
  if (!card || Number(card.tcgplayer_id) !== ref.variantId) return null;
  const rows = expandFinishRows(mtgRow(card));
  const namedFinish = /\bfoil\b/i.test(ref.sourceCardId) ? 'foil' : 'normal';
  const exact = rows.find((row) => row.form === namedFinish && Number.isFinite(row.price) && row.price > 0);
  return exact ? withMeta(exact, ref) : null;
}

async function resolveYugioh(ref) {
  const rows = await searchCardsByName('yugioh', baseTcgplayerName(ref.sourceCardId), null);
  const exact = selectTcgplayerTrendingProduct(rows, ref.variantId);
  return exact ? withMeta(exact, ref) : null;
}

export async function resolveTrendingCard(ref) {
  if (!ref) return null;
  if (ref.game === 'pokemon') return resolvePokemon(ref);
  if (ref.game === 'mtg') return resolveMtg(ref);
  if (ref.game === 'yugioh') return resolveYugioh(ref);
  return null;
}

async function resolveEnough(refs, target) {
  const cards = [];
  let index = 0;
  while (cards.length < target && index < refs.length) {
    const count = target - cards.length;
    const batch = refs.slice(index, index + count);
    index += batch.length;
    const settled = await Promise.allSettled(batch.map(resolveTrendingCard));
    cards.push(...settled
      .filter((result) => result.status === 'fulfilled' && hasPrintingPin(result.value))
      .map((result) => result.value));
  }
  return cards.slice(0, target);
}

async function findLatestTrendingArticle(verticalId) {
  const url = `https://infinite-api.tcgplayer.com/c/articles/?source=infinite-content&contentType=Article&verticals=${encodeURIComponent(verticalId)}&rows=10`;
  const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
  if (!response.ok) return null;
  const data = await response.json();
  for (const item of Array.isArray(data?.result) ? data.result : []) {
    const hit = TRENDING_TITLE_PATTERNS.find((pattern) => pattern.re.test(item.title || ''));
    if (hit) return { ...item, dir: hit.dir, sourceTitle: item.title || '' };
  }
  return null;
}

async function fetchArticleBody(uuid) {
  const response = await fetch(
    `https://infinite-api.tcgplayer.com/c/article/${encodeURIComponent(uuid)}`,
    { signal: AbortSignal.timeout(7000) },
  );
  if (!response.ok) return null;
  const data = await response.json();
  return data?.result?.article?.body || null;
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    const age = Date.now() - ts;
    if (age < 0 || age > CACHE_TTL_MS) return null;
    if (!Array.isArray(data) || !data.length || !data.every((card) => hasPrintingPin(card))) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

export async function getTopTrending() {
  const cached = readCache();
  if (cached) return cached;

  const groups = await Promise.all(VERTICALS.map(async (vertical) => {
    try {
      const article = await findLatestTrendingArticle(vertical.id);
      if (!article?.uuid) return [];
      const body = await fetchArticleBody(article.uuid);
      const refs = parseTrendingCardsFromBody(body, vertical.game, vertical.target * 3, article);
      return resolveEnough(refs, vertical.target);
    } catch {
      return [];
    }
  }));

  const cards = groups.flat();
  if (cards.length) writeCache(cards);
  return cards;
}
