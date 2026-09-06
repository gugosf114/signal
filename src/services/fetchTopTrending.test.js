import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTrendingCardsFromBody,
  pokemonArticleIdentity,
  selectPokemonTrendingCard,
  selectTcgplayerTrendingProduct,
} from './fetchTopTrending.js';

describe('exact TCGplayer trending parser', () => {
  test('ignores an intro hover card and keeps the actual Pokemon price card', () => {
    const body = `
      <card-hover-link card-name="Rayquaza ex (DR-97)" card-vertical="pokemon"></card-hover-link>
      <price-history-card card-id="Rayquaza-EX (ROS-104)" card-vertical="pokemon" data-embed="price-history">
      <price-history-card card-id="Rayquaza VMAX (EVS-218)" card-vertical="pokemon" data-embed="price-history">`;
    const refs = parseTrendingCardsFromBody(body, 'pokemon', 2);
    assert.deepEqual(refs.map((ref) => [ref.name, ref.sourceCode, ref.number]), [
      ['Rayquaza-EX', 'ROS', '104'],
      ['Rayquaza VMAX', 'EVS', '218'],
    ]);
  });

  test('keeps the Magic TCGplayer product id', () => {
    const body = '<price-history-card card-id="Optimus Prime, Hero" card-vertical="magic" variant-id="448845" variant-set="Universes Beyond: Transformers">';
    const [ref] = parseTrendingCardsFromBody(body, 'mtg', 1);
    assert.equal(ref.variantId, 448845);
    assert.equal(ref.variantSet, 'Universes Beyond: Transformers');
  });

  test('keeps the Yu-Gi-Oh product and rarity name', () => {
    const body = '<price-history-card card-id="Heat Wave (Quarter Century Secret Rare)" card-vertical="yugioh" variant-id="592579">';
    const [ref] = parseTrendingCardsFromBody(body, 'yugioh', 1);
    assert.equal(ref.name, 'Heat Wave');
    assert.equal(ref.variantId, 592579);
  });

  test('DR-97 can only select the Dragon printing, never Dragon Frontiers', () => {
    const ref = { ...pokemonArticleIdentity('Rayquaza ex (DR-97)') };
    const picked = selectPokemonTrendingCard([
      { id: 'ex15-97', name: 'Rayquaza ex δ', number: '97', set: { id: 'ex15', ptcgoCode: 'DF' } },
      { id: 'ex3-97', name: 'Rayquaza ex', number: '97', set: { id: 'ex3', ptcgoCode: 'DR' } },
    ], ref);
    assert.equal(picked.id, 'ex3-97');
  });

  test('product selection never falls back to another product with the same name', () => {
    const picked = selectTcgplayerTrendingProduct([
      { name: 'Heat Wave', tcgplayerProductId: 111 },
      { name: 'Heat Wave', tcgplayerProductId: 592579 },
    ], 592579);
    assert.equal(picked.tcgplayerProductId, 592579);
    assert.equal(selectTcgplayerTrendingProduct([{ tcgplayerProductId: 111 }], 592579), null);
  });
});
