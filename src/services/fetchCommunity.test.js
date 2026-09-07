import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { communityBlock, fetchCommunity, parseRedditFeed } from './fetchCommunity.js';

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>search results</title>
  <entry>
    <author><name>/u/collector</name></author>
    <link href="https://www.reddit.com/r/PokemonTCG/comments/abc123/umbreon_ex_sir_pulled/" />
    <updated>2026-09-02T14:05:00+00:00</updated>
    <title>Umbreon ex SIR pulled from a single pack!</title>
  </entry>
  <entry>
    <author><name>/u/PokemonTCG</name></author>
    <link href="https://www.reddit.com/r/PokemonTCG/" />
    <updated>2009-12-11T00:00:00+00:00</updated>
    <title>PokemonTCG</title>
  </entry>
  <entry>
    <link href="https://www.reddit.com/r/pkmntcgtrades/comments/def456/h_umbreon_w_paypal/" />
    <updated>2026-08-30T01:00:00+00:00</updated>
    <title>[US,US] [H] Umbreon ex &amp; more [W] PayPal</title>
  </entry>
</feed>`;

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe('Reddit community feed fallback', () => {
  test('keeps real posts and drops the subreddit landing entry', () => {
    const posts = parseRedditFeed(FEED);
    assert.deepEqual(posts.map((p) => [p.subreddit, p.title, p.date, p.author, p.score]), [
      ['r/PokemonTCG', 'Umbreon ex SIR pulled from a single pack!', '2026-09-02', 'collector', null],
      ['r/pkmntcgtrades', '[US,US] [H] Umbreon ex & more [W] PayPal', '2026-08-30', '', null],
    ]);
  });

  test('falls back to the feed when search.json is blocked', async () => {
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      if (String(url).includes('search.json')) return new Response('blocked', { status: 403 });
      return new Response(FEED, { status: 200, headers: { 'content-type': 'application/atom+xml' } });
    };
    const data = await fetchCommunity('Umbreon ex', 'pokemon');
    assert.equal(data.posts.length, 2);
    assert.match(calls[0], /search\.json/);
    assert.match(calls[1], /search\.rss/);
    assert.match(communityBlock(data), /score n\/a/);
  });

  test('a blocked feed is still a clean null', async () => {
    globalThis.fetch = async () => new Response('', { status: 429 });
    assert.equal(await fetchCommunity('Umbreon ex', 'pokemon'), null);
  });
});
