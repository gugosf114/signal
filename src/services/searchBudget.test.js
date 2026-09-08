import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ANALYSIS_MAX_TOKENS,
  FIXED_SEARCH_TARGET,
  directSearchTool,
  selectSearchTargets,
} from './searchBudget.js';

describe('gateway search budget', () => {
  test('uses the same single research target when every prefetch is missing', () => {
    const targets = selectSearchTargets('yugioh', {
      catalysts: null,
      community: null,
      creators: null,
    });

    assert.deepEqual(targets, [FIXED_SEARCH_TARGET]);
  });

  test('uses the same single research target when every prefetch succeeds', () => {
    const targets = selectSearchTargets('yugioh', {
      catalysts: { banStatus: 'Limited' },
      community: [{ title: 'Reddit result' }],
      creators: [{ title: 'YouTube result' }],
    });

    assert.deepEqual(targets, [FIXED_SEARCH_TARGET]);
  });

  test('forces one direct search with no automatic code filtering', () => {
    assert.deepEqual(directSearchTool(), {
      type: 'web_search_20260209',
      name: 'web_search',
      max_uses: 1,
      allowed_callers: ['direct'],
    });
    for (const term of ['deck', 'tournament', 'review', 'community', 'creator', 'Japan']) {
      assert.match(FIXED_SEARCH_TARGET, new RegExp(term, 'i'));
    }
    assert.match(FIXED_SEARCH_TARGET, /Exclude eBay, stores, shops, and generic price listings/);
    assert.equal(ANALYSIS_MAX_TOKENS, 6000);
  });
});
