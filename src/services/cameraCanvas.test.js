import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { drawCameraFrame } from './cameraCanvas.js';

describe('camera canvas preview', () => {
  test('copies a live video frame into a plain canvas surface', () => {
    const calls = [];
    const video = { videoWidth: 1080, videoHeight: 1920 };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: (...args) => calls.push(args) }),
    };

    assert.equal(drawCameraFrame(video, canvas), true);
    assert.equal(canvas.width, 1080);
    assert.equal(canvas.height, 1920);
    assert.deepEqual(calls, [[video, 0, 0, 1080, 1920]]);
  });

  test('waits for real video dimensions instead of drawing a black frame', () => {
    const canvas = { getContext: () => ({ drawImage: () => assert.fail('must not draw') }) };
    assert.equal(drawCameraFrame({ videoWidth: 0, videoHeight: 0 }, canvas), false);
  });
});
