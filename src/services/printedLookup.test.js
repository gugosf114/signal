import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolvePrintingOptions } from './fetchExpansions.js';
import { scannedPrintingTarget, sameCollectorNumber, scannedSetMatches } from './printedIdentity.js';

const promo = JSON.parse(readFileSync(new URL('./fixtures/pokemon-eevee-svp173.json', import.meta.url)));
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function catalogues(answer) {
  globalThis.fetch = async (url, init = {}) => {
    const body = JSON.parse(init.body || '{}');
    const target = new URL(body.action === 'catalogueFetch' ? body.url : url);
    const data = answer(target);
    const status = data === null ? 404 : 200;
    return { ok: body.action === 'catalogueFetch' || status === 200, status: body.action === 'catalogueFetch' ? 200 : status,
      json: async () => body.action === 'catalogueFetch' ? { catalogue: true, ok: status === 200, status, data } : data };
  };
}

test('actual Eevee scan SVPEN 173 finds the exact promo beyond the name-search page', async () => {
  const calls = [];
  catalogues(url => {
    calls.push(url);
    if (url.hostname === 'api.pokemontcg.io') {
      if (url.searchParams.get('q')?.includes('number:')) return { data: [] };
      return { data: [{ id: 'dp5-62', name: 'Eevee', number: '62', set: { id: 'dp5', name: 'Majestic Dawn' }, tcgplayer: { prices: { normal: { market: 1 } } } }] };
    }
    if (url.pathname.endsWith('/cards') && url.searchParams.get('localId') === '173') return [{ id: promo.id, name: promo.name, localId: promo.localId }];
    if (url.pathname.endsWith('/cards/svp-173')) return promo;
    return null;
  });
  const options = await resolvePrintingOptions({ name: 'Eevee', game: 'pokemon',
    set: 'Scarlet & Violet Black Star Promos', number: 'SVPEN 173', rarity: 'Promo', confidence: 'high' });
  assert.equal(options.length, 2);
  assert.ok(options.every(row => row.id === 'svp-173' && row.number === '173'));
  assert.deepEqual(options.map(row => row.finish), ['Holo', 'Holo · Pokemon Center']);
  assert.ok(options.every(row => !row.requiresOwnerChoice));
  assert.ok(calls.filter(url => url.hostname === 'api.pokemontcg.io').every(url => url.searchParams.get('q')?.includes('number:')));
});

test('a Pokemon set abbreviation is checked against the full set record', async () => {
  catalogues(url => {
    if (url.hostname === 'api.pokemontcg.io') return { data: [] };
    if (url.pathname.endsWith('/cards')) return [{ id: 'sv08.5-074', name: 'Eevee', localId: '074' }];
    if (url.pathname.endsWith('/cards/sv08.5-074')) return { ...promo, id: 'sv08.5-074', localId: '074', set: { id: 'sv08.5', name: 'Prismatic Evolutions', cardCount: { official: 131 } } };
    if (url.pathname.endsWith('/sets/sv08.5')) return { id: 'sv08.5', name: 'Prismatic Evolutions', abbreviation: { official: 'PRE' } };
    return null;
  });
  const options = await resolvePrintingOptions({ name: 'Eevee', game: 'pokemon', set: 'PRE', number: '074/131' });
  assert.equal(options.length, 2);
  assert.ok(options.every(row => row.id === 'sv08.5-074'));
  assert.ok(options.every(row => !row.requiresOwnerChoice));
});

test('a Pokemon miss returns no unrelated numbers for the second reader to retry', async () => {
  catalogues(url => url.hostname === 'api.pokemontcg.io'
    ? { data: [{ id: 'sv1-125', name: 'Eevee', number: '125', set: { id: 'sv1', name: 'Scarlet & Violet' } }] }
    : url.pathname.endsWith('/cards') ? [{ id: 'sv1-125', name: 'Eevee', localId: '125' }] : null);
  const options = await resolvePrintingOptions({ name: 'Eevee', game: 'pokemon', set: 'Scarlet & Violet', number: '25' });
  assert.deepEqual(options, []);
});

