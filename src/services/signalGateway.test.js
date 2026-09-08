import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { GATEWAY_DIRECT_URL, GATEWAY_EDGE_URL, GATEWAY_URL, gateway, identifyCardViaGemini } from './signalGateway.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe('Signal gateway retry', () => {
  test('Gemini identification sends images through the fixed Signal action', async () => {
    let sent;
    globalThis.fetch = async (_url, init) => {
      sent = JSON.parse(init.body);
      return { ok: true, status: 200, async json() { return { result: { model: 'gemini-3.5-flash-lite' } }; } };
    };
    const images = { full: 'abc', detail: 'def' };
    await identifyCardViaGemini(images);
    assert.equal(sent.action, 'identifyCard');
    assert.deepEqual(sent.images, images);
    assert.equal('model' in sent, false);
  });

  test('repairs a temporary DNS failure instead of killing the scan', async () => {
    let calls = 0;
    const urls = [];
    globalThis.fetch = async (url) => {
      urls.push(url);
      calls += 1;
      if (calls < 3) throw new TypeError('Unable to resolve host');
      return { ok: true, status: 200, async json() { return { result: 'ok' }; } };
    };

    assert.deepEqual(await gateway({ action: 'vision' }), { result: 'ok' });
    assert.equal(calls, 3);
    assert.deepEqual(urls, [GATEWAY_EDGE_URL, GATEWAY_URL, GATEWAY_DIRECT_URL]);
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
