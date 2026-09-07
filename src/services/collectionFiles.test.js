import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  collectionBackupText, collectionToCsv, parseCollectionBackup,
} from './collectionFiles.js';

const cards = [{
  id: 'sv1-1',
  printingId: 'sv1-1',
  game: 'pokemon',
  name: 'Captain, Test',
  setName: 'Example "Set"',
  number: '123',
  rarity: 'Rare',
  finish: 'Normal',
  form: 'normal',
  condition: 'near_mint',
  qty: 2,
  marketPrice: 4.5,
  priceSource: 'TCGplayer',
  priceCheckedAt: '2026-08-23T00:00:00.000Z',
  paidPerCard: 3,
  addedAt: '2026-08-23T00:00:00.000Z',
  imageUrl: 'image.jpg',
}];

describe('collection files', () => {
  test('CSV preserves commas and quotes', () => {
    const csv = collectionToCsv(cards);
    assert.match(csv, /"Captain, Test"/);
    assert.match(csv, /"Example ""Set"""/);
    assert.match(csv, /"4.5"/);
    assert.match(csv, /"Price Source"/);
    assert.match(csv, /"TCGplayer"/);
  });

  test('backup round-trips collection rows', () => {
    const text = collectionBackupText(cards, '2026-08-23T01:02:03.000Z');
    assert.deepEqual(parseCollectionBackup(text), cards);
  });

  test('rejects unrelated JSON', () => {
    assert.throws(() => parseCollectionBackup('{"hello":"world"}'), /not a Signal collection backup/);
  });
});
