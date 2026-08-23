// ─── TCG News Feed ────────────────────────────────────────────────────────────
// Aggregates current TCG articles from a mix of sources:
//   - TCGplayer Infinite (JSON API, used for Pokemon)
//   - WordPress REST API  (used for YGO and both MTG sources)
//
// EVERY tile needs a picture. That is the whole reason the source list looks
// the way it does. Measured 2026-08-23 against the live feeds:
//
//   TCGplayer Infinite  — the articles response already carries `imageURL`.
//                         An earlier version threw it away and set null. It is
//                         a wide marketing banner, so this source prefers the
//                         real card when the headline names one.
//   WordPress REST      — `?_embed=wp:featuredmedia` returns the article's
//                         featured image, and both hosts below reflect the
//                         request Origin, so the browser calls them directly
//                         with no proxy.
//   rss2json            — kept for any future feed, but no source uses it now.
//                         MTGGoldfish was dropped on 2026-08-23: it returns no
//                         thumbnail, no enclosure and no body <img> on any item,
//                         and its headlines are column names ("Single Scoop",
//                         "Much Abrew") rather than cards, so nothing downstream
//                         could recover a picture for it. MTG Rocks and Draftsim
//                         replace it and both publish card art as the featured
//                         image.
//
// CORS, all verified by response header, not by assumption:
//   infinite-api.tcgplayer.com  reflects Origin
//   ygorganization.com          reflects Origin
//   mtgrocks.com                reflects Origin
//   draftsim.com                reflects Origin
//
// Pokemon RSS sources (PkmnCards, SixPrizes) were retired here because their
// feeds went dormant — PkmnCards stopped publishing in 2012, SixPrizes paused
// in November 2020. TCGplayer Infinite ships current Pokemon articles daily.

import { fetchWithTimeout } from './http.js';

const SOURCES = [
  {
    id: 'tcgp-pokemon',
    label: 'TCGplayer',
    color: '#C9692E',
    game: 'pokemon',
    type: 'tcgp',
    vertical: 'pokemon',
    rows: 4,
    // TCGplayer's own image is a wide marketing banner. When the headline
    // names a deck — "Alakazam Deck Guide" — the real card beats the banner.
    prefer: 'card',
  },
  {
    id: 'mtgrocks',
    label: 'MTG Rocks',
    color: '#FFB74D',
    game: 'mtg',
    type: 'wp',
    base: 'https://mtgrocks.com',
    count: 2,
    prefer: 'source',
  },
  {
    id: 'draftsim',
    label: 'Draftsim',
    color: '#7FB6D8',
    game: 'mtg',
    type: 'wp',
    base: 'https://draftsim.com',
    count: 2,
    prefer: 'source',
  },
  {
    id: 'ygorganization',
    label: 'YGOrganization',
    color: '#B58F18',
    game: 'yugioh',
    type: 'wp',
    base: 'https://ygorganization.com',
    count: 3,
    // YGOrganization reports cards before release, so the database has no art
    // for them — but the article's own featured image IS the card. Trust it
    // over a lookup that is guaranteed to miss.
    prefer: 'source',
  },
];

const RSS2JSON = 'https://api.rss2json.com/v1/api.json';
const TCGP_API = 'https://infinite-api.tcgplayer.com/c/articles/';

// ─── Text helpers ────────────────────────────────────────────────────────────
// WordPress hands back HTML-escaped titles — "&#8220;Arthenée&#8221;" — and
// the strip prints them raw. Decoding has to work in Node too (the tests run
// without a DOM), so this is a plain string pass rather than a textarea trick.
const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', eacute: 'é', egrave: 'è', uuml: 'ü',
  times: '×', deg: '°', trade: '™', reg: '®', copy: '©',
};

export function decodeEntities(input) {
  if (!input) return '';
  return String(input)
    .replace(/&#(\d+);/g, (_, d) => {
      const code = Number(d);
      return Number.isFinite(code) && code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : '';
    })
    .replace(/&([a-z]+);/gi, (whole, name) => {
      const hit = NAMED_ENTITIES[name.toLowerCase()];
      return hit === undefined ? whole : hit;
    });
}

