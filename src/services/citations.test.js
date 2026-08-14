// Tests for the citation filter — the only thing standing between a fabricated
// URL and the user's report.
//
// Every hole this filter has ever had failed SILENTLY: a bad link sails through
// and the page still looks perfect. Two such holes are on record in the README
// (the path-prefix hole and the YouTube-ID hole). Both are pinned here so they
// cannot come back, along with the pre-fetch blindness that was quietly
// deleting honestly-cited sources.
//
// Runs on Node's built-in test runner — no framework, no new dependency:
//   npm test

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUrl,
  extractYouTubeId,
  urlIsReal,
  extractRealUrls,
  collectPrefetchUrls,
  filterHallucinatedSources,
} from './citations.js';

const real = (...urls) => new Set(urls.map(normalizeUrl));

describe('urlIsReal — exact matching', () => {
  test('accepts a URL that was actually retrieved', () => {
    const urls = real('https://www.tcgplayer.com/product/12345/umbreon-ex');
    assert.equal(urlIsReal('https://www.tcgplayer.com/product/12345/umbreon-ex', urls), true);
  });

  test('ignores a trailing-slash difference', () => {
    const urls = real('https://www.tcgplayer.com/product/12345/');
    assert.equal(urlIsReal('https://www.tcgplayer.com/product/12345', urls), true);
  });

  test('rejects a URL from a host that was never visited', () => {
    const urls = real('https://www.tcgplayer.com/product/12345');
    assert.equal(urlIsReal('https://example.com/product/12345', urls), false);
  });

  test('rejects empty and unparseable input', () => {
    const urls = real('https://www.tcgplayer.com/product/12345');
    assert.equal(urlIsReal('', urls), false);
    assert.equal(urlIsReal(null, urls), false);
    assert.equal(urlIsReal('not a url', urls), false);
  });
});

describe('urlIsReal — the path-prefix hole (regression)', () => {
  // A real '/products/foo' once unlocked a fabricated '/products-fake',
  // because the check was a bare startsWith with no slash boundary.
  test('a real path does not unlock a sibling sharing its prefix', () => {
    const urls = real('https://shop.example.com/products/foo');
    assert.equal(urlIsReal('https://shop.example.com/products-fake', urls), false);
  });

  test('a genuine deeper sub-path is still accepted', () => {
    const urls = real('https://shop.example.com/products/foo');
    assert.equal(urlIsReal('https://shop.example.com/products/foo/reviews', urls), true);
  });

  test('a bare host root vouches for nothing on that host', () => {
    const urls = real('https://shop.example.com/');
    assert.equal(urlIsReal('https://shop.example.com/anything/at/all', urls), false);
  });
});

describe('urlIsReal — the YouTube hole (regression)', () => {
  // One real /watch URL must not vouch for unlimited invented video IDs, which
  // is what happens if you compare pathnames — the ID lives in the query
  // string, and URL.pathname excludes it.
  test('accepts the same video via a different YouTube URL form', () => {
    const urls = real('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(urlIsReal('https://youtu.be/dQw4w9WgXcQ', urls), true);
    assert.equal(urlIsReal('https://www.youtube.com/embed/dQw4w9WgXcQ', urls), true);
  });

  test('rejects a different video ID on the same host', () => {
    const urls = real('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(urlIsReal('https://www.youtube.com/watch?v=aaaaaaaaaaa', urls), false);
  });

  test('rejects a YouTube URL carrying no extractable video ID', () => {
    const urls = real('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(urlIsReal('https://www.youtube.com/results?search_query=umbreon', urls), false);
  });
});

describe('extractYouTubeId', () => {
  test('handles every URL shape the app encounters', () => {
    assert.equal(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30'), 'dQw4w9WgXcQ');
    assert.equal(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(extractYouTubeId('https://example.com/nope'), null);
    assert.equal(extractYouTubeId(null), null);
  });
});

describe('collectPrefetchUrls', () => {
  // Regression for the bug where honestly-cited pre-fetched sources were
  // silently deleted: those URLs never appear in a web_search_tool_result
  // block, so the filter had no idea they were real.
  test('gathers URLs from every pre-fetch block', () => {
    const urls = collectPrefetchUrls({
      cardData: { tcgplayerUrl: 'https://www.tcgplayer.com/product/1' },
      community: { posts: [{ url: 'https://www.reddit.com/r/PokemonTCG/comments/abc/title/' }] },
      creators: { videos: [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }] },
      ebay: { buy_it_now: [{ url: 'https://www.ebay.com/itm/1234567890' }], auction: [] },
      jp: { jpVideos: [{ url: 'https://www.youtube.com/watch?v=bbbbbbbbbbb' }] },
    });
    assert.equal(urls.size, 5);
    assert.equal(urlIsReal('https://www.reddit.com/r/PokemonTCG/comments/abc/title/', urls), true);
    assert.equal(urlIsReal('https://www.ebay.com/itm/1234567890', urls), true);
  });

  test('survives every block being absent', () => {
    assert.equal(collectPrefetchUrls({}).size, 0);
    assert.equal(collectPrefetchUrls().size, 0);
  });
});

describe('extractRealUrls', () => {
  test('reads only web_search_tool_result blocks', () => {
    const urls = extractRealUrls([
      { type: 'text', text: 'https://fake.example.com/nope' },
      {
        type: 'web_search_tool_result',
        content: [
          { type: 'web_search_result', url: 'https://real.example.com/page' },
          { type: 'other', url: 'https://ignored.example.com/x' },
        ],
      },
    ]);
    assert.equal(urls.size, 1);
    assert.equal(urls.has(normalizeUrl('https://real.example.com/page')), true);
  });

  test('survives a missing or empty content array', () => {
    assert.equal(extractRealUrls().size, 0);
    assert.equal(extractRealUrls([{ type: 'web_search_tool_result' }]).size, 0);
  });
});

describe('filterHallucinatedSources', () => {
  const urls = real('https://real.example.com/page');

  test('keeps verified sources, bins the rest, records the count', () => {
    const out = filterHallucinatedSources({
      signals: [{
        key: 'creator',
        sources: [
          { url: 'https://real.example.com/page' },
          { url: 'https://invented.example.com/made-up' },
        ],
      }],
    }, urls);
    assert.equal(out.signals[0].sources.length, 1);
    assert.equal(out.signals[0].dropped, 1);
    assert.equal(out._droppedTotal, 1);
  });

  test('separates "found nothing" from "rejected something"', () => {
    const out = filterHallucinatedSources({
      signals: [
        { key: 'editorial', sources: [] },
        { key: 'scarcity', sources: [{ url: 'https://invented.example.com/x' }] },
      ],
    }, urls);
    assert.equal(out.signals[0].dropped, 0);   // genuinely nothing found
    assert.equal(out.signals[1].dropped, 1);   // caught a fabrication
  });

  test('marks a response with no signals array as truncated', () => {
    const out = filterHallucinatedSources({}, urls);
    assert.deepEqual(out.signals, []);
    assert.equal(out._truncated, true);
  });
});
