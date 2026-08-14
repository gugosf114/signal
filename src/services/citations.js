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
    let path = u.pathname.replace(/\/+$/, '');
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
  } catch {
    return String(url).replace(/\/+$/, '').toLowerCase();
  }
}

const YT_ID_PATTERNS = [
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/watch\?[^#]*v=([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
];

// Single definition of the YouTube ID matcher. brandIcons.jsx re-exports this
// rather than keeping its own copy — the two drifted apart previously.
export function extractYouTubeId(url) {
  if (!url) return null;
  for (const p of YT_ID_PATTERNS) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Every URL the model genuinely retrieved through the web_search tool.
export function extractRealUrls(contentBlocks) {
  const urls = new Set();
  for (const block of contentBlocks || []) {
    if (block.type !== 'web_search_tool_result') continue;
    const items = Array.isArray(block.content) ? block.content : [];
    for (const item of items) {
      if (item.type === 'web_search_result' && item.url) {
        urls.add(normalizeUrl(item.url));
      }
    }
  }
  return urls;
}

// Every URL we injected into the prompt via a pre-fetch block. Real by
// construction — we fetched them ourselves moments earlier.
export function collectPrefetchUrls({ cardData, community, creators, ebay, jp } = {}) {
  const urls = new Set();
  const add = (u) => { if (u && typeof u === 'string') urls.add(normalizeUrl(u)); };

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

  // 1. Exact normalized match — strongest signal
  if (realUrls.has(normalizeUrl(url))) return true;

  // 2. Host-aware fallback for cases where the model visited a parent page
  //    and cited a deeper one. Strict by host class to prevent path-prefix
  //    holes (e.g. '/watch' matching '/watch?v=ANYTHING' since URL.pathname
  //    excludes the query string).
  let a;
  try { a = new URL(url); } catch { return false; }

  // YouTube: match by video ID, not pathname. One real /watch URL must NOT
  // unlock unlimited fabricated /watch?v=X citations.
  if (a.host.endsWith('youtube.com') || a.host.endsWith('youtu.be')) {
    const id = extractYouTubeId(url);
    if (!id) return false;
    for (const real of realUrls) {
      if (extractYouTubeId(real) === id) return true;
    }
    return false;
  }

  // Other hosts: accept only true sub-paths of a real URL. Require a slash
  // boundary so '/products/foo' doesn't accept '/products-fake'. Reject
  // bare-host roots so '/' doesn't pass everything on the host.
  for (const real of realUrls) {
    let b;
    try { b = new URL(real); } catch { continue; }
    if (a.host.toLowerCase() !== b.host.toLowerCase()) continue;
    if (b.pathname.length <= 1) continue; // '/' or '' — too permissive
    if (a.pathname === b.pathname) return true;
    if (a.pathname.startsWith(b.pathname + '/')) return true;
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
    signal.sources = before.filter((s) => urlIsReal(s.url, realUrls));
    const drops = before.filter((s) => !urlIsReal(s.url, realUrls)).map((s) => s.url);
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
  if (totalDropped > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[signal] dropped ${totalDropped} unverifiable source URL(s):`, droppedByKey);
  }
  return parsed;
}
