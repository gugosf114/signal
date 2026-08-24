import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  expectedScanDurationMs,
  linearScanProgress,
  RUNNING_CEILING,
} from './scanProgress.js';

describe('scan progress', () => {
  test('equal time steps make equal progress steps', () => {
    const duration = 40000;
    const atTen = linearScanProgress(10000, duration);
    const atTwenty = linearScanProgress(20000, duration);
    const atThirty = linearScanProgress(30000, duration);

    assert.equal(atTwenty - atTen, atTen);
    assert.equal(atThirty - atTwenty, atTen);
  });

  test('a running scan cannot claim 100 percent', () => {
    assert.equal(linearScanProgress(999999, 1000), RUNNING_CEILING);
    assert.equal(linearScanProgress(999999, 1000, true), 100);
  });

  test('search-heavy Pokemon scans get more time than no-search scans', () => {
    assert.ok(expectedScanDurationMs('pokemon') > expectedScanDurationMs('mtg'));
    assert.ok(expectedScanDurationMs('pokemon') > expectedScanDurationMs('yugioh'));
  });
});
