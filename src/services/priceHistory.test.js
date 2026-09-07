import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  alignmentFromHistory, fetchPriceHistory, historyBlock, historyUrl, pickHistorySku, shapeHistory,
} from './priceHistory.js';

const NOW = Date.UTC(2026, 8, 7);
const day = (offset) => new Date(NOW - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const buckets = (prices, step = 3) => prices.map((market, index) => ({
  bucketStartDate: day(index * step), marketPrice: String(market), quantitySold: String(index % 2), transactionCount: '0',
}));

const umbreon = { game: 'pokemon', form: 'holo', price: 1442.14, tcgplayerProductId: 610516 };
const RESULT = [
  { skuId: 1, variant: 'Holofoil', condition: 'Near Mint', language: 'English', buckets: buckets([1445.47, 1445.47, 1453.56, 1400, 1390, 1380, 1370, 1360, 1350, 1340, 1330, 1320, 1310, 1300, 1290, 1280, 1270, 1260, 1250, 1240, 1230, 1220, 1210, 1200, 1190, 1180, 1170, 1160, 1150, 1555.13]) },
  { skuId: 2, variant: 'Holofoil', condition: 'Lightly Played', language: 'English', buckets: buckets([989.35, 980]) },
  { skuId: 3, variant: 'Reverse Holofoil', condition: 'Near Mint', language: 'English', buckets: buckets([12, 11]) },
  { skuId: 4, variant: 'Holofoil', condition: 'Near Mint', language: 'Japanese', buckets: buckets([2000, 1900]) },
];

const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
afterEach(() => { globalThis.fetch = originalFetch; globalThis.localStorage = originalStorage; });

describe('price history', () => {
  test('picks English Near Mint in the chosen finish', () => {
    assert.equal(pickHistorySku(RESULT, umbreon).skuId, 1);
    assert.equal(pickHistorySku(RESULT, { ...umbreon, form: 'reverse' }).skuId, 3);
  });

  test('a single-variant product is taken as is; several without a finish fall to the nearest price', () => {
    const single = [{ skuId: 9, variant: '1st Edition', condition: 'Near Mint', language: 'English', buckets: buckets([262.45, 262.45]) }];
    assert.equal(pickHistorySku(single, { game: 'yugioh', price: 262.45 }).skuId, 9);
    const several = [
      { skuId: 5, variant: 'Normal', condition: 'Near Mint', language: 'English', buckets: buckets([3, 3]) },
      { skuId: 6, variant: 'Foil', condition: 'Near Mint', language: 'English', buckets: buckets([30, 30]) },
    ];
    assert.equal(pickHistorySku(several, { game: 'mtg', price: 28 }).skuId, 6);
    assert.equal(pickHistorySku(several, { game: 'mtg' }), null);
  });

  test('deltas read from the exact points and the block prints them', () => {
    const history = shapeHistory(RESULT[0], { now: NOW });
    assert.equal(history.latest, 1445.47);
    assert.equal(history.latestDate, day(0));
    // six days old is nearer to seven than nine days old is
    assert.equal(history.change7, Math.round(((1445.47 - 1453.56) / 1453.56) * 1000) / 10);
    assert.equal(history.change30, Math.round(((1445.47 - 1330) / 1330) * 1000) / 10);
    assert.equal(history.change90, Math.round(((1445.47 - 1555.13) / 1555.13) * 1000) / 10);
    assert.equal(history.points.length, 30);
    assert.match(historyBlock(history), /30-day: \+8\.7%/);
    assert.match(historyBlock(history), /90-day: -7\.1%/);
    assert.equal(shapeHistory({ buckets: [{ bucketStartDate: 'x', marketPrice: '0' }] }), null);
  });

  test('alignment is a fact about score versus the real move', () => {
    assert.equal(alignmentFromHistory(70, 11.3), 'agree');
    assert.equal(alignmentFromHistory(70, -8), 'disagree');
    assert.equal(alignmentFromHistory(40, -8), 'agree');
    assert.equal(alignmentFromHistory(50, 11.3), 'mixed');
    assert.equal(alignmentFromHistory(70, 1), 'mixed');
    assert.equal(alignmentFromHistory(70, null), null);
  });

  test('fetches through the relay first, then directly, and caches for six hours', async () => {
    const store = new Map();
    globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push(String(url));
      if (String(url).includes('workers.dev')) return new Response(JSON.stringify({ catalogue: true, ok: false, status: 500, data: null }), { status: 200 });
      assert.equal(String(url), historyUrl(610516, 'quarter'));
      return new Response(JSON.stringify({ count: 4, result: RESULT }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const first = await fetchPriceHistory(umbreon, { now: NOW });
    assert.equal(first.productId, 610516);
    assert.equal(first.variant, 'Holofoil');
    assert.equal(first.change30, 8.7);
    const again = await fetchPriceHistory(umbreon, { now: NOW + 1000 });
    assert.equal(again.latest, 1445.47);
    assert.equal(calls.filter((url) => url.includes('infinite-api')).length, 1);
  });

  test('a card without a product id has no history rather than a neighbour\'s', async () => {
    globalThis.fetch = async () => new Response('{}', { status: 404 });
    assert.equal(await fetchPriceHistory({ game: 'pokemon', name: 'Nobody', form: 'holo' }), null);
  });
});
