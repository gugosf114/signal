const BACK_LABEL = /back|rear|environment|camera2\s*0|camera\s*0/i;
const FRONT_LABEL = /front|user|selfie|camera2\s*1|camera\s*1/i;
const AUX_LABEL = /ultra|tele|macro|0[.,]5|0\.5/i;

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export function rearCameraConstraints(exact = true) {
  return {
    audio: false,
    video: {
      facingMode: exact ? { exact: 'environment' } : { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 30 },
      advanced: [{ focusMode: 'continuous' }, { zoom: 1 }],
    },
  };
}

export function pickMainRearCamera(devices, currentId = '') {
  const cameras = (Array.isArray(devices) ? devices : [])
    .filter((device) => device?.kind === 'videoinput' && !FRONT_LABEL.test(device.label || ''));
  if (!cameras.length) return null;
  const scored = cameras.map((device, index) => {
    const label = device.label || '';
    let score = -index;
    if (BACK_LABEL.test(label)) score += 20;
    if (/main|primary|camera2\s*0|camera\s*0/i.test(label)) score += 20;
    if (AUX_LABEL.test(label)) score -= 40;
    if (device.deviceId === currentId) score += 2;
    return { device, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].device;
}

export function focusConstraintPlan(capabilities = {}, supported = {}, point = null) {
  const plan = {};
  const modes = Array.isArray(capabilities.focusMode) ? capabilities.focusMode : [];
  if (point && modes.includes('single-shot')) plan.focusMode = 'single-shot';
  else if (modes.includes('continuous')) plan.focusMode = 'continuous';
  else if (modes.includes('manual') && capabilities.focusDistance) {
    plan.focusMode = 'manual';
    plan.focusDistance = capabilities.focusDistance.max;
  }

  if (point && supported.pointsOfInterest) {
    plan.pointsOfInterest = [{ x: clamp01(point.x), y: clamp01(point.y) }];
  }

  const zoom = capabilities.zoom;
  if (zoom && Number(zoom.min) <= 1 && Number(zoom.max) >= 1) plan.zoom = 1;
  return plan;
}

export async function focusCameraTrack(track, point = null, mediaDevices = navigator.mediaDevices) {
  if (!track?.applyConstraints) return { applied: false, focusSupported: false };
  const capabilities = track.getCapabilities?.() || {};
  const supported = mediaDevices?.getSupportedConstraints?.() || {};
  const plan = focusConstraintPlan(capabilities, supported, point);
  if (!Object.keys(plan).length) return { applied: false, focusSupported: false, capabilities };
  try {
    await track.applyConstraints({ advanced: [plan] });
    return {
      applied: true,
      focusSupported: Boolean(plan.focusMode),
      mode: plan.focusMode || null,
      capabilities,
    };
  } catch {
    // Some WebViews advertise points-of-interest but reject them. Retry with
    // the two constraints that most Samsung tracks accept: continuous focus
    // and 1× zoom (which avoids the fixed-focus ultra-wide lens).
    const fallback = focusConstraintPlan(capabilities, supported, null);
    if (!Object.keys(fallback).length) return { applied: false, focusSupported: false, capabilities };
    try {
      await track.applyConstraints({ advanced: [fallback] });
      return {
        applied: true,
        focusSupported: Boolean(fallback.focusMode),
        mode: fallback.focusMode || null,
        capabilities,
      };
    } catch {
      return { applied: false, focusSupported: false, capabilities };
    }
  }
}

export async function openFocusedRearCamera(mediaDevices = navigator.mediaDevices) {
  let stream;
  try {
    stream = await mediaDevices.getUserMedia(rearCameraConstraints(true));
  } catch (error) {
    if (error?.name !== 'OverconstrainedError' && error?.name !== 'NotFoundError') throw error;
    stream = await mediaDevices.getUserMedia(rearCameraConstraints(false));
  }

  let track = stream.getVideoTracks?.()[0];
  try {
    const devices = await mediaDevices.enumerateDevices();
    const currentId = track?.getSettings?.().deviceId || '';
    const preferred = pickMainRearCamera(devices, currentId);
    if (preferred?.deviceId && preferred.deviceId !== currentId) {
      for (const item of stream.getTracks?.() || []) item.stop();
      try {
        stream = await mediaDevices.getUserMedia({
          ...rearCameraConstraints(false),
          video: {
            ...rearCameraConstraints(false).video,
            deviceId: { exact: preferred.deviceId },
          },
        });
      } catch {
        // The old track has already been released. Reopen the logical rear
        // camera so a stale device list can never leave a black preview.
        stream = await mediaDevices.getUserMedia(rearCameraConstraints(false));
      }
      track = stream.getVideoTracks?.()[0];
    }
  } catch {
    // Device enumeration is optional. The exact rear-facing request above is
    // still valid when Android exposes only one logical back camera.
  }

  const focus = await focusCameraTrack(track, null, mediaDevices);
  return { stream, track, focus };
}
