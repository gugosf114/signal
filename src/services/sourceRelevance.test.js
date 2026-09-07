import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  enforceExactCreatorSources,
  exactCreatorQuery,
  filterExactVideos,
  looseCreatorQuery,
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

const UMBREON = {
  game: 'pokemon',
  printingId: 'sv8pt5-161',
  setName: 'Prismatic Evolutions',
  setCode: 'PRE',
  number: '161',
  printedTotal: '131',
  rarity: 'Special Illustration Rare',
};

// The six real titles YouTube returned for the exact query on 2026-09-06.
const LIVE_TITLES = [
  ['UMBREON SIR Pulled From Prismatic Evolutions! #pokemoncards #pokemonopening', true],
  ['What Grade Did You Get? - Episode 23 - Umbreon SIR and Masterball from Prismatic Evolution', true],
  ['Umbreon Pull REACTION Prismatic Evolutions #shorts #short #pokemon', false],
  ['The Prismatic Evolutions GOD PACK', false],
  ['Top 20 Most Expensive Prismatic Evolutions Pokemon Cards (MARCH)', false],
  ['Pulling a $4000 umbreon special illustration rare from prismatic evolutions #pokemon', true],
];

describe('creator shorthand still pins the printing', () => {
  for (const [title, expected] of LIVE_TITLES) {
    test(`${expected ? 'keeps' : 'drops'} "${title.slice(0, 48)}"`, () => {
      assert.equal(sourceMatchesExactPrinting({ title }, 'Umbreon ex', UMBREON), expected);
    });
  }

  test('the base name alone with only the set is still ambiguous', () => {
    assert.equal(sourceMatchesExactPrinting({ title: 'Umbreon from Prismatic Evolutions' }, 'Umbreon ex', UMBREON), false);
  });

  test('a description can carry the anchor the title lacks', () => {
    const video = { title: 'Best pull of my life', description: 'Umbreon SIR 161/131 Prismatic Evolutions' };
    assert.equal(sourceMatchesExactPrinting(video, 'Umbreon ex', UMBREON), true);
  });

  test('magic and yu-gi-oh names are never shortened', () => {
    const lotus = { game: 'mtg', setName: 'Limited Edition Alpha', setCode: 'lea', number: '232', rarity: 'rare' };
    assert.equal(sourceMatchesExactPrinting({ title: 'Black Alpha pull' }, 'Black Lotus', lotus), false);
    assert.equal(sourceMatchesExactPrinting({ title: 'Black Lotus Alpha LEA-232 graded' }, 'Black Lotus', lotus), true);
    const rota = { game: 'yugioh', setName: 'Legendary Modern Decks 2026', number: 'L26D-ENS08', rarity: 'Starlight Rare' };
    assert.equal(sourceMatchesExactPrinting({ title: 'Reinforcement of the Army Starlight pull!' }, 'Reinforcement of the Army', rota), true);
    assert.equal(sourceMatchesExactPrinting({ title: 'Reinforcement of the Army combo guide' }, 'Reinforcement of the Army', rota), false);
  });

  test('the loose query reads like a creator title', () => {
    assert.equal(looseCreatorQuery('Umbreon ex', 'pokemon', UMBREON), 'Umbreon SIR Prismatic Evolutions');
    assert.equal(looseCreatorQuery('Black Lotus', 'mtg', { setName: 'Limited Edition Alpha', rarity: 'rare' }), 'Black Lotus rare Limited Edition Alpha');
  });

  test('a model-found video that pins the printing survives the creator gate', () => {
    const report = enforceExactCreatorSources({
      card_name: 'Umbreon ex',
      signals: [{ key: 'creator', level: 3, detail: 'Found by search.', sources: [
        { type: 'youtube', title: 'UMBREON SIR Pulled From Prismatic Evolutions!', url: 'https://www.youtube.com/watch?v=zzzzzzzzzzz' },
      ] }],
    }, { cardName: 'Umbreon ex', pin: UMBREON, creatorVideos: [] });
    assert.equal(report.signals[0].sources.length, 1);
    assert.equal(report.signals[0].level, 3);
  });
});
