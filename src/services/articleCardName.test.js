import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractCardNames } from './articleCardName.js';

describe('extractCardNames', () => {
  test('pulls a curly-quoted card name', () => {
    const got = extractCardNames('Party On With “Ultimate Demon’s Dive”! [RD/KP26]', 'yugioh');
    assert.equal(got[0], 'Ultimate Demon’s Dive');
  });

  test('pulls the name after ft.', () => {
    const got = extractCardNames('Clown Crew at Full Power, ft. Assault Lion and BETB Support [CDP]', 'yugioh');
    assert.ok(got.includes('Assault Lion'));
  });

  test('pokemon deck guides yield each named deck', () => {
    const got = extractCardNames('Dragapult ex/Blaziken ex Deck Guide (Pokémon TCG)', 'pokemon', 4);
    assert.deepEqual(got.slice(0, 2), ['Dragapult ex', 'Blaziken ex']);
  });

  test('mtg column prefixes are dropped and the tail is offered', () => {
    const got = extractCardNames('The Power of Pauper: Dreams in Ephemerate', 'mtg', 3);
    assert.ok(got.includes('Ephemerate'));
  });

  test('bracket tags never become candidates on their own', () => {
    const got = extractCardNames('[Master Duel] WCS Update', 'yugioh', 4);
    assert.ok(!got.some((n) => n.includes('[')));
    assert.ok(!got.includes('Master Duel'));
  });

  test('empty and junk input stay empty', () => {
    assert.deepEqual(extractCardNames('', 'mtg'), []);
    assert.deepEqual(extractCardNames(null, 'mtg'), []);
    assert.deepEqual(extractCardNames('a', 'mtg'), []);
  });

  test('respects the limit', () => {
    const got = extractCardNames('Take “A Journey Back to the Light” and “Zenet”!', 'yugioh', 1);
    assert.equal(got.length, 1);
  });
});
