import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizedEvidenceText, isJapaneseSource, matchesJapanesePrinting } from './japaneseEvidence.js';
import { collectPrefetchEvidence, lockSourcesToEvidence } from './citations.js';
import { enforceExactCreatorSources } from './sourceRelevance.js';
const pin = { game: 'pokemon', name: 'Meowth', number: '144', printedTotal: '128', setName: '30th Celebration', japaneseIdentity: { aliases: ['ニャース'], scope: 'name' } };
const english = { title: 'Meowth 144/128 30th Celebration', description: 'Pokemon card', channel: 'English channel', url: 'https://www.youtube.com/watch?v=abcdefghijk' };

test('Japanese characters and voiced syllables survive normalization', () => {
  assert.equal(normalizedEvidenceText('ブラッキー Pokémon'), 'ブラッキー pokemon');
});
test('JP region alone and an English audio track do not prove Japanese-language content', () => {
  assert.equal(isJapaneseSource({ ...english, regionCode: 'JP' }), false);
  assert.equal(isJapaneseSource({ title: 'ニャース 144/128', language: 'en' }), false);
  assert.equal(isJapaneseSource({ ...english, language: 'ja' }), true);
});
test('Japanese card names match exact numbers, not unrelated regional cards or near numbers', () => {
  assert.equal(matchesJapanesePrinting({ title: '【ポケカ】ニャース144/128を紹介' }, 'Meowth', pin), true);
  assert.equal(matchesJapanesePrinting({ title: 'ニャース1144/1280 ポケカ' }, 'Meowth', pin), false);
  assert.equal(matchesJapanesePrinting({ title: 'アローラ ニャース144/128 ポケカ' }, 'Meowth', pin), false);
  assert.equal(matchesJapanesePrinting({ title: 'ニャース AR 別のカード' }, 'Meowth', pin), false);
});
test('Japan search cannot overwrite an English video category', () => {
  const registry = collectPrefetchEvidence({ creators: { videos: [english] }, jp: { jpVideos: [english] } });
  assert.equal([...registry.values()][0].area, 'creator');
  const report = lockSourcesToEvidence({ signals: [{ key: 'jp_hype', level: 4, sources: [{ url: english.url }] }, { key: 'creator', level: 0, sources: [] }] }, registry, { cardName: 'Meowth', pin });
  assert.equal(report.signals[0].sources.length, 0);
  assert.equal(report.signals[1].sources.length, 1);
  assert.equal(report.signals[1].level, 0);
  assert.equal(report._sourceAudit[0].reason, 'wrong_area');
  assert.equal(report._sourceAudit[0].action, 'reassigned');
});
test('each rejected proposal keeps its real reason', () => {
  const report = lockSourcesToEvidence({ signals: [{ key: 'creator', sources: [{ url: 'https://example.com/missing' }] }] }, new Map(), { cardName: 'Meowth', pin });
  assert.equal(report._sourceAudit[0].reason, 'not_retrieved');
});
test('saved false-Japan clips are recovered in Creator without being counted twice', () => {
  const report = enforceExactCreatorSources({ _evidenceVersion: 1, signals: [{ key: 'jp_hype', level: 4, sources: [{ ...english, type: 'youtube' }] }, { key: 'creator', level: 0, sources: [] }] }, { cardName: 'Meowth', pin });
  assert.equal(report.signals[0].sources.length, 0);assert.equal(report.signals[0].level, 0);
  assert.equal(report.signals[1].sources.length, 1);
});
