// Tests for the truncated-response recovery path.
//
// When the model runs out of output budget mid-JSON, the difference between
// "show the user 8 of 9 signals with a PARTIAL chip" and "scan failed" is
// entirely this file. It also has to know when NOT to try — emitting
// almost-valid JSON is worse than admitting defeat.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { repairTruncatedJson, extractJsonObject, tryParseSignalJSON } from './jsonRepair.js';

describe('repairTruncatedJson', () => {
  test('leaves balanced JSON untouched', () => {
    const s = '{"a":[1,2],"b":{"c":3}}';
    assert.equal(repairTruncatedJson(s), s);
  });

  test('rebalances a response cut off mid-array', () => {
    const cut = '{"card_name":"Umbreon ex","signals":[{"key":"creator","level":4},{"key":"comm';
    const repaired = repairTruncatedJson(cut);
    const parsed = JSON.parse(repaired);
    assert.equal(parsed.signals.length, 1);
    assert.equal(parsed.card_name, 'Umbreon ex');
  });

  test('returns null rather than emitting guaranteed-broken JSON', () => {
    // No complete member ever closed, so there is no safe truncation point.
    assert.equal(repairTruncatedJson('{"card_name":"Umbre'), null);
  });

  test('is not fooled by braces inside string values', () => {
    const cut = '{"summary":"a {weird} value","signals":[{"key":"creator"},{"key":"x';
    const parsed = JSON.parse(repairTruncatedJson(cut));
    assert.equal(parsed.summary, 'a {weird} value');
    assert.equal(parsed.signals.length, 1);
  });

  test('is not fooled by escaped quotes', () => {
    const cut = '{"summary":"he said \\"hi\\" loudly","signals":[{"key":"creator"},{"k';
    const parsed = JSON.parse(repairTruncatedJson(cut));
    assert.equal(parsed.summary, 'he said "hi" loudly');
  });
});

describe('extractJsonObject', () => {
  test('finds the object inside surrounding prose', () => {
    const out = extractJsonObject('Here you go:\n{"card_name":"X"}\nHope that helps.');
    assert.equal(out, '{"card_name":"X"}');
  });

  test('returns null when there is no object at all', () => {
    assert.equal(extractJsonObject('no braces here'), null);
  });
});

describe('tryParseSignalJSON', () => {
  test('strips markdown fences', () => {
    const parsed = tryParseSignalJSON('```json\n{"card_name":"Umbreon ex","signals":[]}\n```');
    assert.equal(parsed.card_name, 'Umbreon ex');
  });

  test('flags a repaired response as truncated so the UI can say PARTIAL', () => {
    const parsed = tryParseSignalJSON('{"card_name":"X","signals":[{"key":"creator"},{"key":"co');
    assert.equal(parsed._truncated, true);
    assert.equal(parsed.signals.length, 1);
  });

  test('returns null on unusable input', () => {
    assert.equal(tryParseSignalJSON(''), null);
    assert.equal(tryParseSignalJSON('total garbage, no json'), null);
  });
});
