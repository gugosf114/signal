import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAGE_SWIPE_IGNORE_SELECTOR,
  pageAfterSwipe,
  pageSwipeDirection,
} from './pageSwipe.js';

test('a clear horizontal swipe chooses the page direction', () => {
  assert.equal(pageSwipeDirection(-90, 12), 'next');
  assert.equal(pageSwipeDirection(90, -12), 'previous');
});

test('short and mostly vertical gestures remain normal page scrolling', () => {
  assert.equal(pageSwipeDirection(-60, 3), null);
  assert.equal(pageSwipeDirection(-120, 100), null);
  assert.equal(pageSwipeDirection(Number.NaN, 0), null);
});

test('page swipes stop at Signal and Dossier instead of wrapping', () => {
  assert.equal(pageAfterSwipe('signal', 'previous'), 'signal');
  assert.equal(pageAfterSwipe('signal', 'next'), 'collection');
  assert.equal(pageAfterSwipe('collection', 'next'), 'dossier');
  assert.equal(pageAfterSwipe('dossier', 'previous'), 'collection');
  assert.equal(pageAfterSwipe('dossier', 'next'), 'dossier');
});

test('horizontal rows and overlays keep their own gestures', () => {
  for (const selector of ['.ns-track-outer', '.cb-set-strip', '.live-scanner', '.cl-backdrop', '.ac-backdrop']) {
    assert.match(PAGE_SWIPE_IGNORE_SELECTOR, new RegExp(selector.replace('.', '\\.')));
  }
});
