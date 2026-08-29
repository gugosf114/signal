// Tests for the card-image cache.
//
// The bug this pins: old cache versions stored bad nulls and watermarked art,
// the nulls produced by a transient pokemontcg.io 500. One bad minute on their
// end blanked a card's artwork for a week, and no amount of re-scanning would
// bring it back. A failure to reach the server is a fact about the server, not
// a fact about the card, and must not be remembered as one.
//
// fetch and localStorage are stubbed before the module is imported.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Stubs ───────────────────────────────────────────────────────────────────
let store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

let responder = () => ({ ok: true, status: 200, json: async () => ({}) });
let callCount = 0;
globalThis.fetch = async (url, init) => { callCount++; return responder(url, init); };

const okPokemon = (imgUrl) => () => ({
  ok: true,
  status: 200,
  json: async () => ({ data: [{ images: { large: imgUrl } }] }),
});
const status = (code) => () => ({ ok: false, status: code, json: async () => ({}) });
const notFound = () => ({ ok: false, status: 404, json: async () => ({}) });

const { fetchCardImage, officialArtNumber } = await import('./fetchCardImage.js');

describe('fetchCardImage cache', () => {
  beforeEach(() => {
    store = {};
    callCount = 0;
  });

  test('a found image is returned and cached', async () => {
    responder = okPokemon('https://img.example.com/pikachu.png');
    const a = await fetchCardImage('Pikachu Test A', 'pokemon');
    assert.equal(a, 'https://img.example.com/pikachu.png');
    assert.ok(store['signal_card_image_cache_v5'], 'wrote to the v5 cache key');
  });

  test('a server error is NOT cached, so the next call retries', async () => {
    responder = status(500);
    const first = await fetchCardImage('Slowbro Test B', 'pokemon');
    assert.equal(first, null, 'returns null to the caller');

    const cache = JSON.parse(store['signal_card_image_cache_v5'] || '{}');
    assert.equal(Object.keys(cache).length, 0, 'nothing written to the cache');

    // The API recovers; the very next call must reach it rather than serve a
    // remembered failure.
    responder = okPokemon('https://img.example.com/slowbro.png');
    const second = await fetchCardImage('Slowbro Test B', 'pokemon');
    assert.equal(second, 'https://img.example.com/slowbro.png');
  });

  test('a rate-limit is treated the same as any other server error', async () => {
    responder = status(429);
    await fetchCardImage('Ratelimited Test C', 'pokemon');
    const cache = JSON.parse(store['signal_card_image_cache_v5'] || '{}');
    assert.equal(Object.keys(cache).length, 0);
  });

  test('a genuine 404 IS cached — that is a fact about the card', async () => {
    responder = notFound;
    const r = await fetchCardImage('Nonexistent Test D', 'pokemon');
    assert.equal(r, null);
    const cache = JSON.parse(store['signal_card_image_cache_v5'] || '{}');
    assert.equal(Object.keys(cache).length, 1, 'the genuine miss was remembered');
    assert.equal(Object.values(cache)[0].url, null);
  });

  test('concurrent callers share a single request', async () => {
    responder = okPokemon('https://img.example.com/shared.png');
    const [a, b, c] = await Promise.all([
      fetchCardImage('Shared Test E', 'pokemon'),
      fetchCardImage('Shared Test E', 'pokemon'),
      fetchCardImage('Shared Test E', 'pokemon'),
    ]);
    assert.equal(a, b);
    assert.equal(b, c);
    assert.equal(callCount, 1, 'four components, one round trip');
  });

  test('an empty card name never hits the network', async () => {
    responder = okPokemon('https://img.example.com/x.png');
    assert.equal(await fetchCardImage('', 'pokemon'), null);
    assert.equal(callCount, 0);
  });

  test('watermarked alternate art is refused when there is no saved scan', async () => {
    let requestBody = null;
    responder = (url, init) => {
      if (String(url).includes('signal-gateway')) {
        requestBody = JSON.parse(init.body);
        return { ok: true, status: 200, json: async () => ({ imageUrl: 'https://official.example/card.png?cid=5328&ciid=3' }) };
      }
      return { ok: true, status: 200, json: async () => ({ data: [{ card_images: [{ image_url: 'wrong-original.png' }] }] }) };
    };
    const image = await fetchCardImage('Reinforcement Official Test', 'yugioh', {
      game: 'yugioh', printingId: '32807846:L26D-ENS08', number: 'L26D-ENS08', rarity: 'Starlight Rare',
    });
    assert.equal(image, null);
    assert.equal(requestBody.action, 'yugiohArt');
    assert.equal(requestBody.setCode, 'L26D-ENS08');
    assert.equal(requestBody.rarity, 'Starlight Rare');
  });

  test('exact TCGplayer product art wins for an alternate-art printing', async () => {
    responder = (url) => String(url).includes('signal-gateway')
      ? { ok: true, status: 200, json: async () => ({ imageUrl: 'https://official.example/card.png?cid=5328&ciid=3' }) }
      : { ok: true, status: 200, json: async () => ({ data: [{ card_images: [{ image_url: 'wrong-original.png' }] }] }) };
    const image = await fetchCardImage('Reinforcement Exact TCGplayer Test', 'yugioh', {
      game: 'yugioh', printingId: '32807846:L26D-ENS08', number: 'L26D-ENS08', rarity: 'Starlight Rare',
      imageSource: 'tcgplayer',
      tcgplayerImageUrl: 'https://product-images.tcgplayer.com/683013.jpg',
      imageUrl: 'https://product-images.tcgplayer.com/683013.jpg',
      imageLarge: 'https://product-images.tcgplayer.com/683013.jpg',
    });
    assert.equal(image, 'https://product-images.tcgplayer.com/683013.jpg');
  });

  test('standard Yu-Gi-Oh art uses the clean catalogue image', async () => {
    responder = (url) => String(url).includes('signal-gateway')
      ? { ok: true, status: 200, json: async () => ({ imageUrl: 'https://official.example/card.png?cid=21191&ciid=1' }) }
      : { ok: true, status: 200, json: async () => ({ data: [{ card_images: [{ image_url: 'ai-connect-clean.png' }] }] }) };
    const image = await fetchCardImage('A.I. Connect Clean Test', 'yugioh', {
      game: 'yugioh', printingId: '79015062:ALIN-EN054', number: 'ALIN-EN054', rarity: 'Super Rare',
    });
    assert.equal(image, 'ai-connect-clean.png');
  });

  test('an uncertain official-art lookup refuses a wrong catalogue substitute', async () => {
    responder = (url) => String(url).includes('signal-gateway')
      ? { ok: false, status: 503, json: async () => ({ error: 'temporary failure' }) }
      : { ok: true, status: 200, json: async () => ({ data: [{ card_images: [{ image_url: 'wrong-original.png' }] }] }) };
    const image = await fetchCardImage('Collection Alternate Art Fallback Test', 'yugioh', {
      game: 'yugioh', printingId: '32807846:L26D-ENS08', number: 'L26D-ENS08', rarity: 'Starlight Rare',
      preferExactOwnerArt: true,
    });
    assert.equal(image, null, 'the missing local test file does not fall through to the wrong artwork');
  });

  test('reads the official alternate-art number', () => {
    assert.equal(officialArtNumber('https://official.example/card.png?cid=5328&ciid=3'), 3);
    assert.equal(officialArtNumber('https://official.example/card.png?cid=5328'), null);
  });

  test('an exact Magic result fetches its selected Scryfall card id', async () => {
    let requested = '';
    let headers = null;
    responder = (url, init) => {
      requested = String(url);
      headers = init.headers;
      return { ok: true, status: 200, json: async () => ({ image_uris: { large: 'badgermole-326.jpg' } }) };
    };
    const image = await fetchCardImage('Badgermole Cub', 'mtg', { id: 'be16c053-99e1-4921-8530-5135c989149d' });
    assert.equal(image, 'badgermole-326.jpg');
    assert.match(requested, /cards\/be16c053-99e1-4921-8530-5135c989149d$/);
    assert.equal(headers['User-Agent'], 'SignalTCG/1.0');
  });

  test('an exact Pokémon result keeps the image host returned by its catalogue', async () => {
    responder = () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { images: { large: 'https://images.scrydex.com/pokemon/me2pt5-295/large' } } }),
    });
    const image = await fetchCardImage('Mega Dragonite ex', 'pokemon', { printingId: 'me2pt5-295' });
    assert.equal(image, 'https://images.scrydex.com/pokemon/me2pt5-295/large');
    assert.equal(callCount, 1);
  });

  test('TCGdex repairs an exact Pokémon image when the primary API is down', async () => {
    responder = (url) => String(url).includes('pokemontcg.io')
      ? { ok: false, status: 502, json: async () => ({}) }
      : { ok: true, status: 200, json: async () => ({ image: 'https://assets.tcgdex.net/en/sm/det1/10' }) };
    const image = await fetchCardImage('Detective Pikachu fallback', 'pokemon', { printingId: 'det1-10' });
    assert.equal(image, 'https://assets.tcgdex.net/en/sm/det1/10/high.webp');
    assert.equal(callCount, 2);
  });
});
