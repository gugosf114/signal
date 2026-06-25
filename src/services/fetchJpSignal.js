// ─── Japan signal ─────────────────────────────────────────────────────────────
// The wedge: what Japan is doing before the US price moves. Two parallel pulls:
//   1. JP creator hype  — YouTube Data API, region JP / language ja (uses the key
//      you already have). Reliable.
//   2. JP vs US interest — Google Trends (unofficial endpoint). Best-effort: if
//      Google blocks/rate-limits it, returns null and the scan is unaffected.
// Returns null only if BOTH fail.

async function jpHype(cardName) {
  const key = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!key) return null;
  try {
    const q = encodeURIComponent(cardName);
    const url =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
      `&order=date&maxResults=5&regionCode=JP&relevanceLanguage=ja&q=${q}&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = await res.json();
    const vids = (j.items || [])
      .filter((it) => it.id?.videoId)
      .map((it) => ({
        title: it.snippet?.title,
        channel: it.snippet?.channelTitle,
        date: it.snippet?.publishedAt ? it.snippet.publishedAt.slice(0, 10) : null,
        url: `https://www.youtube.com/watch?v=${it.id.videoId}`,
      }));
    return vids.length ? vids : null;
  } catch {
    return null;
  }
}

async function jpVsUsTrend(term) {
  try {
    const base = 'https://trends.google.com/trends/api';
    const time = 'today 3-m';
    const item = (geo) => ({ keyword: term, geo, time });
    const req = { comparisonItem: [item('JP'), item('US')], category: 0, property: '' };
    const r1 = await fetch(
      `${base}/explore?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(req))}`
    );
    if (!r1.ok) return null;
    const w = (JSON.parse((await r1.text()).replace(/^\)\]\}',?\s*/, '')).widgets || [])
      .find((x) => x.id === 'TIMESERIES');
    if (!w) return null;
    const r2 = await fetch(
      `${base}/widgetdata/multiline?hl=en-US&tz=0&req=${encodeURIComponent(
        JSON.stringify(w.request)
      )}&token=${encodeURIComponent(w.token)}`
    );
    if (!r2.ok) return null;
    const tl = JSON.parse((await r2.text()).replace(/^\)\]\}',?\s*/, '')).default?.timelineData || [];
    if (tl.length < 6) return null;
    const recent = tl.slice(-3);
    const prior = tl.slice(0, 3);
    const avg = (arr, i) => Math.round(arr.reduce((s, p) => s + (p.value?.[i] || 0), 0) / arr.length);
    return {
      jpNow: avg(recent, 0), jpPrev: avg(prior, 0),
      usNow: avg(recent, 1), usPrev: avg(prior, 1),
    };
  } catch {
    return null;
  }
}

export async function fetchJpSignal(cardName) {
  const [jpVideos, trend] = await Promise.all([
    jpHype(cardName).catch(() => null),
    jpVsUsTrend(cardName).catch(() => null),
  ]);
  if (!jpVideos && !trend) return null;
  return { jpVideos, trend };
}

export function jpBlock(data) {
  if (!data) return null;
  const lines = ['=== JAPAN SIGNAL (pre-fetched — use for jp_hype; the JP-vs-US gap is the lead indicator) ==='];
  if (data.trend) {
    const t = data.trend;
    const dir = (n, p) => (n > p + 5 ? '▲ rising' : n < p - 5 ? '▼ falling' : 'flat');
    lines.push(
      `Search interest (Google Trends, recent vs 3mo-start): JP ${t.jpNow} (was ${t.jpPrev}, ${dir(t.jpNow, t.jpPrev)}) | US ${t.usNow} (was ${t.usPrev}, ${dir(t.usNow, t.usPrev)}). ` +
      (t.jpNow - t.jpPrev > t.usNow - t.usPrev + 5
        ? 'JP demand is rising FASTER than US — classic lead signal.'
        : 'JP not clearly leading US right now.')
    );
  }
  if (data.jpVideos?.length) {
    lines.push('Recent JP YouTube:');
    for (const v of data.jpVideos)
      lines.push(`- ${v.channel}: ${v.title}${v.date ? ' (' + v.date + ')' : ''}  ${v.url}`);
  }
  return lines.join('\n');
}
