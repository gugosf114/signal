import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { shapeYouTubeItems } from './youtubeSearch.js';

describe('YouTube result shape', () => {
  test('Google and gateway answers become the same video rows', () => {
    const fromGoogle = shapeYouTubeItems([{ id: { videoId: 'abcdefghijk' }, snippet: { title: 'T', description: 'D', channelTitle: 'C', publishedAt: '2026-09-01T10:00:00Z' } }]);
    const fromGateway = shapeYouTubeItems([{ videoId: 'abcdefghijk', title: 'T', description: 'D', channel: 'C', publishedAt: '2026-09-01T10:00:00Z' }]);
    assert.deepEqual(fromGoogle, fromGateway);
    assert.equal(fromGoogle[0].url, 'https://www.youtube.com/watch?v=abcdefghijk');
    assert.equal(fromGoogle[0].date, '2026-09-01');
  });

  test('rows without a video id are dropped', () => {
    assert.deepEqual(shapeYouTubeItems([{ snippet: { title: 'playlist' } }, null]), []);
  });
});
