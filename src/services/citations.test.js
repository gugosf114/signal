// Tests for the evidence lock — the only thing standing between model-written
// source fields and the user's report.
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
  extractYouTubeId,
  extractSearchEvidence,
  collectPrefetchEvidence,
  mergeEvidenceRegistries,
  lockSourcesToEvidence,
  fillEvidenceGaps,
  reportEvidenceStats,
  buildVerifiedSummary,
} from './citations.js';

describe('extractYouTubeId', () => {
  test('handles every URL shape the app encounters', () => {
    assert.equal(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30'), 'dQw4w9WgXcQ');
    assert.equal(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(extractYouTubeId('https://example.com/nope'), null);
    assert.equal(extractYouTubeId(null), null);
  });
});

describe('locked evidence records', () => {
  const keys = ['creator', 'community', 'ip_momentum', 'editorial', 'competitive', 'scarcity', 'jp_hype', 'jp_release'];
  const deltiaUrl = 'https://deltiasgaming.com/pokemon-tcg-best-shedinja-deck-guide-mega-evolution/';

  test('native web citations become locked title and quoted evidence text', () => {
    const registry = extractSearchEvidence([{
      type: 'text',
      text: 'A cited statement.',
      citations: [{
        type: 'web_search_result_location',
        title: 'Real tournament page',
        url: 'https://limitlesstcg.com/cards/MEG/144/decklists/jp',
        cited_text: '12th place at a City League event.',
      }],
    }]);
    const locked = lockSourcesToEvidence({
      signals: [{ key: 'competitive', level: 2, detail: 'model', sources: [{
        url: 'https://limitlesstcg.com/cards/MEG/144/decklists/jp', implication: 'neutral',
      }] }],
    }, registry);
    assert.equal(locked.signals[0].sources[0].title, 'Real tournament page');
    assert.equal(locked.signals[0].sources[0].summary, '12th place at a City League event.');
    assert.equal(locked.signals[0].detail, '12th place at a City League event.');
  });

  test('the Shedinja failure cannot count one page as two sourced areas', () => {
    const search = extractSearchEvidence([{
      type: 'web_search_tool_result',
      content: [{
        type: 'web_search_result',
        title: 'Pokemon TCG: Best Shedinja Deck Guide (Mega Evolution) - Deltia\'s Gaming',
        url: deltiaUrl,
        page_age: 'September 30, 2025',
      }],
    }]);
    const report = {
      summary: 'Model-written summary must not survive.',
      signals: keys.map((key) => ({
        key,
        level: 4,
        detail: 'Model-written claim must not survive.',
        sources: ['editorial', 'competitive'].includes(key) ? [{
          type: 'made-up',
          source: 'Invented publisher',
          title: 'Invented title',
          date: '2099-01-01',
          summary: 'Invented source summary',
          implication: key === 'editorial' ? 'up' : 'neutral',
          url: deltiaUrl,
          reach: 'T1',
          audience: '9 million',
        }] : [],
      })),
    };

    const locked = lockSourcesToEvidence(report, search);
    const editorial = locked.signals.find((signal) => signal.key === 'editorial');
    const empty = locked.signals.find((signal) => signal.key === 'creator');
    assert.equal(editorial.sources[0].source, "Deltia's Gaming");
    assert.equal(editorial.sources[0].title, 'Pokemon TCG: Best Shedinja Deck Guide (Mega Evolution) - Deltia\'s Gaming');
    assert.equal(editorial.sources[0].date, 'September 30, 2025');
    assert.equal(editorial.sources[0].summary, '');
    assert.equal(editorial.sources[0].audience, null);
    assert.equal(editorial.sources[0].reach, 'unknown');
    assert.doesNotMatch(editorial.detail, /Model-written/);
    assert.equal(empty.level, 0);
    assert.equal(empty.sources.length, 0);
    assert.equal(empty.detail, 'No verified evidence was retrieved for this area.');
    assert.deepEqual(reportEvidenceStats(locked.signals), {
      sourcedSignalCount: 1,
      expectedSignalCount: 8,
      uniqueSourceCount: 1,
    });
    assert.equal(locked._evidenceVersion, 1);
  });

  test('an unknown URL is rejected and its model claim is erased', () => {
    const locked = lockSourcesToEvidence({
      signals: [{
        key: 'scarcity',
        level: 5,
        detail: 'Only ten copies exist.',
        sources: [{ url: 'https://invented.example/not-real', implication: 'up' }],
      }],
    }, new Map());
    assert.equal(locked.signals[0].level, 0);
    assert.equal(locked.signals[0].sources.length, 0);
    assert.equal(locked.signals[0].dropped, 1);
    assert.doesNotMatch(locked.signals[0].detail, /ten copies/i);
  });

  test('one retrieved path cannot unlock a fabricated sibling or deeper path', () => {
    const registry = extractSearchEvidence([{
      type: 'web_search_tool_result',
      content: [{ type: 'web_search_result', title: 'Real page', url: 'https://shop.example.com/products/foo' }],
    }]);
    for (const url of [
      'https://shop.example.com/products-fake',
      'https://shop.example.com/products/foo/reviews',
    ]) {
      const locked = lockSourcesToEvidence({
        signals: [{ key: 'scarcity', level: 5, detail: 'fake', sources: [{ url, implication: 'up' }] }],
      }, registry);
      assert.equal(locked.signals[0].sources.length, 0);
      assert.equal(locked.signals[0].level, 0);
    }
  });

  test('YouTube matches the same video ID but never a different video', () => {
    const registry = collectPrefetchEvidence({ creators: { videos: [{
      channel: 'Real Channel', title: 'Real video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    }] } });
    const report = (url) => lockSourcesToEvidence({
      signals: [{ key: 'creator', level: 4, detail: 'model', sources: [{ url, implication: 'up' }] }],
    }, registry);
    assert.equal(report('https://youtu.be/dQw4w9WgXcQ').signals[0].sources.length, 1);
    assert.equal(report('https://www.youtube.com/watch?v=aaaaaaaaaaa').signals[0].sources.length, 0);
  });

  test('pre-fetched metadata replaces every model-owned source field', () => {
    const prefetch = collectPrefetchEvidence({
      creators: { videos: [{
        channel: 'Real Channel',
        title: 'Real Umbreon video',
        description: 'The real API description.',
        date: '2026-09-01',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }] },
    });
    const registry = mergeEvidenceRegistries(new Map(), prefetch);
    const locked = lockSourcesToEvidence({
      signals: [{
        key: 'creator', level: 5, detail: 'fake', sources: [{
          url: 'https://youtu.be/dQw4w9WgXcQ', implication: 'up',
          source: 'Fake Channel', title: 'Fake title', summary: 'Fake summary',
        }],
      }],
    }, registry);
    assert.deepEqual(locked.signals[0].sources[0], {
      type: 'youtube',
      source: 'Real Channel',
      title: 'Real Umbreon video',
      date: '2026-09-01',
      summary: 'The real API description.',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      reach: 'unknown',
      audience: null,
      implication: 'up',
    });
    assert.equal(locked.signals[0].detail, 'The real API description.');
  });

  test('the report summary is built from trusted price history and source counts', () => {
    const summary = buildVerifiedSummary({
      cardName: 'Shedinja',
      prices: { en_price: '$3.38', history: { change30: -1.2, sold30: 615 } },
      signals: [{ key: 'editorial', sources: [{ url: deltiaUrl }] }],
    });
    assert.equal(summary, 'Shedinja is $3.38 for this exact printing. Its market price moved -1.2% over 30 days with 615 copies sold. 1 of 8 research areas has verified evidence from 1 unique source.');
  });

  test('real eBay rows replace model-modified listing fields', () => {
    const locked = lockSourcesToEvidence({
      signals: [],
      ebay_listings: { buy_it_now: [{ title: 'fake', price_usd: 1, url: 'https://www.ebay.com/itm/123' }], auction: [] },
    }, new Map(), {
      ebay: { buy_it_now: [{ title: 'real', price_usd: 25, url: 'https://www.ebay.com/itm/123' }], auction: [] },
    });
    assert.equal(locked.ebay_listings.buy_it_now[0].title, 'real');
    assert.equal(locked.ebay_listings.buy_it_now[0].price_usd, 25);
  });

  test('one paid search result page can fill several areas without extra searches', () => {
    const results = [
      ['YouTube Shedinja Mega Evolution deck', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
      ['Shedinja deck discussion', 'https://www.reddit.com/r/PTCGL/comments/abc/shedinja_deck/'],
      ['Shedinja Mega Evolution Decklists', 'https://pokemoncard.io/category/pokemon/shedinja-me1-144'],
      ['Shedinja Mega Evolution review and guide', 'https://example.org/shedinja-mega-evolution-guide'],
      ['Shedinja PSA population report', 'https://www.psacard.com/pop/tcg-cards/2025/shedinja/12345'],
      ['Shedinja anime character spotlight', 'https://example.net/shedinja-anime-spotlight'],
      ['Shedinja Japanese release date', 'https://example.jp/shedinja-japanese-release-date'],
      ['ヌケニン (Shedinja) Mega Evolution デッキ', 'https://example.jp/shedinja-deck'],
      ['Shedinja 144/132 for sale', 'https://www.ebay.com/itm/123'],
      ['Shedinja 144/132', 'https://www.tcgplayer.com/product/654483'],
    ].map(([title, url]) => ({ type: 'web_search_result', title, url }));
    const registry = extractSearchEvidence([{ type: 'web_search_tool_result', content: results }]);
    const report = lockSourcesToEvidence({
      signals: keys.map((key) => ({ key, level: 0, detail: 'none', sources: [] })),
    }, registry, { cardName: 'Shedinja', pin: { name: 'Shedinja', setName: 'Mega Evolution', number: '144' } });
    fillEvidenceGaps(report, registry, { cardName: 'Shedinja', pin: { name: 'Shedinja', setName: 'Mega Evolution', number: '144' } });
    assert.deepEqual(reportEvidenceStats(report.signals), {
      sourcedSignalCount: 8,
      expectedSignalCount: 8,
      uniqueSourceCount: 8,
    });
    const used = new Set(report.signals.flatMap((signal) => signal.sources.map((source) => source.url)));
    assert.equal([...used].some((url) => url.includes('ebay.com')), false);
    assert.equal([...used].some((url) => url.includes('tcgplayer.com')), false);
    assert.equal(report.signals.every((signal) => signal.level === 0), true);
  });
});
