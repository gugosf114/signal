import test from 'node:test';
import assert from 'node:assert/strict';
import { readScannerBatch } from './scannerBatch.js';
import {
  deliverNativeScannerResult,
  nativeScannerPagesToFiles,
  shouldRenderScannerShell,
} from './nativeCardScanner.js';

test('native launch never paints the retired scanner underneath', () => {
  assert.equal(shouldRenderScannerShell({ open: true, native: true, phase: 'opening' }), false);
  assert.equal(shouldRenderScannerShell({ open: true, native: true, phase: 'identifying' }), true);
  assert.equal(shouldRenderScannerShell({ open: true, native: false, phase: 'opening' }), true);
  assert.equal(shouldRenderScannerShell({ open: false, native: true, phase: 'opening' }), false);
});

test('native scanner turns readable page URLs into JPEG files in order', async () => {
  const opened = [];
  const files = await nativeScannerPagesToFiles([
    { url: 'https://localhost/card-one' },
    { width: 2000 },
    { url: 'https://localhost/card-two' },
  ], {
    now: () => 1234,
    fetcher: async (url) => {
      opened.push(url);
      return { ok: true, blob: async () => new Blob([url], { type: 'image/jpeg' }) };
    },
  });

  assert.deepEqual(opened, ['https://localhost/card-one', 'https://localhost/card-two']);
  assert.equal(files.length, 2);
  assert.equal(files[0].name, 'signal-card-1234-0.jpg');
  assert.equal(files[1].name, 'signal-card-1234-2.jpg');
  assert.equal(files[0].type, 'image/jpeg');
});

test('native scanner refuses an empty or unreadable result', async () => {
  await assert.rejects(() => nativeScannerPagesToFiles([]), /returned no photo/);
  await assert.rejects(() => nativeScannerPagesToFiles(
    [{ url: 'https://localhost/missing' }],
    { fetcher: async () => ({ ok: false }) },
  ), /could not be opened/);
});

test('a returned camera photo always reaches identification', async () => {
  const calls = [];
  const files = [{ name: 'first.jpg' }, { name: 'second.jpg' }];
  const status = await deliverNativeScannerResult({ files }, {
    identify: async (file, framed) => calls.push(['identify', file.name, framed]),
    onPending: (pending) => calls.push(['pending', pending.map((file) => file.name)]),
  });

  assert.equal(status, 'delivered');
  assert.deepEqual(calls, [
    ['pending', ['second.jpg']],
    ['identify', 'first.jpg', false],
  ]);
  await assert.rejects(
    () => deliverNativeScannerResult({ files }, {}),
    /photo receiver is unavailable/,
  );
});

test('native batch Done delivers every photo to pricing without single-card confirmation', async () => {
  const files = [{ name: 'one.jpg' }, { name: 'two.jpg' }, { name: 'three.jpg' }];
  const priced = [];
  await deliverNativeScannerResult({ files }, {
    identify: () => assert.fail('Batch must not enter the single-card Keep screen'),
    identifyBatch: (photos) => readScannerBatch(photos, {
      prepare: async (file) => ({ file, cropped: true }),
      identify: async (file) => ({ pin: { name: file.name, price: 2 } }),
      onEntry: (entry) => priced.push(entry.match.pin.name),
    }),
  });
  assert.deepEqual(priced, files.map((file) => file.name));
});

test('cancelled native batch never starts pricing', async () => {
  let cancelled = false;
  await deliverNativeScannerResult({ cancelled: true }, {
    onCancel: () => { cancelled = true; },
    identifyBatch: () => assert.fail('Cancelled batch was priced'),
  });
  assert.equal(cancelled, true);
});
