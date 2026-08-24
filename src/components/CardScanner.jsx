import React, { useCallback, useEffect, useRef, useState } from 'react';
import { computeVideoCrop } from '../services/scannerCrop';
import { focusCameraTrack, openFocusedRearCamera } from '../services/cameraFocus';
import { setScannerOverlayProtection } from '../services/scannerDisplay';

function canvasFile(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('The card photo could not be captured.'));
      else resolve(new File([blob], `signal-card-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  });
}

export default function CardScanner({ open, onCancel, onCapture }) {
  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const frameRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [focusSupported, setFocusSupported] = useState(false);
  const [focusPoint, setFocusPoint] = useState(null);
  const [focusMessage, setFocusMessage] = useState('');

  const stop = useCallback(() => {
    for (const track of streamRef.current?.getTracks?.() || []) track.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    setReady(false);
    setError(null);
    setCapturing(false);
    setFocusPoint(null);
    setFocusMessage('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Live camera is unavailable on this device.');
      const { stream, track, focus } = await openFocusedRearCamera(navigator.mediaDevices);
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stop(); return; }
      video.srcObject = stream;
      await video.play();
      setFocusSupported(Boolean(focus?.focusSupported));
      setFocusMessage(focus?.focusSupported ? 'Auto focus on' : 'Hold phone a little farther back');
      // One bounded diagnostic line makes future phone-specific camera faults
      // visible in logcat without exposing a device identifier.
      const settings = track?.getSettings?.() || {};
      console.info('[signal] camera configured', {
        width: settings.width,
        height: settings.height,
        facingMode: settings.facingMode,
        focusMode: settings.focusMode || focus?.mode || null,
        zoom: settings.zoom || null,
      });
      setReady(true);
    } catch (cameraError) {
      setError(cameraError?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow Camera for Signal, then retry.'
        : cameraError?.message || 'The camera could not open.');
    }
  }, [stop]);

  useEffect(() => {
    if (!open) { stop(); return; }
    setScannerOverlayProtection(true);
    start();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      stop();
      setScannerOverlayProtection(false);
      document.body.style.overflow = oldOverflow;
    };
  }, [open, start, stop]);

  if (!open) return null;

  const requestFocus = async (event = null) => {
    const frame = frameRef.current;
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!frame || !track || !ready || capturing) return;
    const box = frame.getBoundingClientRect();
    const point = event ? {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    } : { x: 0.5, y: 0.5 };
    setFocusPoint({ x: Math.max(0, Math.min(1, point.x)), y: Math.max(0, Math.min(1, point.y)), key: Date.now() });
    setFocusMessage('Focusing…');
    const result = await focusCameraTrack(track, point, navigator.mediaDevices);
    setFocusSupported(Boolean(result.focusSupported));
    setFocusMessage(result.focusSupported ? 'Focused' : 'Hold phone a little farther back');
  };

  const capture = async () => {
    const video = videoRef.current;
    const stage = stageRef.current;
    const frame = frameRef.current;
    if (!video || !stage || !frame || !ready || capturing) return;
    setCapturing(true);
    try {
      // Give the lens one final center focus before freezing the frame. A short
      // pause is cheaper than sending an unreadable card code to vision.
      await requestFocus();
      await new Promise((resolve) => setTimeout(resolve, 450));
      const stageBox = stage.getBoundingClientRect();
      const frameBox = frame.getBoundingClientRect();
      const crop = computeVideoCrop(
        video.videoWidth, video.videoHeight, stageBox.width, stageBox.height,
        { x: frameBox.left - stageBox.left, y: frameBox.top - stageBox.top, width: frameBox.width, height: frameBox.height }
      );
      if (!crop) throw new Error('The card frame could not be read.');
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(crop.width));
      canvas.height = Math.max(1, Math.round(crop.height));
      canvas.getContext('2d').drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
      const file = await canvasFile(canvas);
      stop();
      await onCapture?.(file);
    } catch (captureError) {
      setError(captureError?.message || 'The card photo could not be captured.');
      setCapturing(false);
    }
  };

  const cancel = () => { stop(); onCancel?.(); };

  return (
    <div className="live-scanner" role="dialog" aria-modal="true" aria-label="Scan a trading card">
      <div ref={stageRef} className="live-scanner-stage">
        <video
          ref={videoRef}
          className="live-scanner-video"
          muted
          playsInline
          autoPlay
          controls={false}
          disablePictureInPicture
          onContextMenu={(event) => event.preventDefault()}
        />
        <div className="live-scanner-topbar">
          <button type="button" onClick={cancel}>Cancel</button>
          <strong>Scan card</strong>
          <span aria-hidden />
        </div>

        {!error && (
          <>
            <div className="live-scanner-copy">
              <strong>Fit the whole card inside the frame</strong>
              <span>Hold still. Avoid glare over the small printed code.</span>
            </div>
            <div
              ref={frameRef}
              className="live-card-frame"
              role="button"
              tabIndex={0}
              aria-label="Tap card to focus"
              onPointerDown={requestFocus}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  requestFocus();
                }
              }}
            >
              <i className="corner corner-tl" /><i className="corner corner-tr" />
              <i className="corner corner-bl" /><i className="corner corner-br" />
              <div className="live-number-guide">CARD NUMBER / SET CODE</div>
              {focusPoint && (
                <span
                  key={focusPoint.key}
                  className="live-focus-ring"
                  style={{ left: `${focusPoint.x * 100}%`, top: `${focusPoint.y * 100}%` }}
                  aria-hidden
                />
              )}
            </div>
            <div className="live-scanner-bottom">
              <span>{ready ? (focusSupported ? 'Tap card to focus' : focusMessage) : 'Opening camera…'}</span>
              <button type="button" className="live-shutter" onClick={capture} disabled={!ready || capturing} aria-label="Take card photo">
                <span aria-hidden>
                  <svg viewBox="0 0 24 24">
                    <path d="M4 7.5h3l1.4-2h7.2l1.4 2h3v11H4z" />
                    <circle cx="12" cy="13" r="3.6" />
                  </svg>
                </span>
              </button>
              <span>{capturing ? 'Capturing…' : (focusMessage || 'Take photo')}</span>
            </div>
          </>
        )}

        {error && (
          <div className="live-scanner-error">
            <strong>Camera did not open</strong>
            <p>{error}</p>
            <button type="button" onClick={start}>Retry</button>
            <button type="button" onClick={cancel}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
