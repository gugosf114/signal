import React, { useCallback, useEffect, useRef, useState } from 'react';
import { drawCameraFrame } from '../services/cameraCanvas';
import { computeVideoCrop } from '../services/scannerCrop';
import {
  cameraTorchSupported,
  focusCameraTrack,
  openFocusedRearCamera,
  setCameraTorch,
} from '../services/cameraFocus';
import { scannerMatchDetails, scannerMatchMeta, scannerMatchPrice } from '../services/scannerMatch';
import { setScannerOverlayProtection } from '../services/scannerDisplay';

function canvasFile(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('The card photo could not be captured.'));
      else resolve(new File([blob], `signal-card-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  });
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 7.5h3l1.4-2h7.2l1.4 2h3v11H4z" />
      <circle cx="12" cy="13" r="3.6" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m5 18 5-5 3 3 2-2 4 4" />
    </svg>
  );
}

function FlashIcon({ on }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M13.5 2 5 13h6l-.5 9L19 10h-6z" fill={on ? 'currentColor' : 'none'} />
    </svg>
  );
}

export default function CardScanner({ open, onCancel, onIdentify, onConfirm, onManualSearch }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const frameRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const imageCaptureRef = useRef(null);
  const abortRef = useRef(null);
  const previewRef = useRef(null);
  const previewLoopRef = useRef(null);
  const previewTimerRef = useRef(null);
  const previewPausedRef = useRef(false);
  const cameraTokenRef = useRef(0);
  const [phase, setPhase] = useState('opening');
  const [error, setError] = useState(null);
  const [match, setMatch] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [focusSupported, setFocusSupported] = useState(false);
  const [focusPoint, setFocusPoint] = useState(null);
  const [focusMessage, setFocusMessage] = useState('');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const clearPreview = useCallback(() => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
  }, []);

  const showPreview = useCallback((file) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setPreviewUrl(url);
  }, []);

  const stop = useCallback(() => {
    cameraTokenRef.current += 1;
    if (previewLoopRef.current != null) cancelAnimationFrame(previewLoopRef.current);
    previewLoopRef.current = null;
    if (previewTimerRef.current != null) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = null;
    previewPausedRef.current = true;
    imageCaptureRef.current = null;
    for (const track of streamRef.current?.getTracks?.() || []) track.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const canvas = canvasRef.current;
    if (canvas?.width && canvas?.height) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const start = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    stop();
    setPhase('opening');
    setError(null);
    setMatch(null);
    setFocusPoint(null);
    setFocusMessage('');
    setFocusSupported(false);
    setTorchSupported(false);
    setTorchOn(false);
    previewPausedRef.current = false;
    const cameraToken = ++cameraTokenRef.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Live camera is unavailable on this device.');
      const { stream, track, focus } = await openFocusedRearCamera(navigator.mediaDevices);
      if (cameraToken !== cameraTokenRef.current) {
        for (const item of stream.getTracks?.() || []) item.stop();
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video || !canvasRef.current) { stop(); return; }
      let previewMode = 'video-fallback';
      if (typeof globalThis.ImageCapture === 'function') {
        try {
          const imageCapture = new globalThis.ImageCapture(track);
          imageCaptureRef.current = imageCapture;
          const firstFrame = await imageCapture.grabFrame();
          if (cameraToken !== cameraTokenRef.current) {
            firstFrame.close?.();
            return;
          }
          drawCameraFrame(firstFrame, canvasRef.current);
          firstFrame.close?.();
          previewMode = 'image-capture';
          const paint = async () => {
            if (cameraToken !== cameraTokenRef.current || imageCaptureRef.current !== imageCapture) return;
            try {
              const frame = await imageCapture.grabFrame();
              if (cameraToken === cameraTokenRef.current) drawCameraFrame(frame, canvasRef.current);
              frame.close?.();
            } catch {
              // One dropped preview frame is harmless. The next frame retries.
            }
            if (cameraToken === cameraTokenRef.current && !previewPausedRef.current) {
              previewTimerRef.current = setTimeout(paint, 66);
            }
          };
          previewTimerRef.current = setTimeout(paint, 66);
        } catch {
          imageCaptureRef.current = null;
        }
      }
      if (!imageCaptureRef.current) {
        video.srcObject = stream;
        await video.play();
        let lastFrameAt = 0;
        const paint = (time) => {
          if (cameraToken !== cameraTokenRef.current) return;
          if (time - lastFrameAt >= 32) {
            drawCameraFrame(video, canvasRef.current);
            lastFrameAt = time;
          }
          previewLoopRef.current = requestAnimationFrame(paint);
        };
        previewLoopRef.current = requestAnimationFrame(paint);
      }
      setFocusSupported(Boolean(focus?.focusSupported));
      setFocusMessage(focus?.focusSupported ? 'Auto focus on' : 'Hold the phone a little farther back');
      setTorchSupported(cameraTorchSupported(track));
      const settings = track?.getSettings?.() || {};
      console.info('[signal] scanner ready', {
        width: settings.width,
        height: settings.height,
        facingMode: settings.facingMode,
        focusMode: settings.focusMode || focus?.mode || null,
        zoom: settings.zoom || null,
        previewMode,
      });
      setPhase('ready');
    } catch (cameraError) {
      setError({
        title: 'Camera did not open',
        message: cameraError?.name === 'NotAllowedError'
          ? 'Allow Camera for Signal, then try again.'
          : cameraError?.message || 'The camera could not open.',
      });
      setPhase('error');
    }
  }, [stop]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      stop();
      clearPreview();
      return undefined;
    }
    setScannerOverlayProtection(true);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    start();
    const escape = (event) => { if (event.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', escape);
    return () => {
      abortRef.current?.abort();
      stop();
      clearPreview();
      setScannerOverlayProtection(false);
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', escape);
    };
  }, [open, start, stop, clearPreview]);

  if (!open) return null;

  const requestFocus = async (event = null) => {
    const frame = frameRef.current;
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!frame || !track || phase !== 'ready') return;
    const box = frame.getBoundingClientRect();
    const point = event ? {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    } : { x: 0.5, y: 0.5 };
    const safePoint = {
      x: Math.max(0, Math.min(1, point.x)),
      y: Math.max(0, Math.min(1, point.y)),
    };
    setFocusPoint({ ...safePoint, key: Date.now() });
    setFocusMessage('Focusing…');
    const result = await focusCameraTrack(track, safePoint, navigator.mediaDevices);
    setFocusSupported(Boolean(result.focusSupported));
    setFocusMessage(result.focusSupported ? 'Focused' : 'Hold the phone a little farther back');
  };

  const identify = async (file, framed) => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    showPreview(file);
    stop();
    setTorchOn(false);
    setError(null);
    setMatch(null);
    setPhase('identifying');
    try {
      if (!onIdentify) throw new Error('Card identification is unavailable.');
      const found = await onIdentify(file, { framed, signal: controller.signal });
      if (controller.signal.aborted) return;
      setMatch({ ...found, file });
      setPhase('match');
    } catch (scanError) {
      if (controller.signal.aborted) return;
      console.error('[signal] card image scan failed', scanError);
      setError({
        title: 'Card not matched',
        message: scanError?.message || 'Signal could not identify this card.',
      });
      setPhase('error');
    }
  };

  const capture = async () => {
    const stage = stageRef.current;
    const frame = frameRef.current;
    const track = streamRef.current?.getVideoTracks?.()[0];
    const video = videoRef.current;
    if (!stage || !frame || !track || phase !== 'ready') return;
    setPhase('capturing');
    previewPausedRef.current = true;
    if (previewTimerRef.current != null) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = null;
    try {
      await focusCameraTrack(track, { x: 0.5, y: 0.5 }, navigator.mediaDevices);
      await new Promise((resolve) => setTimeout(resolve, 350));
      const bitmap = imageCaptureRef.current ? await imageCaptureRef.current.grabFrame() : null;
      const source = bitmap || video;
      const sourceWidth = source?.width || source?.videoWidth;
      const sourceHeight = source?.height || source?.videoHeight;
      if (!source || !sourceWidth || !sourceHeight) throw new Error('The live camera frame was empty.');
      const stageBox = stage.getBoundingClientRect();
      const frameBox = frame.getBoundingClientRect();
      const crop = computeVideoCrop(
        sourceWidth, sourceHeight, stageBox.width, stageBox.height,
        { x: frameBox.left - stageBox.left, y: frameBox.top - stageBox.top, width: frameBox.width, height: frameBox.height },
      );
      if (!crop) {
        bitmap?.close?.();
        throw new Error('The card frame could not be read.');
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(crop.width));
      canvas.height = Math.max(1, Math.round(crop.height));
      canvas.getContext('2d').drawImage(
        source, crop.x, crop.y, crop.width, crop.height,
        0, 0, canvas.width, canvas.height,
      );
      bitmap?.close?.();
      await identify(await canvasFile(canvas), true);
    } catch (captureError) {
      setError({ title: 'Photo failed', message: captureError?.message || 'The card photo could not be captured.' });
      setPhase('error');
    }
  };

  const choosePhoto = () => fileInputRef.current?.click();

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = '';
    if (file) await identify(file, false);
  };

  const scanAgain = () => {
    abortRef.current?.abort();
    clearPreview();
    start();
  };

  const cancel = () => {
    abortRef.current?.abort();
    stop();
    clearPreview();
    onCancel?.();
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    const result = await setCameraTorch(track, !torchOn);
    if (result.applied) setTorchOn(result.enabled);
    else setFocusMessage('Flash is unavailable');
  };

  const confirm = async () => {
    if (!match?.pin || !onConfirm) return;
    setPhase('launching');
    try {
      await onConfirm(match);
    } catch (confirmError) {
      setError({ title: 'Signal did not open', message: confirmError?.message || 'Try the card again.' });
      setPhase('error');
    }
  };

  const details = scannerMatchDetails(match || {});
  const cameraVisible = phase === 'opening' || phase === 'ready' || phase === 'capturing';

  return (
    <div className={`live-scanner live-scanner--${phase}`} role="dialog" aria-modal="true" aria-label="Scan a trading card">
      <div ref={stageRef} className="live-scanner-stage">
        <input ref={fileInputRef} type="file" accept="image/*" className="live-scanner-file" onChange={handleFile} />
        {previewUrl ? (
          <img className="live-scanner-preview" src={previewUrl} alt="Card photo being checked" />
        ) : (
          <>
            <canvas ref={canvasRef} className="live-scanner-video" aria-hidden="true" />
            <video
              ref={videoRef}
              className="live-scanner-source"
              muted
              playsInline
              autoPlay
              controls={false}
              tabIndex={-1}
              aria-hidden="true"
              disablePictureInPicture
              disableRemotePlayback
              onContextMenu={(event) => event.preventDefault()}
            />
          </>
        )}

        <div className="live-scanner-topbar">
          <button type="button" onClick={cancel}>Cancel</button>
          <strong>Scan card</strong>
          <span className="live-scanner-auto">AUTO</span>
        </div>

        {cameraVisible && !error && (
          <>
            <div className="live-scanner-copy" aria-live="polite">
              <strong>{phase === 'opening' ? 'Opening camera…' : phase === 'capturing' ? 'Hold still…' : 'Fill the frame with one card'}</strong>
              <span>Use a plain background. Keep every card edge visible.</span>
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
              <div className="live-number-guide">SET / NUMBER</div>
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
              <button type="button" className="live-tool-button" onClick={choosePhoto} aria-label="Choose a saved card photo">
                <GalleryIcon /><span>Photos</span>
              </button>
              <button type="button" className="live-shutter" onClick={capture} disabled={phase !== 'ready'} aria-label="Scan this card">
                <span><CameraIcon /></span>
              </button>
              <button
                type="button"
                className={`live-tool-button ${torchOn ? 'live-tool-button--on' : ''}`}
                onClick={toggleTorch}
                disabled={!torchSupported || phase !== 'ready'}
                aria-label={torchOn ? 'Turn flash off' : 'Turn flash on'}
                aria-pressed={torchOn}
              >
                <FlashIcon on={torchOn} /><span>{torchOn ? 'Flash on' : 'Flash'}</span>
              </button>
              <div className="live-focus-status">{phase === 'ready' ? (focusSupported ? focusMessage : 'Tap the card to focus') : ''}</div>
            </div>
          </>
        )}

        {(phase === 'identifying' || phase === 'launching') && (
          <div className="live-scan-readout" role="status" aria-live="polite">
            <span className="live-scan-spinner" aria-hidden />
            <strong>{phase === 'launching' ? 'Opening Signal' : 'Finding the exact printing'}</strong>
            <span>{phase === 'launching' ? 'Starting the full market report.' : 'Reading the name, set, number, and variant.'}</span>
          </div>
        )}

        {phase === 'match' && match && (
          <section className="live-scan-match" aria-label="Matched card">
            <div className="live-match-heading">
              <span className={`live-match-chip ${details.exact ? 'live-match-chip--exact' : ''}`}>
                {details.exact ? 'Exact match' : 'Needs a check'}
              </span>
              <span>{details.confidence ? `${details.confidence} photo confidence` : 'Card found'}</span>
            </div>
            <div className="live-match-card">
              {details.imageUrl || previewUrl
                ? <img src={details.imageUrl || previewUrl} alt="" />
                : <span className="live-match-art" aria-hidden />}
              <div>
                <strong>{details.name}</strong>
                <span>{details.gameLabel}</span>
                <p>{scannerMatchMeta(details)}</p>
              </div>
              <b>{scannerMatchPrice(details)}</b>
            </div>
            <p className="live-match-check">Check the set, number, and rarity before opening the report.</p>
            <div className="live-match-actions">
              <button type="button" className="live-match-secondary" onClick={scanAgain}>Scan again</button>
              {details.exact ? (
                <button type="button" className="live-match-primary" onClick={confirm}>Open Signal</button>
              ) : (
                <button type="button" className="live-match-primary" onClick={() => onManualSearch?.(match)}>Search matches</button>
              )}
            </div>
          </section>
        )}

        {phase === 'error' && error && (
          <div className="live-scanner-error" role="alert">
            <strong>{error.title}</strong>
            <p>{error.message}</p>
            <div>
              <button type="button" onClick={scanAgain}>Try camera</button>
              <button type="button" onClick={choosePhoto}>Choose photo</button>
              <button type="button" onClick={cancel}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
