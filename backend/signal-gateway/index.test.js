const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hash, validateModelBody, officialCardCid, officialSetPid, officialSetImage,
} = require('./index');

test('cache ids are stable and hide card text', () => {
  assert.equal(hash('pokemon::Umbreon'), hash('pokemon::Umbreon'));
  assert.equal(hash('pokemon::Umbreon').length, 64);
  assert.ok(!hash('pokemon::Umbreon').includes('Umbreon'));
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
  assert.throws(() => validateModelBody({ ...body, max_tokens: 24001 }), /not allowed/);
});
