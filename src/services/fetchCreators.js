// ─── YouTube creator coverage ─────────────────────────────────────────────────
// Direct pull via YouTube Data API v3 (needs VITE_YOUTUBE_API_KEY — free quota).
// Replaces the LLM "search YouTube" step. No key -> returns null and analyzeCard
// falls back to a web_search for creators.

export async function fetchCreators(cardName, game = null) {
  const key = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!key) return null;
  try {
    const q = encodeURIComponent(`${cardName} ${game || 'tcg'} card`.trim());
    const url =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
      `&order=relevance&maxResults=6&q=${q}&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const items = json?.items || [];
    const videos = items
      .filter((it) => it.id?.videoId)
      .map((it) => ({
        title: it.snippet?.title,
        channel: it.snippet?.channelTitle,
        date: it.snippet?.publishedAt ? it.snippet.publishedAt.slice(0, 10) : null,
        url: `https://www.youtube.com/watch?v=${it.id.videoId}`,
      }));
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
