import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  enforceExactCreatorSources,
  exactCreatorQuery,
  filterExactVideos,
  sourceMatchesExactPrinting,
} from './sourceRelevance.js';

const RAYQUAZA = {
  game: 'pokemon',
  printingId: 'ex3-97',
  setName: 'Dragon',
  sourceCode: 'DR',
  number: '97',
};

describe('exact creator evidence', () => {
  test('rejects the real PokeRev video about a different Rayquaza printing', () => {
    const video = { title: 'Opening a $500 Pokemon Box For The Rarest Rayquaza' };
    assert.equal(sourceMatchesExactPrinting(video, 'Rayquaza ex', RAYQUAZA), false);
    assert.deepEqual(filterExactVideos([video], 'Rayquaza ex', RAYQUAZA), []);
  });

  test('accepts a video that names the card and exact set', () => {
    const video = { title: 'Rayquaza ex from Pokemon Dragon DR-97 explained' };
    assert.equal(sourceMatchesExactPrinting(video, 'Rayquaza ex', RAYQUAZA), true);
  });

  test('search query carries the exact printing', () => {
    const query = exactCreatorQuery('Rayquaza ex', 'pokemon', RAYQUAZA);
    assert.match(query, /"Rayquaza ex"/);
    assert.match(query, /"Dragon"/);
    assert.match(query, /97/);
  });

  test('a broad cached creator source is removed and cannot keep its score', () => {
    const report = enforceExactCreatorSources({
      card_name: 'Rayquaza ex',
      printing: RAYQUAZA,
      signals: [{
        key: 'creator', level: 2, detail: 'PokeRev featured it.',
        sources: [{ type: 'youtube', title: 'Opening a $500 Pokemon Box For The Rarest Rayquaza', url: 'https://youtube.com/watch?v=L2sS9tM-0xI' }],
      }],
    });
    assert.equal(report.signals[0].level, 0);
    assert.equal(report.signals[0].sources.length, 0);
    assert.match(report.signals[0].detail, /No exact-print/);
  });

  test('the same verified video stays valid through a short YouTube URL', () => {
    const report = enforceExactCreatorSources({
      card_name: 'Rayquaza ex',
      signals: [{ key: 'creator', level: 3, detail: 'Exact video.', sources: [
        { type: 'youtube', title: 'Exact video', url: 'https://youtu.be/abcdefghijk' },
      ] }],
    }, {
      cardName: 'Rayquaza ex',
      pin: RAYQUAZA,
      creatorVideos: [{ url: 'https://www.youtube.com/watch?v=abcdefghijk' }],
    });
    assert.equal(report.signals[0].sources.length, 1);
    assert.equal(report.signals[0].level, 3);
  });
});
