// ─── TCG News Feed ────────────────────────────────────────────────────────────
// Fetches articles from major TCG news sources via their public RSS feeds.
// Uses allorigins.win as a CORS proxy — no API key, no rate limit.
// Returns a unified article array sorted by publish date desc.

// Verified working with rss2json.com anonymous tier (no count param)
const SOURCES = [
  {
    id: 'pkmncards',
    label: 'PkmnCards',
    color: '#FFCB05',
    game: 'pokemon',
    rss: 'https://pkmncards.com/feed/',
  },
  {
    id: 'mtggoldfish',
    label: 'MTGGoldfish',
    color: '#FFB74D',
    game: 'mtg',
    rss: 'https://www.mtggoldfish.com/feed',
  },
  {
    id: 'ygorganization',
    label: 'YGOrganization',
    color: '#B58F18',
    game: 'yugioh',
    rss: 'https://ygorganization.com/feed/',
  },
];

// rss2json.com converts RSS to clean JSON with thumbnail extraction.
// Free anonymous tier: works, no key required (may rate-limit at high volume).
// Add VITE_RSS2JSON_KEY to .env.local for 10k req/day: https://rss2json.com
const RSS2JSON = 'https://api.rss2json.com/v1/api.json';

async function fetchSource(source) {
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

    return data.items.map((item) => {
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
          // Skip tracking pixels, avatars, icons (< 100px usually in URL hints)
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

export async function fetchTCGNews() {
  const results = await Promise.allSettled(SOURCES.map(fetchSource));
  const articles = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  // Sort newest first, dedupe by title
  const seen = new Set();
  return articles
    .sort((a, b) => b.pubDate - a.pubDate)
    .filter(a => {
      if (seen.has(a.title)) return false;
      seen.add(a.title);
      return true;
    });
}
