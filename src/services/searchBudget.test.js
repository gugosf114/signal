import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ANALYSIS_MAX_TOKENS,
  FIXED_SEARCH_TARGET,
  directSearchTool,
  selectSearchTargets,
} from './searchBudget.js';

describe('gateway search budget', () => {
  test('uses the English and Japanese research targets when every prefetch is missing', () => {
    const targets = selectSearchTargets('yugioh', {
      catalysts: null,
      community: null,
      creators: null,
    });

    assert.equal(targets.length, 2);
    assert.equal(targets[0], FIXED_SEARCH_TARGET);
    assert.match(targets[1], /SEPARATE Japanese-language/);
  });

  test('uses the English and Japanese research targets when every prefetch succeeds', () => {
    const targets = selectSearchTargets('yugioh', {
      catalysts: { banStatus: 'Limited' },
      community: [{ title: 'Reddit result' }],
      creators: [{ title: 'YouTube result' }],
    });

    assert.equal(targets.length, 2);
    assert.equal(targets[0], FIXED_SEARCH_TARGET);
    assert.match(targets[1], /SEPARATE Japanese-language/);
  });

  test('allows two direct searches with no automatic code filtering', () => {
    assert.deepEqual(directSearchTool(), {
      type: 'web_search_20260209',
      name: 'web_search',
      max_uses: 2,
      allowed_callers: ['direct'],
    });
    for (const term of ['deck', 'tournament', 'review', 'community', 'creator', 'Japan']) {
      assert.match(FIXED_SEARCH_TARGET, new RegExp(term, 'i'));
    }
    assert.match(FIXED_SEARCH_TARGET, /Exclude eBay, stores, shops, and generic price listings/);
    assert.equal(ANALYSIS_MAX_TOKENS, 6000);
  });
});
