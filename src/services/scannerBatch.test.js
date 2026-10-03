import test from 'node:test';
import assert from 'node:assert/strict';
import { readScannerBatch, scannerBatchDetails } from './scannerBatch.js';
import { scannerBatchSummary } from './scannerMatch.js';

test('prices every photo in order, keeps ambiguous and failed cards, and continues', async () => {
  const files = ['exact', 'ambiguous', 'failed', 'last'];
  const seen = [];
  const progress = [];
  const entries = await readScannerBatch(files, {
    prepare: async (file) => ({ file, cropped: true }),
    identify: async (file, options) => {
      assert.equal(options.framed, true);
      seen.push(file);
      if (file === 'failed') throw new Error('Could not read number');
      if (file === 'ambiguous') return { card: { name: 'Choose finish' }, candidates: [{ id: 'a' }, { id: 'b' }] };
      return { pin: { name: file, game: 'mtg', price: 5, form: 'normal' } };
    },
    onProgress: (value) => progress.push(value.current),
  });
  assert.deepEqual(seen, files);
  assert.deepEqual(progress, [1, 2, 3, 4]);
  assert.equal(entries.length, 4);
  assert.equal(entries[1].match.candidates.length, 2);
  assert.equal(entries[2].match.file, 'failed');
  assert.equal(entries[2].error, 'Could not read number');
  assert.deepEqual(scannerBatchSummary(entries), { cards: 4, value: 10, unpriced: 2 });
});

test('cancel stops the remaining photos and drops an in-flight result', async () => {
  const controller = new AbortController();
  const saved = [];
  let reads = 0;
  await assert.rejects(() => readScannerBatch(['one', 'two'], {
    signal: controller.signal,
    prepare: async (file) => ({ file }),
    identify: async () => { reads += 1; controller.abort(); return { pin: { price: 1 } }; },
    onEntry: (entry) => saved.push(entry),
  }), { name: 'AbortError' });
  assert.equal(reads, 1);
  assert.equal(saved.length, 0);
});

test('shown price and total both follow finish and quantity; missing foil stays unpriced', () => {
  const entry = { match: { pin: { name: 'Card', game: 'mtg', form: 'normal', price: 2, marketPrices: { normal: 2, foil: 8 } } }, form: 'foil', quantity: 3 };
  assert.equal(scannerBatchDetails(entry).price, 8);
  assert.deepEqual(scannerBatchSummary([entry]), { cards: 3, value: 24, unpriced: 0 });
  entry.match.pin.marketPrices.foil = null;
  assert.equal(scannerBatchDetails(entry).price, null);
  assert.deepEqual(scannerBatchSummary([entry]), { cards: 3, value: 0, unpriced: 3 });
});
