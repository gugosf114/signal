import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeScannerPagesToFiles, shouldRenderScannerShell } from './nativeCardScanner.js';

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
