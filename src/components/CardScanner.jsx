import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { drawCameraFrame } from '../services/cameraCanvas';
import { computeVideoCrop } from '../services/scannerCrop';
import {
  cameraTorchSupported,
  focusCameraTrack,
  openFocusedRearCamera,
  setCameraTorch,
} from '../services/cameraFocus';
import {
  createScannerBatchEntry,
  scannerBatchFormOptions,
  scannerBatchSummary,
  scannerMatchDetails,
  scannerMatchMeta,
  scannerMatchPrice,
} from '../services/scannerMatch';
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

const BATCH_CONDITIONS = [
  { value: 'near_mint', label: 'Near mint' },
  { value: 'lightly_played', label: 'Lightly played' },
  { value: 'moderately_played', label: 'Moderately played' },
  { value: 'heavily_played', label: 'Heavily played' },
  { value: 'damaged', label: 'Damaged' },
];

const CardScanner = forwardRef(function CardScanner({
  open,
  onCancel,
  onIdentify,
  onAdd,
  onRun,
  onBatchAdd,
  onManualSearch,
  mode = 'single',
  lookupMode = 'price',
}, ref) {
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
  const pendingFilesRef = useRef([]);
  useImperativeHandle(ref, () => ({
    choosePhoto: () => fileInputRef.current?.click(),
  }), []);
  const [phase, setPhase] = useState('opening');
  const [error, setError] = useState(null);
  const [match, setMatch] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [focusSupported, setFocusSupported] = useState(false);
  const [focusPoint, setFocusPoint] = useState(null);
  const [focusMessage, setFocusMessage] = useState('');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [launchAction, setLaunchAction] = useState(null);
  const [batch, setBatch] = useState([]);
  const batchMode = mode === 'batch';
  const priceOnly = !batchMode && lookupMode === 'price';
  const batchSummary = scannerBatchSummary(batch);

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
    setLaunchAction(null);
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
    const files = [...(event.target.files || [])];
    if (event.target) event.target.value = '';
    if (!files.length) return;
    pendingFilesRef.current = batchMode ? files.slice(1) : [];
    await identify(files[0], false);
  };

  const reviewBatch = () => {
    abortRef.current?.abort();
    stop();
    clearPreview();
    setPhase('review');
  };

  const continueBatch = async () => {
    clearPreview();
    const next = pendingFilesRef.current.shift();
    if (next) await identify(next, false);
    else start();
  };

  const keepForBatch = async (destination = 'scan') => {
    const entry = createScannerBatchEntry(match, `${Date.now()}-${batch.length}`);
    if (!entry) return;
    setBatch((current) => [...current, entry]);
    setMatch(null);
    clearPreview();
    if (destination === 'review') {
      stop();
      setPhase('review');
      return;
    }
    const next = pendingFilesRef.current.shift();
    if (next) await identify(next, false);
    else start();
  };

  const updateBatchEntry = (id, patch) => {
    setBatch((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  };

  const removeBatchEntry = (id) => {
    setBatch((current) => current.filter((entry) => entry.id !== id));
  };

  const addBatch = async () => {
    if (!batch.length || !onBatchAdd) return;
    setLaunchAction('batch');
    setPhase('launching');
    try {
      await onBatchAdd(batch);
    } catch (batchError) {
      setError({ title: 'Collection did not open', message: batchError?.message || 'Try the batch again.' });
      setPhase('error');
    }
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

  const launch = async (action) => {
    const handler = action === 'add' ? onAdd : onRun;
    if (!match?.pin || !handler) return;
    setLaunchAction(action);
    setPhase('launching');
    try {
      await handler(match);
    } catch (confirmError) {
      setError({
        title: action === 'add' ? 'Collection did not open' : 'Signal did not open',
        message: confirmError?.message || 'Try the card again.',
      });
      setPhase('error');
    }
  };

  const candidates = Array.isArray(match?.candidates) ? match.candidates : [];
  const chooseCandidate = (pin) => setMatch((current) => ({ ...current, pin }));
  const displayMatch = !match?.pin && candidates.length
    ? { ...match, card: { ...(match.card || {}), name: candidates[0].name, game: candidates[0].game } }
    : match;
  const details = scannerMatchDetails(displayMatch || {});
  const needsChoice = candidates.length > 1 && !match?.pin;
  const cameraVisible = phase === 'opening' || phase === 'ready' || phase === 'capturing';

  return (
    <div className={`live-scanner live-scanner--${phase}`} role="dialog" aria-modal="true" aria-label="Scan a trading card">
      <div ref={stageRef} className="live-scanner-stage">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple={batchMode}
          className="live-scanner-file"
          onChange={handleFile}
        />
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
          <strong>{batchMode ? 'Batch scan' : priceOnly ? 'Price only' : 'Full Signal'}</strong>
          {batchMode ? (
            <button type="button" className="live-batch-count" onClick={reviewBatch} disabled={!batch.length}>
              {batchSummary.cards} saved
            </button>
          ) : <span className="live-scanner-auto">AUTO</span>}
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
            <strong>{phase === 'launching'
              ? (launchAction === 'batch' ? 'Adding batch to Collection'
                : launchAction === 'add' ? 'Opening collection form' : 'Running full Signal')
              : 'Finding the exact printing'}</strong>
            <span>{phase === 'launching'
              ? (launchAction === 'batch' ? `Saving ${batchSummary.cards} cards.`
                : launchAction === 'add' ? 'Preparing this exact printing.' : 'Starting the complete market report.')
              : 'Reading the name, set, number, and variant.'}</span>
          </div>
        )}

        {phase === 'match' && match && (
          <section className="live-scan-match" aria-label="Matched card">
            <div className="live-match-heading">
              <span className={`live-match-chip ${details.exact ? 'live-match-chip--exact' : ''}`}>
                {candidates.length > 1 ? (match.pin ? 'Printing selected' : 'Choose printing') : (details.exact ? 'Exact match' : 'Needs a check')}
              </span>
              <span>
                {batchMode ? 'Batch price lookup' : priceOnly ? 'Price only' : 'Full Signal'}
                {details.confidence ? ` · ${details.confidence} confidence` : ''}
              </span>
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
            {candidates.length > 1 && (
              <div className="live-match-options" role="group" aria-label="Choose the card printing">
                {candidates.map((option) => {
                  const optionDetails = scannerMatchDetails({ card: match.card, pin: option });
                  const selected = match.pin?.printingId === option.printingId;
                  return (
                    <button
                      type="button"
                      key={`${option.printingId}-${option.rarity}`}
                      className={selected ? 'live-match-option live-match-option--selected' : 'live-match-option'}
                      onClick={() => chooseCandidate(option)}
                      aria-pressed={selected}
                    >
                      <span><strong>{option.rarity || 'Unknown rarity'}</strong><small>{option.number || option.setName}</small></span>
                      <b>{scannerMatchPrice(optionDetails)}</b>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="live-match-check">
              {candidates.length > 1
                ? 'Pick the printing that matches your card.'
                : batchMode
                  ? 'Check the exact printing before keeping this card.'
                  : priceOnly
                    ? 'Price lookup complete. No full Signal report has run.'
                    : 'Check the exact printing before starting the paid full report.'}
            </p>
            <div className={`live-match-actions ${details.exact ? 'live-match-actions--complete' : ''}`}>
              {details.exact ? (
                batchMode ? (
                  <>
                    <button type="button" className="live-match-primary" onClick={() => keepForBatch('scan')}>Keep & scan next</button>
                    <button type="button" className="live-match-add" onClick={() => keepForBatch('review')}>Keep & review</button>
                    <button type="button" className="live-match-secondary" onClick={scanAgain}>Scan again</button>
                  </>
                ) : priceOnly ? (
                  <>
                    <button type="button" className="live-match-add" onClick={() => launch('add')}>Add to collection</button>
                    <button type="button" className="live-match-done" onClick={cancel}>Done · Price only</button>
                    <button type="button" className="live-match-secondary" onClick={scanAgain}>Scan again</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="live-match-add" onClick={() => launch('add')}>Add to collection</button>
                    <button type="button" className="live-match-primary" onClick={() => launch('run')}>Confirm & run full Signal</button>
                    <button type="button" className="live-match-secondary" onClick={scanAgain}>Scan again</button>
                  </>
                )
              ) : needsChoice ? (
                <>
                  <button type="button" className="live-match-secondary" onClick={scanAgain}>Scan again</button>
                  <button type="button" className="live-match-primary" disabled>Choose one</button>
                </>
              ) : (
                <>
                  <button type="button" className="live-match-secondary" onClick={scanAgain}>Scan again</button>
                  <button type="button" className="live-match-primary" onClick={() => onManualSearch?.(match)}>Search matches</button>
                </>
              )}
            </div>
          </section>
        )}

        {phase === 'review' && (
          <section className="live-batch-review" aria-label="Review scanned cards">
            <div className="live-batch-heading">
              <div>
                <span>Batch review</span>
                <strong>{batchSummary.cards} card{batchSummary.cards === 1 ? '' : 's'}</strong>
              </div>
              <div>
                <span>Market total</span>
                <strong>${batchSummary.value.toFixed(2)}{batchSummary.unpriced ? '+' : ''}</strong>
                {batchSummary.unpriced > 0 && <small>{batchSummary.unpriced} unpriced</small>}
              </div>
            </div>

            {batch.length ? (
              <div className="live-batch-list">
                {batch.map((entry) => {
                  const item = scannerMatchDetails(entry.match);
                  const forms = scannerBatchFormOptions(item.game, entry.match?.pin);
                  return (
                    <article className="live-batch-item" key={entry.id}>
                      {item.imageUrl
                        ? <img src={item.imageUrl} alt="" />
                        : <span className="live-batch-noart" aria-hidden>?</span>}
                      <div className="live-batch-copy">
                        <strong>{item.name}</strong>
                        <small>{scannerMatchMeta(item)}</small>
                        <b>{scannerMatchPrice(item)}</b>
                      </div>
                      <button
                        type="button"
                        className="live-batch-remove"
                        onClick={() => removeBatchEntry(entry.id)}
                        aria-label={`Remove ${item.name} from batch`}
                      >×</button>
                      <div className="live-batch-fields">
                        <label>
                          <span>Condition</span>
                          <select value={entry.condition} onChange={(event) => updateBatchEntry(entry.id, { condition: event.target.value })}>
                            {BATCH_CONDITIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        {forms.length > 0 && (
                          <label>
                            <span>Finish</span>
                            <select value={entry.form} onChange={(event) => updateBatchEntry(entry.id, { form: event.target.value })}>
                              {forms.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                          </label>
                        )}
                        <div className="live-batch-qty" role="group" aria-label={`Quantity for ${item.name}`}>
                          <span>Quantity</span>
                          <div>
                            <button type="button" onClick={() => updateBatchEntry(entry.id, { quantity: Math.max(1, entry.quantity - 1) })}>−</button>
                            <b>{entry.quantity}</b>
                            <button type="button" onClick={() => updateBatchEntry(entry.id, { quantity: Math.min(999, entry.quantity + 1) })}>+</button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="live-batch-empty">
                <strong>No cards kept yet</strong>
                <span>Continue scanning to build this batch.</span>
              </div>
            )}

            <div className="live-batch-actions">
              <button type="button" className="live-match-secondary" onClick={continueBatch}>Continue scanning</button>
              <button type="button" className="live-match-add" onClick={addBatch} disabled={!batch.length}>Add all to Collection</button>
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
});

export default CardScanner;
