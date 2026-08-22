// ─── Citation verification ───────────────────────────────────────────────────
// The load-bearing honesty layer: a source may only appear in a report if its
// URL can be traced back to something we actually retrieved. Everything else is
// dropped, counted, and reported.
//
// A URL counts as real if it came from either:
//   1. a web_search the model ran (web_search_tool_result blocks), or
//   2. a pre-fetch block we built ourselves from a live API call
//      (Reddit JSON, YouTube Data, eBay Browse, the TCG catalogues).
//
// (2) is easy to forget and fails silently — the filter simply deletes every
// honestly-cited pre-fetched source and the page still looks fine, just emptier.
//
// Deliberately free of imports so it can be unit-tested under plain `node --test`
// with no bundler and no test framework. See citations.test.js.

export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_') || ['fbclid', 'gclid', 'si', 'feature'].includes(key.toLowerCase())) {
        u.searchParams.delete(key);
      }
    }
    u.searchParams.sort();
    let path = u.pathname.replace(/\/+$/, '');
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
  } catch {
    return null;
  }
}

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be']);
const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

// Single definition of the YouTube ID matcher. brandIcons.jsx re-exports this
// rather than keeping its own copy — the two drifted apart previously.
export function extractYouTubeId(url) {
  if (!url) return null;
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  const host = parsed.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;
  let id = null;
  if (host === 'youtu.be' || host === 'www.youtu.be') id = parsed.pathname.split('/').filter(Boolean)[0] || null;
  else if (parsed.pathname === '/watch') id = parsed.searchParams.get('v');
  else {
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (['embed', 'shorts', 'v'].includes(parts[0])) id = parts[1] || null;
  }
  return id && YOUTUBE_ID_RE.test(id) ? id : null;
}

// Every URL the model genuinely retrieved through the web_search tool.
export function extractRealUrls(contentBlocks) {
  const urls = new Set();
  for (const block of contentBlocks || []) {
    if (block.type !== 'web_search_tool_result') continue;
    const items = Array.isArray(block.content) ? block.content : [];
    for (const item of items) {
      if (item.type === 'web_search_result' && item.url) {
        const normalized = normalizeUrl(item.url);
        if (normalized) urls.add(normalized);
      }
    }
  }
  return urls;
}

// Every URL we injected into the prompt via a pre-fetch block. Real by
// construction — we fetched them ourselves moments earlier.
export function collectPrefetchUrls({ cardData, community, creators, ebay, jp } = {}) {
  const urls = new Set();
  const add = (u) => {
    if (!u || typeof u !== 'string') return;
    const normalized = normalizeUrl(u);
    if (normalized) urls.add(normalized);
  };

  for (const p of community?.posts || []) add(p.url);
  for (const v of creators?.videos || []) add(v.url);
  for (const v of jp?.jpVideos || []) add(v.url);
  for (const l of ebay?.buy_it_now || []) add(l.url);
  for (const l of ebay?.auction || []) add(l.url);
  add(cardData?.tcgplayerUrl);
  add(cardData?.scryfallUri);

  return urls;
}

export function urlIsReal(url, realUrls) {
  if (!url) return false;
  const normalized = normalizeUrl(url);
  if (!normalized) return false;

  // 1. Exact normalized match — strongest signal
  if (realUrls.has(normalized)) return true;

  // 2. Host-aware fallback for cases where the model visited a parent page
  //    and cited a deeper one. Strict by host class to prevent path-prefix
  //    holes (e.g. '/watch' matching '/watch?v=ANYTHING' since URL.pathname
  //    excludes the query string).
  let a;
  try { a = new URL(normalized); } catch { return false; }

  // YouTube: match by video ID, not pathname. One real /watch URL must NOT
  // unlock unlimited fabricated /watch?v=X citations.
  if (YOUTUBE_HOSTS.has(a.hostname.toLowerCase())) {
    const id = extractYouTubeId(url);
    if (!id) return false;
    for (const real of realUrls) {
      const realId = extractYouTubeId(real);
      if (realId && realId === id) return true;
    }
    return false;
  }
  return false;
}

export function filterHallucinatedSources(parsed, realUrls) {
  if (!Array.isArray(parsed.signals)) {
    parsed.signals = [];
    parsed._truncated = true;
    return parsed;
  }
  const droppedByKey = {};
  let totalDropped = 0;
  for (const signal of parsed.signals) {
    if (!Array.isArray(signal.sources)) {
      signal.sources = [];
      signal.dropped = 0;
      continue;
    }
    const before = signal.sources;
    const checked = before.map((source) => ({ source, keep: urlIsReal(source?.url, realUrls) }));
    signal.sources = checked.filter(({ keep }) => keep).map(({ source }) => source);
    const drops = checked.filter(({ keep }) => !keep).map(({ source }) => source?.url);
    // Surfaced in the UI so an empty source list can say WHICH kind of empty it
    // is: "the model found nothing" reads very differently from "the model made
    // something up and we caught it."
    signal.dropped = drops.length;
    if (drops.length) {
      droppedByKey[signal.key || '?'] = drops;
      totalDropped += drops.length;
    }
  }
  parsed._droppedTotal = totalDropped;
  let droppedListings = 0;
  if (parsed.ebay_listings && typeof parsed.ebay_listings === 'object') {
    for (const key of ['buy_it_now', 'auction']) {
      const listings = Array.isArray(parsed.ebay_listings[key]) ? parsed.ebay_listings[key] : [];
      const kept = listings.filter((listing) => urlIsReal(listing?.url, realUrls));
      droppedListings += listings.length - kept.length;
      parsed.ebay_listings[key] = kept;
    }
  }
  parsed._droppedListings = droppedListings;
  if (totalDropped > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[signal] dropped ${totalDropped} unverifiable source URL(s):`, droppedByKey);
  }
  return parsed;
}
