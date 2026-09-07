// ─── YouTube creator coverage ─────────────────────────────────────────────────
// Pulls real videos about the exact printing before the model runs. Two
// searches at most: the catalogue wording first, then the shorthand creators
// actually use ("Umbreon SIR Prismatic Evolutions"). Every video still has to
// pass the exact-print check in sourceRelevance.
//
// The key can be compiled in (VITE_YOUTUBE_API_KEY) or live on the gateway.

import { exactCreatorQuery, filterExactVideos, looseCreatorQuery } from './sourceRelevance.js';
import { searchYouTube } from './youtubeSearch.js';

export async function fetchCreators(cardName, game = null, pin = null) {
  if (!pin) return null;
  try {
    const seen = new Set();
    const videos = [];
    const queries = [exactCreatorQuery(cardName, game, pin), looseCreatorQuery(cardName, game, pin)];
    for (const q of queries) {
      const found = await searchYouTube({ q, order: 'relevance', maxResults: 6 }).catch(() => []);
      for (const video of filterExactVideos(found, cardName, pin)) {
        if (seen.has(video.url)) continue;
        seen.add(video.url);
        videos.push(video);
      }
      if (videos.length) break;
    }
    return videos.length ? { videos } : null;
  } catch {
    return null;
  }
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
