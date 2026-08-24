import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { withScanKeepAlive } from './scanKeepAlive.js';

describe('scan keep-alive lease', () => {
  test('covers every awaited step and stops after the answer', async () => {
    const events = [];
    const value = await withScanKeepAlive(async () => {
      events.push('identify');
      await Promise.resolve();
      events.push('resolve');
      await Promise.resolve();
      events.push('analyze');
      return 72;
    }, {
      start: async () => events.push('start'),
      stop: async () => events.push('stop'),
    });
    assert.equal(value, 72);
    assert.deepEqual(events, ['start', 'identify', 'resolve', 'analyze', 'stop']);
  });

  test('stops when photo identification fails', async () => {
    const events = [];
    await assert.rejects(
      withScanKeepAlive(async () => {
        events.push('identify');
        throw new Error('unreadable card');
      }, {
        start: async () => events.push('start'),
        stop: async () => events.push('stop'),
      }),
      /unreadable card/,
    );
    assert.deepEqual(events, ['start', 'identify', 'stop']);
  });
});
