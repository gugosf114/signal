import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { gateway } from './signalGateway.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe('Signal gateway retry', () => {
  test('repairs a temporary DNS failure instead of killing the scan', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls < 3) throw new TypeError('Unable to resolve host');
      return { ok: true, status: 200, async json() { return { result: 'ok' }; } };
    };

    assert.deepEqual(await gateway({ action: 'vision' }), { result: 'ok' });
    assert.equal(calls, 3);
  });

  test('does not retry a real client error', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return { ok: false, status: 400, async json() { return { error: 'bad request' }; } };
    };

    await assert.rejects(gateway({ action: 'vision' }), /bad request/);
    assert.equal(calls, 1);
  });

  test('an abort stops the retry chain', async () => {
    const controller = new AbortController();
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      controller.abort(new DOMException('cancelled', 'AbortError'));
      throw controller.signal.reason;
    };

    await assert.rejects(gateway({ action: 'vision' }, controller.signal), { name: 'AbortError' });
    assert.equal(calls, 1);
  });
});
