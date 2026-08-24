import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  focusCameraTrack,
  focusConstraintPlan,
  pickMainRearCamera,
  rearCameraConstraints,
} from './cameraFocus.js';

describe('camera focus', () => {
  test('requires the rear camera and asks for continuous focus at 1x', () => {
    const constraints = rearCameraConstraints(true);
    assert.equal(constraints.video.facingMode.exact, 'environment');
    assert.deepEqual(constraints.video.advanced, [{ focusMode: 'continuous' }, { zoom: 1 }]);
  });

  test('prefers the main rear lens over ultra-wide and front cameras', () => {
    const devices = [
      { kind: 'videoinput', deviceId: 'front', label: 'camera2 1, facing front' },
      { kind: 'videoinput', deviceId: 'ultra', label: 'rear ultra wide camera' },
      { kind: 'videoinput', deviceId: 'main', label: 'camera2 0, facing back' },
    ];
    assert.equal(pickMainRearCamera(devices, 'ultra').deviceId, 'main');
  });

  test('tap focus uses normalized coordinates and keeps 1x zoom', () => {
    const plan = focusConstraintPlan(
      { focusMode: ['single-shot', 'continuous'], zoom: { min: 0.5, max: 8 } },
      { pointsOfInterest: true },
      { x: 1.4, y: -0.2 },
    );
    assert.deepEqual(plan, {
      focusMode: 'single-shot',
      pointsOfInterest: [{ x: 1, y: 0 }],
      zoom: 1,
    });
  });

  test('uses the closest manual focus when continuous focus is unavailable', () => {
    const plan = focusConstraintPlan({
      focusMode: ['manual'],
      focusDistance: { min: 0, max: 10, step: 1 },
    });
    assert.deepEqual(plan, { focusMode: 'manual', focusDistance: 10 });
  });

  test('falls back to continuous focus when a WebView rejects tap coordinates', async () => {
    const calls = [];
    const track = {
      getCapabilities: () => ({ focusMode: ['single-shot', 'continuous'], zoom: { min: 0.5, max: 8 } }),
      applyConstraints: async (value) => {
        calls.push(value);
        if (calls.length === 1) throw new Error('points rejected');
      },
    };
    const result = await focusCameraTrack(track, { x: 0.5, y: 0.5 }, {
      getSupportedConstraints: () => ({ pointsOfInterest: true }),
    });
    assert.equal(result.applied, true);
    assert.equal(result.mode, 'continuous');
    assert.equal(calls.length, 2);
  });
});
