import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { looksLikeSetCode, lookupBySetCode, parseSetCode } from './lookupBySetCode.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe('set-code parsing', () => {
  test('keeps locale and collector suffixes', () => {
    assert.deepEqual(parseSetCode('LOB-EN001'), {
      rawCode: 'LOB-EN001', setCode: 'lob', locale: 'en', number: '001',
    });
    assert.deepEqual(parseSetCode('MOM-123a'), {
      rawCode: 'MOM-123A', setCode: 'mom', locale: null, number: '123a',
    });
    assert.equal(looksLikeSetCode('MOM-123a'), true);
  });
});

describe('Yu-Gi-Oh exact set-code lookup', () => {
  test('uses the exact set-code endpoint and returns a printing id', async () => {
    let requested = '';
    globalThis.fetch = async (url) => {
      requested = String(url);
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            id: 89631146,
            name: 'Blue-Eyes White Dragon',
            set_name: 'Legend of Blue Eyes White Dragon',
            set_code: 'LOB-EN001',
            set_rarity: 'Ultra Rare',
          };
        },
      };
    };

    const hit = await lookupBySetCode('LOB-EN001');
    assert.match(requested, /cardsetsinfo\.php\?setcode=LOB-EN001$/);
    assert.equal(hit.id, '89631146');
    assert.equal(hit.printingId, '89631146:LOB-EN001');
    assert.equal(hit.number, 'LOB-EN001');
    assert.equal(hit.rarity, 'Ultra Rare');
  });
});
