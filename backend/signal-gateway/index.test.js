const test = require('node:test');
const assert = require('node:assert/strict');
const { hash, validateModelBody } = require('./index');

test('cache ids are stable and hide card text', () => {
  assert.equal(hash('pokemon::Umbreon'), hash('pokemon::Umbreon'));
  assert.equal(hash('pokemon::Umbreon').length, 64);
  assert.ok(!hash('pokemon::Umbreon').includes('Umbreon'));
});

test('only Signal models and bounded requests pass', () => {
  const body = {
    model: 'claude-haiku-4-5',
    max_tokens: 600,
    messages: [{ role: 'user', content: 'test' }],
  };
  assert.doesNotThrow(() => validateModelBody(body));
  assert.throws(() => validateModelBody({ ...body, model: 'claude-opus-4-8' }), /not allowed/);
  assert.throws(() => validateModelBody({ ...body, max_tokens: 24001 }), /not allowed/);
});
