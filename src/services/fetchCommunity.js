// ─── Reddit community sentiment ───────────────────────────────────────────────
// Direct, parallel pull from Reddit's public JSON (NO API key needed). Replaces
// the slow sequential LLM "search Reddit" step. Returns null on any failure so
// analyzeCard cleanly falls back to a web_search.
//
// 2026-09-06: Reddit answers 403 to every unauthenticated search.json call from
// a phone, with any User-Agent. The RSS search feed still answers a browser
// agent (a few calls a minute before 429). It carries title, link, date and
// author but no score or comment count, so those read "n/a" in the block.

import { fetchWithTimeout } from './http.js';

const BROWSER_UA = 'Mozilla/5.0 (Linux; Android 14; SM-F956U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';

function decode(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Reddit's Atom feed: one <entry> per post. Kept regex-based so it runs the
// same in the WebView and under node --test.
export function parseRedditFeed(xml, limit = 8) {
  const posts = [];
  for (const match of String(xml || '').matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const entry = match[1];
    const title = decode(entry.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]);
    const link = entry.match(/<link[^>]*href="([^"]+)"/)?.[1] || '';
    const updated = entry.match(/<updated>([^<]+)<\/updated>/)?.[1] || entry.match(/<published>([^<]+)<\/published>/)?.[1] || '';
    const author = decode(entry.match(/<name>([\s\S]*?)<\/name>/)?.[1]);
    const subreddit = link.match(/reddit\.com\/(r\/[^/]+)\//)?.[1] || '';
    if (!title || !/^https:\/\/(?:www\.)?reddit\.com\/r\/[^/]+\/comments\//.test(link)) continue;
    posts.push({
      title,
      subreddit,
      score: null,
      comments: null,
      date: updated ? updated.slice(0, 10) : null,
      author: author.replace(/^\/u\//, ''),
      url: link.replace(/^https:\/\/reddit\.com/, 'https://www.reddit.com'),
    });
    if (posts.length >= limit) break;
  }
  return posts;
}

async function fetchJson(q) {
  const url = `https://www.reddit.com/search.json?q=${q}&sort=relevance&t=month&limit=10&raw_json=1`;
  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': 'signal-tcg/1.0 (card market intelligence)' },
  }, 8000);
  if (!res.ok) return null;
  const json = await res.json();
  const children = json?.data?.children || [];
  return children
    .map((c) => c.data)
    .filter((p) => p && !p.over_18)
    .slice(0, 8)
    .map((p) => ({
      title: p.title,
      subreddit: p.subreddit_name_prefixed || `r/${p.subreddit}`,
      score: p.score,
      comments: p.num_comments,
      date: p.created_utc
        ? new Date(p.created_utc * 1000).toISOString().slice(0, 10)
        : null,
      url: `https://www.reddit.com${p.permalink}`,
    }));
}

async function fetchFeed(q) {
  const url = `https://www.reddit.com/search.rss?q=${q}&sort=relevance&t=month`;
  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/atom+xml, application/xml;q=0.9, */*;q=0.8' },
  }, 8000);
  if (!res.ok) return null;
  return parseRedditFeed(await res.text());
}

export async function fetchCommunity(cardName, game = null) {
  try {
    const gameTerm = { pokemon: 'Pokemon TCG', mtg: 'Magic card', yugioh: 'Yu-Gi-Oh card' }[game] || 'trading card';
    const q = encodeURIComponent(`"${cardName}" ${gameTerm}`);
    const posts = (await fetchJson(q).catch(() => null)) || (await fetchFeed(q).catch(() => null));
    return posts?.length ? { posts } : null;
  } catch {
    return null;
  }
}

export function communityBlock(data) {
  if (!data?.posts?.length) return null;
  const lines = [
    '=== REDDIT (pre-fetched, real posts — use for the `community` signal; do NOT re-search Reddit) ===',
  ];
  for (const p of data.posts) {
    const stats = p.score === null
      ? 'score n/a'
      : `${p.score} pts, ${p.comments} comments`;
    lines.push(
      `- [${p.subreddit}] ${p.title}  (${stats}${p.date ? ', ' + p.date : ''})  ${p.url}`
    );
  }
  return lines.join('\n');
}
