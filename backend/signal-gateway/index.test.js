const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hash, finite, validateModelBody, reportDisposition,
  officialCardCid, officialSetPid, officialSetImage,
} = require('./index');

test('cache ids are stable and hide card text', () => {
  assert.equal(hash('pokemon::Umbreon'), hash('pokemon::Umbreon'));
  assert.equal(hash('pokemon::Umbreon').length, 64);
  assert.ok(!hash('pokemon::Umbreon').includes('Umbreon'));
});

test('a missing market price stays missing instead of becoming zero', () => {
  assert.equal(finite(null), null);
  assert.equal(finite(undefined), null);
  assert.equal(finite(''), null);
  assert.equal(finite('0'), 0);
  assert.equal(finite('12.34'), 12.34);
});

test('official Yu-Gi-Oh pages map an exact set row to its artwork', () => {
  const search = `<div class="t_row"><input class="cnm" value='Reinforcement of the Army'><input class="link_value" value="/x?cid=5328"></div>`;
  const detail = `<div class="t_row"><div class="card_number">L26D-ENS08</div><input class="link_value" value="/x?pid=2000001598001"><span>Starlight Rare</span></div>`;
  const set = `$('#card_image_7_3').attr('src', '/yugiohdb/get_image.action?type=1&osplang=1&cid=5328&ciid=3&enc=abc').show();
    <div class="t_row"><img id="card_image_7_3"><span class="card_name">Reinforcement of the Army</span></div>`;
  assert.equal(officialCardCid(search, 'Reinforcement of the Army'), '5328');
  assert.equal(officialSetPid(detail, 'L26D-ENS08', 'Starlight Rare'), '2000001598001');
  assert.equal(officialSetImage(set, 'Reinforcement of the Army', '5328'),
    'https://www.db.yugioh-card.com/yugiohdb/get_image.action?type=2&osplang=1&cid=5328&ciid=3&enc=abc');
});

test('only Signal models and bounded requests pass', () => {
  const body = {
    model: 'claude-haiku-4-5',
    max_tokens: 600,
    messages: [{ role: 'user', content: 'test' }],
  };
  assert.doesNotThrow(() => validateModelBody(body));
  assert.throws(() => validateModelBody({ ...body, model: 'claude-opus-4-8' }), /not allowed/);
  assert.throws(() => validateModelBody({ ...body, max_tokens: 6001 }), /not allowed/);
});

test('analysis permits one direct search and rejects hidden code filtering', () => {
  const body = {
    model: 'claude-haiku-4-5',
    max_tokens: 6000,
    messages: [{ role: 'user', content: 'test' }],
    tools: [{
      type: 'web_search_20260209',
      name: 'web_search',
      max_uses: 1,
      allowed_callers: ['direct'],
    }],
  };
  assert.doesNotThrow(() => validateModelBody(body));
  assert.throws(() => validateModelBody({
    ...body,
    tools: [{ ...body.tools[0], max_uses: 2 }],
  }), /not allowed/);
  assert.throws(() => validateModelBody({
    ...body,
    tools: [{ ...body.tools[0], allowed_callers: ['code_execution_20260120'] }],
  }), /not allowed/);
  assert.throws(() => validateModelBody({ ...body, model: 'claude-sonnet-4-6' }), /not allowed/);
});

test('a live report or lease prevents a second paid model call', () => {
  const now = 1000;
  const timestamp = (value) => ({ toMillis: () => value });
  assert.equal(reportDisposition({ rawResponse: { id: 'msg_1' }, expiresAt: timestamp(2000) }, now), 'cached');
  assert.equal(reportDisposition({ inFlightOwner: 'worker-1', inFlightUntil: timestamp(2000) }, now), 'wait');
  assert.equal(reportDisposition({ inFlightOwner: 'worker-1', inFlightUntil: timestamp(999) }, now), 'claim');
  assert.equal(reportDisposition(null, now), 'claim');
});
