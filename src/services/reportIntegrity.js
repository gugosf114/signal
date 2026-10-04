import { calculateOverallScore } from '../config/signals.js';
import { buildVerifiedSummary } from './citations.js';
import { alignmentFromHistory } from './priceHistory.js';
import { withCardRecord } from './cardRecord.js';

export const RESEARCH_TTL_MS = 7 * 86400000;
export function researchTime(data) {
  const dates = [data?._researchAt, data?._sharedCacheCreatedAt, data?._scannedAt]
    .map(value => Date.parse(value || '')).filter(Number.isFinite);
  return dates.length ? Math.min(...dates) : null;
}
export function syncReport(data, patch = null) {
  if (!data) return data;
  const prices = { ...(data.prices || {}), ...(patch || {}) };
  const score = calculateOverallScore(data.signals, data.game);
  prices.signal_vs_market = alignmentFromHistory(score, prices.history?.change30) || 'unknown';
  const result = withCardRecord({ ...data, prices, _signalScore: score }, data.card || data._pin || data.printing);
  result.summary = buildVerifiedSummary({ cardName: result.card_name, prices: result.prices, signals: result.signals });
  return result;
}
export function checkRow(key, label, data) {
  return { key, label, status: data?.status || (data ? 'ok' : 'unavailable'), checkedAt: data && Object.prototype.hasOwnProperty.call(data, 'checkedAt') ? data.checkedAt : new Date().toISOString() };
}
export function webChecks(content, checkedAt) {
  const calls = (content || []).filter(block => block.type === 'server_tool_use' && block.name === 'web_search');
  const results = new Map((content || []).filter(block => block.type === 'web_search_tool_result').map(block => [block.tool_use_id, block]));
  return [['english_web', 'English web search', false], ['japanese_web', 'Japanese web search', true]].map(([key, label, japanese]) => {
    const matching = calls.filter(call => /[\u3040-\u30ff\u3400-\u9fff]/u.test(String(call.input?.query || '')) === japanese);
    const returned = matching.map(call => results.get(call.id));
    const valid = returned.filter(result => Array.isArray(result?.content));
    const count = valid.reduce((n, result) => n + result.content.filter(item => item.type === 'web_search_result').length, 0);
    return { key, label, checkedAt, status: !matching.length ? 'not_checked' : valid.length < matching.length ? (valid.length ? 'partial' : 'unavailable') : count ? 'ok' : 'empty' };
  });
}
