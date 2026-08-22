import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { fetchWithTimeout } from './http.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('fetchWithTimeout aborts a hung request', async () => {
  globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
  });
  await assert.rejects(fetchWithTimeout('https://example.test', {}, 5), /timed out/i);
});

test('fetchWithTimeout carries a parent abort', async () => {
  const parent = new AbortController();
  globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true });
  });
  const request = fetchWithTimeout('https://example.test', { signal: parent.signal }, 1000);
  parent.abort();
  await assert.rejects(request, { name: 'AbortError' });
});
