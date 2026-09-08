// ─── Citation verification ───────────────────────────────────────────────────
// The load-bearing honesty layer. A source may appear only when its URL joins
// to the complete record returned by web search or by an app-owned API call.
// The retrieval owns every visible field. Model-written metadata and factual
// prose are discarded even when the model happens to select a real URL.
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
const IMPLICATIONS = new Set(['up', 'down', 'neutral']);

const SOURCE_META = {
  'youtube.com': { type: 'youtube', source: 'YouTube' },
  'youtu.be': { type: 'youtube', source: 'YouTube' },
  'reddit.com': { type: 'reddit', source: 'Reddit' },
  'limitlesstcg.com': { type: 'tournament', source: 'Limitless TCG' },
  'tcgplayer.com': { type: 'marketplace_en', source: 'TCGplayer' },
  'ebay.com': { type: 'marketplace_en', source: 'eBay' },
  'scryfall.com': { type: 'other', source: 'Scryfall' },
  'pokemon.com': { type: 'other', source: 'Pokemon.com' },
  'deltiasgaming.com': { type: 'editorial', source: "Deltia's Gaming" },
};

function cleanText(value, max = 300) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
    : '';
}

function hostKey(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return Object.keys(SOURCE_META).find((key) => host === key || host.endsWith(`.${key}`)) || host;
  } catch {
    return '';
  }
}

function sourceMeta(url) {
  const key = hostKey(url);
  return SOURCE_META[key] || { type: 'editorial', source: key || 'Web source' };
}

function canonicalEvidence(input, defaults = {}) {
  const url = normalizeUrl(input?.url);
  if (!url) return null;
  const inferred = sourceMeta(url);
  return {
    type: defaults.type || inferred.type,
    source: cleanText(defaults.source || input?.source, 120) || inferred.source,
    title: cleanText(input?.title || defaults.title, 240) || inferred.source,
    date: cleanText(input?.date || input?.page_age || defaults.date, 60) || null,
    summary: cleanText(input?.cited_text || input?.summary || input?.description || defaults.summary, 500),
    url,
    reach: defaults.reach || 'unknown',
    audience: cleanText(defaults.audience, 100) || null,
  };
}

function putEvidence(registry, input, defaults = {}) {
  const evidence = canonicalEvidence(input, defaults);
  if (!evidence) return;
  const prior = registry.get(evidence.url);
  if (!prior) {
    registry.set(evidence.url, evidence);
    return;
  }
  registry.set(evidence.url, {
    ...prior,
    ...Object.fromEntries(Object.entries(evidence).filter(([, value]) => value !== '' && value !== null && value !== 'unknown')),
    reach: evidence.reach !== 'unknown' ? evidence.reach : prior.reach,
  });
}

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

// A URL allow-list proves only that a URL appeared. It does not prove the
// model copied the page title, date, publisher, or summary correctly. Keep the
// complete source record from the retrieval itself so those fields can never
// be supplied by the model.
export function extractSearchEvidence(contentBlocks) {
  const registry = new Map();
  for (const block of contentBlocks || []) {
    if (block?.type === 'web_search_tool_result') {
      for (const item of Array.isArray(block.content) ? block.content : []) {
        if (item?.type === 'web_search_result') putEvidence(registry, item);
      }
    }
    if (block?.type === 'text') {
      for (const citation of Array.isArray(block.citations) ? block.citations : []) {
        if (citation?.type === 'web_search_result_location') putEvidence(registry, citation);
      }
    }
  }
  return registry;
}

// Pre-fetch records come from APIs the app called itself. They are source
// records, not model prose. Their title, publisher, date, and description are
// therefore safe to lock into the final report.
export function collectPrefetchEvidence({ cardData, community, creators, ebay, jp } = {}) {
  const registry = new Map();
  for (const post of community?.posts || []) {
    const audience = Number.isFinite(post.score)
      ? `${post.score} points${Number.isFinite(post.comments) ? ` · ${post.comments} comments` : ''}`
      : null;
    putEvidence(registry, post, {
      type: 'reddit',
      source: post.subreddit || 'Reddit',
      audience,
    });
  }
  for (const video of creators?.videos || []) {
    putEvidence(registry, video, { type: 'youtube', source: video.channel || 'YouTube' });
  }
  for (const video of jp?.jpVideos || []) {
    putEvidence(registry, video, { type: 'youtube', source: video.channel || 'YouTube' });
  }
  for (const listing of ebay?.buy_it_now || []) {
    putEvidence(registry, listing, { type: 'marketplace_en', source: 'eBay' });
  }
  for (const listing of ebay?.auction || []) {
    putEvidence(registry, listing, { type: 'marketplace_en', source: 'eBay' });
  }
  const cardTitle = [cardData?.name, cardData?.setName, cardData?.number ? `#${cardData.number}` : null]
    .filter(Boolean).join(' · ');
  const marketUrl = cardData?.tcgplayerUrl || cardData?.priceUrl;
  if (marketUrl) {
    putEvidence(registry, { url: marketUrl, title: cardTitle }, {
      type: 'marketplace_en', source: cardData?.priceSource || 'Market source',
    });
  }
  if (cardData?.scryfallUri) {
    putEvidence(registry, { url: cardData.scryfallUri, title: cardTitle }, {
      type: 'other', source: 'Scryfall',
    });
  }
  return registry;
}

