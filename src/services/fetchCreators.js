// ─── YouTube creator coverage ─────────────────────────────────────────────────
// Pulls real videos about the exact printing before the model runs. Two
// searches at most: the catalogue wording first, then the shorthand creators
// actually use ("Umbreon SIR Prismatic Evolutions"). Every video still has to
// pass the exact-print check in sourceRelevance.
//
// The key can be compiled in (VITE_YOUTUBE_API_KEY) or live on the gateway.

import { exactCreatorQuery, filterExactVideos, looseCreatorQuery } from './sourceRelevance.js';
import { searchYouTube } from './youtubeSearch.js';

export async function fetchCreators(cardName, game = null, pin = null, { signal, force = false } = {}) {
  const videos = [], seen = new Set();
  let succeeded = 0, failed = 0;
  const checkedTimes = [];
  if (!pin) return { videos, status: 'not_checked' };
  const queries = [exactCreatorQuery(cardName, game, pin), looseCreatorQuery(cardName, game, pin)];
  for (const q of queries) {
    try {
      const found = await searchYouTube({ q, order: 'relevance', maxResults: 6, force }, { signal });
      succeeded++;
      const checked = Date.parse(found.checkedAt || found[0]?.checkedAt || '');
      if (Number.isFinite(checked)) checkedTimes.push(checked);
      for (const video of filterExactVideos(found, cardName, pin)) {
        if (seen.has(video.url)) continue;
        seen.add(video.url); videos.push(video);
      }
    } catch (error) { if (signal?.aborted) throw error; failed++; }
    if (videos.length) break;
  }
  return { videos, checkedAt: new Date(checkedTimes.length ? Math.min(...checkedTimes) : Date.now()).toISOString(), status: failed ? (succeeded ? 'partial' : 'unavailable') : videos.length ? 'ok' : 'empty' };
}

export function creatorsBlock(data) {
  if (!data?.videos?.length) return null;
  const lines = [
    '=== YOUTUBE (pre-fetched, real videos — use for the `creator` signal; do NOT re-search YouTube) ===',
  ];
  for (const v of data.videos) {
    lines.push(
      `- ${v.channel}: ${v.title}${v.date ? ' (' + v.date + ')' : ''}  ${v.url}`
    );
  }
  return lines.join('\n');
}
