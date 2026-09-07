// One YouTube search, two doors. A build that carries VITE_YOUTUBE_API_KEY
// asks Google directly; every other build asks the Signal gateway, which holds
// the key and caches answers. Both return the same small video shape.
import { fetchWithTimeout } from './http.js';
import { youtubeSearchViaGateway } from './signalGateway.js';

function clientKey() {
  try {
    return import.meta.env?.VITE_YOUTUBE_API_KEY || '';
  } catch {
    return '';
  }
}

export function shapeYouTubeItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const videoId = item?.videoId || item?.id?.videoId;
      if (!videoId) return null;
      const snippet = item?.snippet || item;
      return {
        title: snippet?.title || '',
        description: snippet?.description || '',
        channel: snippet?.channelTitle || snippet?.channel || '',
        date: (snippet?.publishedAt || snippet?.date || '').slice(0, 10) || null,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    })
    .filter(Boolean);
}

export async function searchYouTube({ q, regionCode = '', relevanceLanguage = '', order = 'relevance', maxResults = 6 }, { signal } = {}) {
  const key = clientKey();
  if (key) {
    const params = new URLSearchParams({ part: 'snippet', type: 'video', order, maxResults: String(maxResults), q, key });
    if (regionCode) params.set('regionCode', regionCode);
    if (relevanceLanguage) params.set('relevanceLanguage', relevanceLanguage);
    const res = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal }, 8000);
    if (!res.ok) throw new Error(`YouTube ${res.status}`);
    return shapeYouTubeItems((await res.json())?.items);
  }
  return shapeYouTubeItems(await youtubeSearchViaGateway({ q, regionCode, relevanceLanguage, order, maxResults }, signal));
}