export function stripHtml(input, limit = 120) {
  return decodeEntities(String(input || '').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

// WordPress ships several renditions of the featured image. Prefer one that is
// big enough not to look soft in a 178px-wide tile, but not the multi-megabyte
// original. Falls through to whatever exists.
export function pickWpImage(post) {
  const media = post?._embedded?.['wp:featuredmedia'];
  const first = Array.isArray(media) ? media.find((m) => m && !m.code) : null;
  if (!first) return null;
  const sizes = first.media_details?.sizes || {};
  for (const key of ['medium_large', 'large', 'post-feature', 'medium', 'full']) {
    const url = sizes[key]?.source_url;
    if (url) return url;
  }
  return first.source_url || null;
}

// ─── Fetchers ────────────────────────────────────────────────────────────────
async function fetchWp(source) {
  try {
    const count = source.count || 3;
    // _fields is deliberately NOT used here: pairing it with _embed silently
    // drops _embedded from the response, which costs the image.
    const url = `${source.base}/wp-json/wp/v2/posts?per_page=${count}&_embed=${encodeURIComponent('wp:featuredmedia')}`;
    const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 7000);
    if (!res.ok) return [];
    const posts = await res.json();
    if (!Array.isArray(posts)) return [];

    return posts.map((post) => ({
      id: post.link || String(post.id),
      title: decodeEntities(post.title?.rendered || '').trim(),
      link: post.link || '',
      description: stripHtml(post.excerpt?.rendered || ''),
      imageUrl: pickWpImage(post),
      pubDate: post.date_gmt ? new Date(`${post.date_gmt}Z`) : (post.date ? new Date(post.date) : new Date()),
      source,
    })).filter((a) => a.title && a.link);
  } catch {
    return [];
  }
}

async function fetchRss(source) {
  try {
    const key = typeof import.meta !== 'undefined'
      ? import.meta.env?.VITE_RSS2JSON_KEY
      : null;
    const keyParam = key ? `&api_key=${key}&count=10` : '';
    const url = `${RSS2JSON}?rss_url=${encodeURIComponent(source.rss)}${keyParam}`;

    const res = await fetchWithTimeout(url, {}, 7000);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== 'ok' || !Array.isArray(data.items)) return [];

    return data.items.slice(0, source.count || 2).map((item) => {
      // Image priority: rss2json thumbnail → enclosure → first <img> in body.
      // All three come back empty for MTGGoldfish today; the chain stays because
      // it costs nothing and a feed can start shipping images at any time.
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
        title: decodeEntities((item.title || '').trim()),
        link: item.link || '',
        description: stripHtml(item.description || item.content || ''),
        imageUrl,
        pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
        source,
      };
    }).filter((a) => a.title && a.link);
  } catch {
    return [];
  }
}

async function fetchTcgp(source) {
  try {
    const rows = source.rows || 4;
    const url = `${TCGP_API}?source=infinite-content&contentType=Article&verticals=${encodeURIComponent(source.vertical)}&rows=${rows}`;
    const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 7000);
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data?.result) ? data.result : [];
    return items.slice(0, rows).map((item) => ({
      id: item.uuid || item.canonicalURL,
      title: decodeEntities((item.title || '').trim()),
      link: item.canonicalURL ? `https://infinite.tcgplayer.com${item.canonicalURL}` : '',
      description: stripHtml(item.teaser || ''),
      // These are wide OpenGraph banners, not portrait cards. The tile handles
      // that by measuring the loaded image and switching to cover — see
      // NewsStrip. Dropping the URL to dodge letterboxing left every Pokemon
      // tile showing the four-letter placeholder instead.
      imageUrl: item.imageURL || item.overlayImageURL || null,
      pubDate: item.dateTime ? new Date(item.dateTime) : new Date(),
      source,
    })).filter((a) => a.title && a.link);
  } catch {
    return [];
  }
}

function dispatchFetch(source) {
  if (source.type === 'tcgp') return fetchTcgp(source);
  if (source.type === 'wp') return fetchWp(source);
  return fetchRss(source);
}

export async function fetchTCGNews() {
  const results = await Promise.allSettled(SOURCES.map(dispatchFetch));
  const articles = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  const seen = new Set();
  return articles
    .filter((a) => a.pubDate instanceof Date && !Number.isNaN(a.pubDate.getTime()))
    .sort((a, b) => b.pubDate - a.pubDate)
    .filter((a) => {
      if (seen.has(a.title)) return false;
      seen.add(a.title);
      return true;
    });
}

export const __TEST__ = { SOURCES };