test('older Pokemon promo numbers keep their prefix and match catalog zero padding', async () => {
  catalogues(url => {
    if (url.pathname.endsWith('/cards') && url.searchParams.get('localId') === '42') return [
      { id: 'swshp-SWSH042', name: 'Eevee', localId: 'SWSH042' },
      { id: 'smp-SM242', name: 'Eevee', localId: 'SM242' },
    ];
    if (url.pathname.endsWith('/cards/swshp-SWSH042')) return { ...promo, id: 'swshp-SWSH042', localId: 'SWSH042', set: { id: 'swshp', name: 'SWSH Black Star Promos' } };
    return null;
  });
  const options = await resolvePrintingOptions({ name: 'Eevee', game: 'pokemon', number: 'SWSH042' });
  assert.equal(options.length, 2);
  assert.ok(options.every(row => row.id === 'swshp-SWSH042'));
});

test('Magic queries the printed set and number before any capped name search', async () => {
  const calls = [];
  catalogues(url => {
    const q = url.searchParams.get('q') || ''; calls.push(q);
    const exact = q.includes('cn:207');
    return { data: [{ id: exact ? 'hob-207' : 'hob-248', name: 'The Lonely Mountain', set: 'hob', set_name: 'The Hobbit',
      collector_number: exact ? '207' : '248', finishes: ['nonfoil', 'foil'], prices: { usd: '17', usd_foil: '26' } }] };
  });
  const options = await resolvePrintingOptions({ name: 'The Lonely Mountain', game: 'mtg', set: 'HOB', number: '0207' });
  assert.ok(calls.every(q => q.includes('cn:207') && q.includes('set:')));
  assert.deepEqual(options.map(row => [row.number, row.form, row.price]), [['207', 'normal', 17], ['207', 'foil', 26]]);
});

test('Magic rejects a different collector number even if the name matches', async () => {
  catalogues(() => ({ data: [{ id: 'other-125', name: 'The Lonely Mountain', set: 'hob', set_name: 'The Hobbit',
    collector_number: '125', finishes: ['foil'], prices: { usd_foil: '99' } }] }));
  assert.deepEqual(await resolvePrintingOptions({ name: 'The Lonely Mountain', game: 'mtg', set: 'HOB', number: '25' }), []);
});

test('Magic still accepts either printed face of a double-faced card', async () => {
  catalogues(() => ({ data: [{ id: 'fable-141', name: 'Fable of the Mirror-Breaker // Reflection of Kiki-Jiki',
    set: 'neo', set_name: 'Kamigawa: Neon Dynasty', collector_number: '141', finishes: ['nonfoil', 'foil'], prices: { usd: '10', usd_foil: '12' } }] }));
  const options = await resolvePrintingOptions({ name: 'Fable of the Mirror-Breaker', game: 'mtg', set: 'NEO', number: '141' });
  assert.equal(options.length, 2);
});

test('printed set/language badges split cleanly while number prefixes stay distinct', () => {
  for (const number of ['SVPEN 173', 'SVP EN 173', 'SVP173', 'SVP-173']) {
    assert.deepEqual(scannedPrintingTarget({ game: 'pokemon', number }), { set: 'SVP', number: '173', total: null });
  }
  assert.deepEqual(scannedPrintingTarget({ game: 'pokemon', number: 'TG 04/TG30', set: 'Brilliant Stars' }), { set: 'Brilliant Stars', number: 'TG4', total: null });
  assert.deepEqual(scannedPrintingTarget({ game: 'pokemon', number: 'SWSH 042' }), { set: 'swshp', number: 'SWSH42', total: null });
  assert.deepEqual(scannedPrintingTarget({ game: 'mtg', number: 'ZEN 024' }), { set: 'ZEN', number: '24', total: null });
  assert.deepEqual(scannedPrintingTarget({ game: 'mtg', number: 'R 0207', set: 'HOB' }), { set: 'HOB', number: '207', total: null });
  assert.equal(sameCollectorNumber('074', '74'), true);
  assert.equal(sameCollectorNumber('174', '74'), false);
  assert.equal(sameCollectorNumber('TG04', '4'), false);
  assert.equal(sameCollectorNumber('TG04', 'TG4'), true);
  assert.equal(scannedSetMatches({ setName: 'SVP Black Star Promos' }, 'Scarlet & Violet Black Star Promos'), true);
});
