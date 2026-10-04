// ─── Japan signal ─────────────────────────────────────────────────────────────
// The wedge: what Japan is doing before the US price moves. Two parallel pulls:
//   1. JP creator hype  — YouTube search restricted to region JP / language ja,
//      through the compiled-in key or the gateway. Same exact-print check as
//      the English lane, same two-query fallback.
//   2. JP vs US interest — Google Trends (unofficial endpoint). Best-effort:
//      Google answers 429 from most phones; when it does the scan is unaffected.
// Returns null only if BOTH fail.

import { fetchWithTimeout } from './http.js';
import { sourceMatchesExactPrinting } from './sourceRelevance.js';
import { resolveJapaneseIdentity } from './japaneseIdentity.js';
import { isJapaneseSource } from './japaneseEvidence.js';
import { searchYouTube } from './youtubeSearch.js';

async function jpHype(cardName, pin, identity, signal) {
  const alias = identity.aliases[0] || cardName;
  const number = identity.printingCodes[0] || (pin.printedTotal ? `${pin.number}/${pin.printedTotal}` : pin.number) || '';
  const gameWord = pin.game === 'pokemon' ? 'ポケカ' : pin.game === 'yugioh' ? '遊戯王' : 'MTG';
  const queries = [...new Set([`${alias} ${number} ${gameWord}`, `${alias} ${identity.setNames[0] || pin.setName || ''} ${gameWord}`])];
  const videos = [], diagnostics = [], seen = new Set();
  for (const q of queries) {
    try {
      const found = await searchYouTube({ q, order: 'date', maxResults: 8, regionCode: 'JP', relevanceLanguage: 'ja' }, { signal });
      const rejected = [];
      for (const video of found) {
        if (!isJapaneseSource(video)) { rejected.push({ url: video.url, title: video.title, reason: 'japanese_language_unverified' }); continue; }
        if (!sourceMatchesExactPrinting(video, cardName, { ...pin, japaneseIdentity: identity })) { rejected.push({ url: video.url, title: video.title, reason: 'printing_mismatch' }); continue; }
        if (!seen.has(video.url)) { seen.add(video.url); videos.push(video); }
      }
      diagnostics.push({ query: q, returned: found.length, rejected });
    } catch (error) { if (signal?.aborted) throw error; diagnostics.push({ query: q, error: error.message }); }
    if (videos.length) break;
  }
  return { videos, diagnostics };
}

async function jpVsUsTrend(term, japaneseTerm = term) {
  try {
    const base = 'https://trends.google.com/trends/api';
    const time = 'today 3-m';
    const item = (geo) => ({ keyword: geo === 'JP' ? japaneseTerm : term, geo, time });
    const req = { comparisonItem: [item('JP'), item('US')], category: 0, property: '' };
    const r1 = await fetchWithTimeout(
      `${base}/explore?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(req))}`
    , {}, 8000);
    if (!r1.ok) return null;
    const w = (JSON.parse((await r1.text()).replace(/^\)\]\}',?\s*/, '')).widgets || [])
      .find((x) => x.id === 'TIMESERIES');
    if (!w) return null;
    const r2 = await fetchWithTimeout(
      `${base}/widgetdata/multiline?hl=en-US&tz=0&req=${encodeURIComponent(
        JSON.stringify(w.request)
      )}&token=${encodeURIComponent(w.token)}`
    , {}, 8000);
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

export async function fetchJpSignal(cardName, pin = null, { signal } = {}) {
  if (!pin) return null;
  const identity = await resolveJapaneseIdentity(cardName, pin, { signal });
  const [hype, trend] = await Promise.all([
    jpHype(cardName, pin, identity, signal),
    jpVsUsTrend(cardName, identity.aliases[0] || cardName).catch(() => null),
  ]);
  return { jpVideos: hype.videos, trend, identity, diagnostics: hype.diagnostics };
}

export function jpBlock(data) {
  if (!data) return null;
  const lines = ['=== JAPAN EVIDENCE (retrieved Japanese-language sources) ==='];
  if (data.identity?.aliases?.length) lines.push(`Verified Japanese name: ${data.identity.aliases.join(' / ')}. Mapping scope: ${data.identity.scope}.`);
  if (data.identity?.scope !== 'printing') lines.push('A Japanese printing counterpart is not established. Do not invent Japanese set names, numbers, prices or release dates.');
  for (const record of data.identity?.releaseEvidence || []) lines.push(`${record.summary} ${record.url}`);
  if (!data.trend) lines.push('Google Trends data is unavailable. No measured Japan-versus-US lead can be claimed.');
  if (data.trend) {
    const t = data.trend;
    const dir = (n, p) => (n > p + 5 ? '▲ rising' : n < p - 5 ? '▼ falling' : 'flat');
    lines.push(
      `Search interest (Google Trends, recent vs 3mo-start): JP ${t.jpNow} (was ${t.jpPrev}, ${dir(t.jpNow, t.jpPrev)}) | US ${t.usNow} (was ${t.usPrev}, ${dir(t.usNow, t.usPrev)}). ` +
      (t.jpNow - t.jpPrev > t.usNow - t.usPrev + 5
        ? 'JP search interest rose faster than US search interest in this sample.'
        : 'JP search interest did not clearly rise faster than US in this sample.')
    );
  }
  if (data.jpVideos?.length) {
    lines.push('Retrieved videos with Japanese-language evidence and a matching printing:');
    for (const v of data.jpVideos)
      lines.push(`- ${v.channel}: ${v.title}${v.date ? ' (' + v.date + ')' : ''}  ${v.url}`);
  }
  return lines.join('\n');
}
