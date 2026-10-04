import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickHistorySku, alignmentFromHistory } from './priceHistory.js';
import { currentEvidence, sameStory, supportedExcerpt } from './evidencePolicy.js';
import { calculateOverallScore, sourceDirection } from '../config/signals.js';
import { researchTime, webChecks, syncReport } from './reportIntegrity.js';
import { lockSourcesToEvidence, fillEvidenceGaps, collectPrefetchEvidence, classifyEvidenceArea } from './citations.js';

const today = new Date().toISOString();
const source = { type: 'editorial', title: 'Meowth gets a detailed review of its new illustration', date: today, url: 'https://example.com/meowth-review' };
const context = { cardName: 'Meowth', pin: { game: 'pokemon', name: 'Meowth', setName: '30th Celebration', number: '144', printedTotal: '128' } };
const assessed = implication => ({ ...source, implication, support: source.title, directionAssessed: true });

test('history never borrows another language, condition or finish', () => {
  const sku = { language: 'English', condition: 'Near Mint', variant: 'Holofoil', buckets: [{}] };
  const pin = { game: 'pokemon', form: 'holo' };
  assert.equal(pickHistorySku([sku], pin), sku);
  for (const change of [{ language: 'Japanese' }, { language: '' }, { condition: 'Lightly Played' }, { variant: 'Reverse Holofoil' }]) {
    assert.equal(pickHistorySku([{ ...sku, ...change }], pin), null);
  }
  assert.equal(pickHistorySku([{ ...sku, variant: '1st Edition' }], { game: 'yugioh' }), null);
});

test('neutral sources dilute direction and missing evidence has no score', () => {
  assert.equal(sourceDirection([assessed('up'), assessed('neutral'), assessed('neutral')]), 1 / 3);
  assert.equal(sourceDirection([{ ...source, implication: 'up' }]), 0);
  assert.equal(calculateOverallScore([], 'pokemon'), null);
  assert.equal(calculateOverallScore([{ key: 'creator', level: 4, strengthAssessed: true, sources: [assessed('neutral')] }], 'pokemon'), 50);
  assert.equal(alignmentFromHistory(null, -20), null);
});

test('AI assessment requires a real supporting excerpt and a current source', () => {
  assert.equal(supportedExcerpt({ support: source.title }, source), source.title);
  assert.equal(supportedExcerpt({ support: 'This card is guaranteed to rise tomorrow' }, source), null);
  assert.equal(currentEvidence({ date: '2000-01-01' }, 'creator'), false);
  const make = support => ({ signals: [{ key: 'editorial', level: 4, sources: [{ url: source.url, implication: 'up', support }] }] });
  const registry = new Map([[source.url, source]]);
  assert.equal(lockSourcesToEvidence(make('fake'), registry, context).signals[0].strengthAssessed, false);
  assert.equal(lockSourcesToEvidence(make(source.title), registry, context).signals[0].strengthAssessed, true);
});

test('additional useful links survive while repeated stories do not count twice', () => {
  const other = { ...source, title: 'Meowth illustration artist interview and card design discussion', url: 'https://example.org/interview' };
  const copy = { ...source, url: 'https://copy.example/news' };
  assert.equal(sameStory(source, copy), true);
  const result = fillEvidenceGaps({ signals: [{ key: 'editorial', level: 0, sources: [] }] }, new Map([source, other, copy].map(row => [row.url, row])), context);
  assert.equal(result.signals[0].sources.length, 2);
  assert.equal(result.signals[0].strengthAssessed, false);
});

test('English launch news cannot claim a Japanese release', () => {
  assert.equal(classifyEvidenceArea({ ...source, title: '30th Celebration English release date announced' }), 'editorial');
});

test('structured facts are citable neutral context', () => {
  const fact = { ...source, area: 'competitive', factScope: 'card', summary: 'Legal in Standard. This does not measure demand.' };
  const registry = collectPrefetchEvidence({ catalysts: { evidence: [fact] } });
  const result = fillEvidenceGaps({ signals: [{ key: 'competitive', sources: [] }] }, registry, context);
  assert.equal(result.signals[0].sources[0].summary, fact.summary);
  assert.equal(result.signals[0].sources[0].directionAssessed, false);
});

test('saving an old shared report does not make the research newer', () => {
  const then = '2026-09-01T00:00:00Z';
  assert.equal(researchTime({ _sharedCacheCreatedAt: then, _scannedAt: today }), Date.parse(then));
});

test('web status distinguishes no search, a failed search, and an empty search', () => {
  const call = { type: 'server_tool_use', name: 'web_search', id: 'en', input: { query: 'Meowth review' } };
  assert.equal(webChecks([], today)[0].status, 'not_checked');
  assert.equal(webChecks([call], today)[0].status, 'unavailable');
  assert.equal(webChecks([call, { type: 'web_search_tool_result', tool_use_id: 'en', content: [] }], today)[0].status, 'empty');
});

test('summary and alignment rebuild from the current prices, never model claims', () => {
  const data = { game: 'pokemon', card_name: 'Meowth', signals: [], prices: { en_price: '$10.00', signal_vs_market: 'agree' }, summary: 'Old price is $999.' };
  const result = syncReport(data, { en_price: '$20.00', history: null });
  assert.equal(result.prices.signal_vs_market, 'unknown');
  assert.doesNotMatch(result.summary, /999/);
  assert.match(result.summary, /20/);
});
