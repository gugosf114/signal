const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hash, finite, validateModelBody, reportDisposition,
  officialCardCid, officialSetPid, officialSetImage, catalogueTarget, catalogueFetch, tcgplayerSearch,
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

test('catalogue relay accepts only Signal card APIs', async () => {
  assert.equal(
    catalogueTarget('https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=Witness'),
    'https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=Witness',
  );
  assert.throws(() => catalogueTarget('https://example.com/cards'), /not allowed/);
  assert.throws(() => catalogueTarget('https://api.scryfall.com/account'), /not allowed/);

  let requested;
  const reply = await catalogueFetch({
    url: 'https://api.scryfall.com/cards/search?q=Witness',
  }, async (url) => {
    requested = url;
    return new Response(JSON.stringify({ data: [{ name: 'Witness Protection' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  assert.equal(requested, 'https://api.scryfall.com/cards/search?q=Witness');
  assert.deepEqual(reply, {
    catalogue: true,
    ok: true,
    status: 200,
    data: { data: [{ name: 'Witness Protection' }] },
  });
});

test('TCGplayer relay keeps separate art products and their exact prices', async () => {
  const reply = await tcgplayerSearch({ query: 'Witness of the Ancient' }, async (url, init) => {
    assert.match(url, /mp-search-api\.tcgplayer\.com/);
    assert.equal(init.method, 'POST');
    return Response.json({ results: [{ results: [
      { productId: 702445, productName: 'Witness of the Ancient', setName: 'Chaos Origins',
        rarityName: 'Ultra Rare', marketPrice: 1.86, customAttributes: { number: 'CORI-EN081' } },
      { productId: 702446, productName: 'Witness of the Ancient (Extended Art)', setName: 'Chaos Origins',
        rarityName: 'Ultra Rare', marketPrice: 10.67, customAttributes: { number: 'CORI-EN081' } },
    ] }] });
  });
  assert.deepEqual(reply.products.map((item) => [item.productId, item.productName, item.marketPrice]), [
    [702445, 'Witness of the Ancient', 1.86],
    [702446, 'Witness of the Ancient (Extended Art)', 10.67],
  ]);
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
