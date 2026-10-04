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
        checkedAt: item.checkedAt || null,
        title: snippet?.title || '',
        description: snippet?.description || '',
        channel: snippet?.channelTitle || snippet?.channel || '',
        ...((snippet?.defaultAudioLanguage || snippet?.defaultLanguage || snippet?.language) ? { language: snippet.defaultAudioLanguage || snippet.defaultLanguage || snippet.language } : {}),
        date: (snippet?.publishedAt || snippet?.date || '').slice(0, 10) || null,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    })
    .filter(Boolean);
}

export async function searchYouTube({ q, regionCode = '', relevanceLanguage = '', order = 'relevance', maxResults = 6, force = false }, { signal } = {}) {
  const key = clientKey();
  const publishedAfter = new Date(Date.now() - 7 * 86400000).toISOString();
  if (key) {
    const params = new URLSearchParams({ part: 'snippet', type: 'video', order, maxResults: String(maxResults), q, key, publishedAfter });
    if (regionCode) params.set('regionCode', regionCode);
    if (relevanceLanguage) params.set('relevanceLanguage', relevanceLanguage);
    const res = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal }, 8000);
    if (!res.ok) throw new Error(`YouTube ${res.status}`);
    const items = shapeYouTubeItems((await res.json())?.items);
    items.checkedAt = new Date().toISOString();
    return items.map(video => ({ ...video, checkedAt: items.checkedAt }));
  }
  const fetched = await youtubeSearchViaGateway({ q, regionCode, relevanceLanguage, order, maxResults, publishedAfter, force }, signal);
  const items = shapeYouTubeItems(fetched);
  items.checkedAt = fetched.checkedAt;
  return items;
}
