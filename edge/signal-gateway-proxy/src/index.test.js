import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, UPSTREAM_URL } from './index.js';

describe('Signal edge gateway', () => {
  test('forwards only the scanner request to the fixed Google service', async () => {
    let call;
    const request = new Request('https://edge.example/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Signal-Install-Id': 'phone-1' },
      body: '{"action":"vision"}',
    });
    const response = await handleRequest(request, async (url, init) => {
      call = { url, init };
      return Response.json({ result: 'ok' });
    });

    assert.equal(call.url, UPSTREAM_URL);
    assert.equal(call.init.headers.get('X-Signal-Install-Id'), 'phone-1');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.deepEqual(await response.json(), { result: 'ok' });
  });

  test('rejects unrelated methods instead of becoming an open proxy', async () => {
    const response = await handleRequest(new Request('https://edge.example/'));
    assert.equal(response.status, 405);
  });
});
