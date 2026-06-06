// ─── TCG News Feed ────────────────────────────────────────────────────────────
// Aggregates current TCG articles from a mix of sources:
//   - TCGplayer Infinite (JSON API, used for Pokemon)
//   - RSS feeds (used for MTG + YGO)
//
// Pokemon RSS sources (PkmnCards, SixPrizes) were retired here because their
// feeds went dormant — PkmnCards stopped publishing in 2012, SixPrizes paused
// in November 2020. TCGplayer Infinite ships current Pokemon articles daily.
//
// CORS: infinite-api.tcgplayer.com reflects the request Origin via
// Access-Control-Allow-Origin, so direct browser fetches work without a proxy.
// rss2json.com still handles RSS sources that don't expose CORS themselves.

const SOURCES = [
  {
    id: 'tcgp-pokemon',
    label: 'TCGplayer',
    color: '#C9692E',
    game: 'pokemon',
    type: 'tcgp',
    vertical: 'pokemon',
    rows: 4,
  },
  {
    id: 'mtggoldfish',
    label: 'MTGGoldfish',
    color: '#FFB74D',
    game: 'mtg',
    type: 'rss',
    rss: 'https://www.mtggoldfish.com/feed',
  },
  {
    id: 'ygorganization',
    label: 'YGOrganization',
    color: '#B58F18',
    game: 'yugioh',
    type: 'rss',
    rss: 'https://ygorganization.com/feed/',
  },
];

const RSS2JSON = 'https://api.rss2json.com/v1/api.json';
const TCGP_API = 'https://infinite-api.tcgplayer.com/c/articles/';

async function fetchRss(source) {
  try {
    const key = typeof import.meta !== 'undefined'
      ? import.meta.env?.VITE_RSS2JSON_KEY
      : null;
    const keyParam = key ? `&api_key=${key}&count=10` : '';
    const url = `${RSS2JSON}?rss_url=${encodeURIComponent(source.rss)}${keyParam}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== 'ok' || !Array.isArray(data.items)) return [];

    return data.items.slice(0, 2).map((item) => {
      const rawDesc = (item.description || item.content || '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);

      // Image priority: rss2json thumbnail → enclosure → first <img> in content body
      let imageUrl = item.thumbnail || item.enclosure?.link || null;
      if (!imageUrl) {
        const html = item.content || item.description || '';
        const match = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
        if (match) {
          const src = match[1];
          if (!src.includes('gravatar') && !src.includes('avatar') && !src.includes('1x1') && !src.includes('pixel')) {
            imageUrl = src;
          }
        }
      }

      return {
        id: item.guid || item.link,
        title: (item.title || '').trim(),
        link: item.link || '',
        description: rawDesc,
        imageUrl,
        pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
        source,
      };
    }).filter(a => a.title && a.link);
  } catch {
    return [];
  }
}

async function fetchTcgp(source) {
  try {
    const rows = source.rows || 4;
    const url = `${TCGP_API}?source=infinite-content&contentType=Article&verticals=${encodeURIComponent(source.vertical)}&rows=${rows}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data?.result) ? data.result : [];
    return items.slice(0, rows).map((item) => ({
      id: item.uuid || item.canonicalURL,
      title: (item.title || '').trim(),
      link: item.canonicalURL ? `https://infinite.tcgplayer.com${item.canonicalURL}` : '',
      description: (item.teaser || '').trim().slice(0, 120),
      // imageUrl intentionally left null — the news strip overrides with a
      // per-game card-shaped fallback anyway, and TCGplayer's OpenGraph
      // images are wide banners that would letterboxed in the portrait tile.
      imageUrl: null,
      pubDate: item.dateTime ? new Date(item.dateTime) : new Date(),
      source,
    })).filter(a => a.title && a.link);
  } catch {
    return [];
  }
}

function dispatchFetch(source) {
  return source.type === 'tcgp' ? fetchTcgp(source) : fetchRss(source);
}

export async function fetchTCGNews() {
  const results = await Promise.allSettled(SOURCES.map(dispatchFetch));
  const articles = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  const seen = new Set();
  return articles
    .sort((a, b) => b.pubDate - a.pubDate)
    .filter(a => {
      if (seen.has(a.title)) return false;
      seen.add(a.title);
      return true;
    });
}
