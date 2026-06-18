// Top 5 trending cards, pulled from TCGplayer Infinite's weekly editorial
// "Biggest Price Spikes" / "Bestselling Cards" articles for each vertical.
//
// Strategy: each game's weekly trending article lists 5-10 mover cards as
// <card-hover-link> tags with the canonical card name in `card-name`. We
// fetch the latest such article per vertical, parse out the cards (filtering
// out set-link tags), and return the top mix:
//   - 2 Pokemon · 2 Magic · 1 Yu-Gi-Oh!  (mirrors the typical app split)
//
// Cached in localStorage for 6h since the source articles publish weekly.

const CACHE_KEY = 'signal_top_trending_v2';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const VERTICALS = [
  { id: 'pokemon', game: 'pokemon', target: 2 },
  { id: 'magic',   game: 'mtg',     target: 2 },
  { id: 'yugioh',  game: 'yugioh',  target: 1 },
];

const TRENDING_TITLE_PATTERNS = [
  /price spike/i,
  /biggest mover/i,
  /bestselling cards/i,
  /most expensive .* cards in packs/i,
  /movers and shakers/i,
];

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Card names from the article come as "Mega Greninja ex (CRI-116)" — strip
// the trailing set-code parenthetical so we hand the LLM a clean card name.
function stripSetCode(name) {
  return decodeEntities(name)
    .replace(/\s*\([A-Z0-9]+-[A-Z0-9]+\)\s*$/i, '')
    .trim();
}

async function findLatestTrendingArticle(verticalId) {
  const url = `https://infinite-api.tcgplayer.com/c/articles/?source=infinite-content&contentType=Article&verticals=${encodeURIComponent(verticalId)}&rows=10`;
  const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
  if (!res.ok) return null;
  const data = await res.json();
  const items = Array.isArray(data?.result) ? data.result : [];
  return items.find((it) =>
    TRENDING_TITLE_PATTERNS.some((p) => p.test(it.title || ''))
  ) || null;
}

async function fetchArticleBody(uuid) {
  const res = await fetch(
    `https://infinite-api.tcgplayer.com/c/article/${encodeURIComponent(uuid)}`,
    { signal: AbortSignal.timeout(7000) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.result?.article?.body || null;
}

function parseCardsFromBody(body, game, target) {
  if (!body) return [];
  const seen = new Set();
  const out = [];
  const tagRe = /<card-hover-link\s+([^>]*?)\s*><\/card-hover-link>/g;
  let m;
  while ((m = tagRe.exec(body)) !== null && out.length < target) {
    const attrs = {};
    const attrRe = /(\w[\w-]*)="([^"]*)"/g;
    let am;
    while ((am = attrRe.exec(m[1])) !== null) attrs[am[1]] = am[2];
    if (attrs['is-product'] === 'true') continue; // skip set-link entries
    const rawName = attrs['card-name'] || '';
    const name = stripSetCode(rawName);
    if (!name) continue;
    // Some article entries have a numeric TCGplayer product ID in card-name
    // even though is-product is empty — guard against shipping "67121" as
    // a "trending card name." Real card names always contain letters.
    if (!/[A-Za-z]/.test(name)) continue;
    // Minimum sanity — must be at least 3 chars
    if (name.length < 3) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, game });
  }
  return out;
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    if (!Array.isArray(data) || !data.length) return null;
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

export async function getTopTrending() {
  const cached = readCache();
  if (cached) return cached;

  const results = await Promise.all(
    VERTICALS.map(async (v) => {
      try {
        const article = await findLatestTrendingArticle(v.id);
        if (!article?.uuid) return [];
        const body = await fetchArticleBody(article.uuid);
        return parseCardsFromBody(body, v.game, v.target);
      } catch {
        return [];
      }
    })
  );

  const flat = results.flat();
  if (flat.length) writeCache(flat);
  return flat;
}