export function mergeEvidenceRegistries(...registries) {
  const merged = new Map();
  for (const registry of registries) {
    if (!(registry instanceof Map)) continue;
    for (const evidence of registry.values()) putEvidence(merged, evidence, evidence);
  }
  return merged;
}

function evidenceForUrl(registry, url) {
  if (!(registry instanceof Map)) return null;
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  if (registry.has(normalized)) return registry.get(normalized);
  const videoId = extractYouTubeId(normalized);
  if (!videoId) return null;
  for (const evidence of registry.values()) {
    if (extractYouTubeId(evidence.url) === videoId) return evidence;
  }
  return null;
}

function evidenceDetail(sources) {
  const first = sources[0];
  if (!first) return 'No verified evidence was retrieved for this area.';
  if (first.summary) return first.summary;
  return `Verified source: ${first.title}`;
}

// This is the hard trust boundary. The model may choose a retrieved URL and
// judge its direction. It may not create any visible source metadata or any
// factual detail. All visible source fields come from the retrieval registry.
// A signal with no locked source is neutral and says so plainly.
export function lockSourcesToEvidence(parsed, registry, { ebay } = {}) {
  if (!Array.isArray(parsed?.signals)) {
    if (parsed) {
      parsed.signals = [];
      parsed._truncated = true;
      parsed._evidenceVersion = 1;
    }
    return parsed;
  }

  let totalDropped = 0;
  parsed.signals = parsed.signals.map((signal) => {
    const seen = new Set();
    const sources = [];
    let dropped = Number(signal.dropped) || 0;
    for (const proposed of Array.isArray(signal.sources) ? signal.sources : []) {
      const evidence = evidenceForUrl(registry, proposed?.url);
      if (!evidence) {
        dropped += 1;
        continue;
      }
      const key = normalizeUrl(evidence.url);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      sources.push({
        ...evidence,
        implication: IMPLICATIONS.has(proposed.implication) ? proposed.implication : 'neutral',
      });
    }
    totalDropped += dropped;
    return {
      ...signal,
      level: sources.length ? signal.level : 0,
      detail: evidenceDetail(sources),
      sources,
      dropped,
    };
  });

  // eBay rows are copied from the API response. The model never gets to alter
  // the title, price, seller, bid count, or URL of a real listing.
  parsed.ebay_listings = {
    buy_it_now: (ebay?.buy_it_now || []).slice(0, 2).map((item) => ({ ...item })),
    auction: (ebay?.auction || []).slice(0, 1).map((item) => ({ ...item })),
  };
  parsed._droppedTotal = totalDropped;
  parsed._droppedListings = 0;
  parsed._evidenceVersion = 1;
  return parsed;
}

export function reportEvidenceStats(signals, expected = 8) {
  const list = Array.isArray(signals) ? signals : [];
  const sourced = list.filter((signal) => Array.isArray(signal?.sources) && signal.sources.length > 0);
  const urls = new Set();
  for (const signal of sourced) {
    for (const source of signal.sources) {
      const normalized = normalizeUrl(source?.url);
      if (normalized) urls.add(normalized);
    }
  }
  return {
    sourcedSignalCount: sourced.length,
    expectedSignalCount: expected,
    uniqueSourceCount: urls.size,
  };
}

export function buildVerifiedSummary({ cardName = '', prices = {}, signals = [] } = {}) {
  const parts = [];
  const price = cleanText(prices?.en_price, 40);
  if (cardName && price) parts.push(`${cleanText(cardName, 180)} is ${price} for this exact printing.`);
  const history = prices?.history;
  if (Number.isFinite(history?.change30)) {
    const change = `${history.change30 > 0 ? '+' : ''}${history.change30.toFixed(1)}%`;
    const sold = Number.isFinite(history.sold30) ? ` with ${history.sold30} copies sold` : '';
    parts.push(`Its market price moved ${change} over 30 days${sold}.`);
  }
  const stats = reportEvidenceStats(signals);
  if (stats.sourcedSignalCount) {
    parts.push(`${stats.sourcedSignalCount} of ${stats.expectedSignalCount} research areas ${stats.sourcedSignalCount === 1 ? 'has' : 'have'} verified evidence from ${stats.uniqueSourceCount} unique source${stats.uniqueSourceCount === 1 ? '' : 's'}.`);
  } else {
    parts.push('No verified research evidence was found for this exact printing.');
  }
  return parts.join(' ');
}
