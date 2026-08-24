import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

import { DOSSIER_METHOD, DOSSIER_SAMPLE, DOSSIER_SCOPE } from './dossier.js';

describe('Dossier product contract', () => {
  test('keeps the premium service inside Signal\'s three supported games', () => {
    assert.deepEqual(DOSSIER_SCOPE.map((game) => game.key), ['pokemon', 'yugioh', 'mtg']);
  });

  test('presents five distinct research promises', () => {
    assert.equal(DOSSIER_METHOD.length, 5);
    assert.equal(new Set(DOSSIER_METHOD.map((item) => item.number)).size, 5);
    assert.equal(DOSSIER_METHOD.every((item) => item.title && item.body), true);
  });

  test('ships one exact downloadable sample', () => {
    assert.equal(DOSSIER_SAMPLE.number, 'L26D-ENS08');
    assert.equal(DOSSIER_SAMPLE.rarity, 'Starlight Rare');
    assert.match(DOSSIER_SAMPLE.pdfPath, /\.pdf$/);
    assert.match(DOSSIER_SAMPLE.filename, /\.pdf$/);
    const pdf = new URL('../../public/samples/signal-dossier-reinforcement-sample.pdf', import.meta.url);
    assert.equal(readFileSync(pdf, { encoding: 'ascii', flag: 'r' }).slice(0, 4), '%PDF');
    assert.ok(statSync(pdf).size > 10_000);
  });
});
