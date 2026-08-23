import React, { useCallback, useEffect, useRef, useState } from 'react';
import { computeVideoCrop } from '../services/scannerCrop';

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

  const stop = useCallback(() => {
    for (const track of streamRef.current?.getTracks?.() || []) track.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    setReady(false);
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Live camera is unavailable on this device.');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stop(); return; }
      video.srcObject = stream;
      await video.play();
      setReady(true);
    } catch (cameraError) {
      setError(cameraError?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow Camera for Signal, then retry.'
        : cameraError?.message || 'The camera could not open.');
    }
  }, [stop]);

  useEffect(() => {
    if (!open) { stop(); return; }
    start();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      stop();
      document.body.style.overflow = oldOverflow;
    };
  }, [open, start, stop]);

  if (!open) return null;

  const capture = async () => {
    const video = videoRef.current;
    const stage = stageRef.current;
    const frame = frameRef.current;
    if (!video || !stage || !frame || !ready || capturing) return;
    setCapturing(true);
    try {
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
        <video ref={videoRef} className="live-scanner-video" muted playsInline autoPlay />
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
            <div ref={frameRef} className="live-card-frame" aria-hidden>
              <i className="corner corner-tl" /><i className="corner corner-tr" />
              <i className="corner corner-bl" /><i className="corner corner-br" />
              <div className="live-number-guide">CARD NUMBER / SET CODE</div>
            </div>
            <div className="live-scanner-bottom">
              <span>{ready ? 'Card centered' : 'Opening camera…'}</span>
              <button type="button" className="live-shutter" onClick={capture} disabled={!ready || capturing} aria-label="Take card photo">
                <span />
              </button>
              <span>{capturing ? 'Capturing…' : 'Tap shutter'}</span>
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
