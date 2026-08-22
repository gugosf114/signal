// ─── Reddit community sentiment ───────────────────────────────────────────────
// Direct, parallel pull from Reddit's public JSON (NO API key needed). Replaces
// the slow sequential LLM "search Reddit" step. Returns null on any failure so
// analyzeCard cleanly falls back to a web_search.

import { fetchWithTimeout } from './http.js';

export async function fetchCommunity(cardName, game = null) {
  try {
    const gameTerm = { pokemon: 'Pokemon TCG', mtg: 'Magic card', yugioh: 'Yu-Gi-Oh card' }[game] || 'trading card';
    const q = encodeURIComponent(`"${cardName}" ${gameTerm}`);
    const url = `https://www.reddit.com/search.json?q=${q}&sort=relevance&t=month&limit=10&raw_json=1`;
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'signal-tcg/1.0 (card market intelligence)' },
    }, 8000);
    if (!res.ok) return null;
    const json = await res.json();
    const children = json?.data?.children || [];
    const posts = children
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
    return posts.length ? { posts } : null;
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
    lines.push(
      `- [${p.subreddit}] ${p.title}  (${p.score} pts, ${p.comments} comments${p.date ? ', ' + p.date : ''})  ${p.url}`
    );
  }
  return lines.join('\n');
}
