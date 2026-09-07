import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalPokemonId, toPokemontcgId, toTcgdexId } from './pokemonIds.js';

describe('Pokémon catalogue id shapes', () => {
  test('the same modern card maps both ways', () => {
    assert.equal(toTcgdexId('sv8pt5-161'), 'sv08.5-161');
    assert.equal(toTcgdexId('sv8pt5-60'), 'sv08.5-060');
    assert.equal(toTcgdexId('sv7-198'), 'sv07-198');
    assert.equal(toTcgdexId('me1-1'), 'me01-001');
    assert.equal(toPokemontcgId('sv08.5-161'), 'sv8pt5-161');
    assert.equal(toPokemontcgId('sv08.5-060'), 'sv8pt5-60');
    assert.equal(toPokemontcgId('me02.5-014'), 'me2pt5-14');
  });

  test('older families are spelled the same on both catalogues', () => {
    for (const id of ['base1-4', 'ex10-112', 'xy10-55', 'swsh3-136', 'swsh12pt5-160']) {
      assert.equal(toTcgdexId(id), id);
      assert.equal(toPokemontcgId(id), id);
    }
  });

  test('identity is one string for both shapes', () => {
    assert.equal(canonicalPokemonId('sv08.5-161'), canonicalPokemonId('sv8pt5-161'));
    assert.equal(canonicalPokemonId('SV08.5-161'), 'sv8pt5-161');
  });

  test('unknown shapes pass through unchanged', () => {
    assert.equal(toTcgdexId('B2a-001'), 'B2a-001');
    assert.equal(toPokemontcgId('not an id'), 'not an id');
    assert.equal(toTcgdexId(''), '');
  });
});
