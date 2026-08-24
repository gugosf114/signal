import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { selectSearchTargets } from './searchBudget.js';

describe('gateway search budget', () => {
  test('never asks the two-search gateway for three searches', () => {
    const targets = selectSearchTargets('yugioh', {
      catalysts: null,
      community: null,
      creators: null,
    });

    assert.deepEqual(targets, [
      'Tournament / competitive usage + ban status',
      'Recent community coverage — Reddit',
    ]);
  });

  test('uses both remaining evidence gaps when catalyst data exists', () => {
    const targets = selectSearchTargets('yugioh', {
      catalysts: { banStatus: 'Limited' },
      community: null,
      creators: null,
    });

    assert.deepEqual(targets, [
      'Recent community coverage — Reddit',
      'Recent creator coverage — YouTube',
    ]);
  });
});
