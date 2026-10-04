import { normalizedEvidenceText } from './japaneseEvidence.js';

export const AREA_MAX_AGE_DAYS = { creator: 7, community: 30, ip_momentum: 90, editorial: 30, jp_hype: 7, competitive: 30, scarcity: 90, jp_release: 90 };
export function currentEvidence(source, area, now = Date.now()) {
  const date = Date.parse(source?.date || '');
  const days = AREA_MAX_AGE_DAYS[area];
  return Number.isFinite(date) && date <= now && now - date <= days * 86400000;
}
// Only text actually returned by the retriever can support an AI assessment.
// This proves the excerpt exists, not that the interpretation predicts a price.
export function supportedExcerpt(proposed, evidence) {
  const quote = String(proposed?.support || '').trim().slice(0, 500);
  const needle = normalizedEvidenceText(quote);
  if (needle.length < 16) return null;
  for (const field of [evidence?.summary, evidence?.title]) {
    if (normalizedEvidenceText(field).includes(needle)) return quote;
  }
  return null;
}
export function sameStory(a, b) {
  if (a.url === b.url) return true;
  if (['youtube', 'reddit', 'twitter'].includes(a.type) || ['youtube', 'reddit', 'twitter'].includes(b.type)) return false;
  const left = normalizedEvidenceText(a.title), right = normalizedEvidenceText(b.title);
  if (left.length < 30 || right.length < 30) return false;
  if (left === right) return true;
  const x = new Set(left.split(' ')), y = new Set(right.split(' '));
  if (x.size < 7 || y.size < 7) return false;
  const intersection = [...x].filter(word => y.has(word)).length;
  return intersection / new Set([...x, ...y]).size >= 0.9;
}
export function publisherCount(sources) {
  return new Set((sources || []).map(source => {
    try { return new URL(source.url).hostname.replace(/^www\./, ''); } catch { return null; }
  }).filter(Boolean)).size;
}
