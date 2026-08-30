import React, { useEffect, useState, useRef } from 'react';
import SearchBar from './SearchBar';
import QuickPicks from './QuickPicks';
import RecentScans from './RecentScans';
import PriceComparison from './PriceComparison';
import EbayListings from './EbayListings';
import GradingROI from './GradingROI';
import OverallScore from './OverallScore';
import SignalSection from './SignalSection';
import SignalNav from './SignalNav';
import LoadingTheater from './LoadingTheater';
import EmptyState from './EmptyState';
import CardBrowser from './CardBrowser';
import WatchedCards from './WatchedCards';
import NewsStrip from './NewsStrip';
import PdfReport from './PdfReport';
import PageTabs from './PageTabs';
import Collection from './Collection';
import Dossier from './Dossier';
import AddToCollectionDialog from './AddToCollectionDialog';
import SignalAmbient from './SignalAmbient';
import { SIGNAL_SECTIONS, calculateScoreDetails } from '../config/signals';
import { analyzeCard } from '../services/analyzeCard';
import { exportReportToPdf, shareReportAsPdf, imageUrlToDataUrl } from '../services/exportReport';
import { lookupBySetCode, looksLikeSetCode } from '../services/lookupBySetCode';
import { attachScanPin, getCachedScanEntry, setCachedScan, clearCachedScan, refreshCachedPrices, patchCachedPrinting } from '../services/scanCache';
import { backfillPrinting } from '../services/backfillPrinting';
import { refreshPrices } from '../services/refreshPrices';
import { startScanKeepAlive, stopScanKeepAlive } from '../services/scanKeepAlive';
import { hasPrintingPin, nameClaimsExactPrinting } from '../services/recentScans';
import { recordScanDuration } from '../services/scanProgress';
import { pendingScanCard } from '../services/pendingScan';
import { resultCardPin } from '../services/printing';
import { addToCollection } from '../services/collection';
import {
  clearScanSession,
  loadRecoverableScanSession,
  saveCompletedScanSession,
  savePendingScanSession,
} from '../services/scanSession';
import { useIsMobile } from '../hooks/useIsMobile';

function reportFilename(cardName) {
  const safe = String(cardName || 'card')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'card';
  return `signal-${safe}.pdf`;
}

function firstDollar(value) {
  const match = String(value || '').match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
  return match ? Number(match[1].replace(/,/g, '')) : null;
}

export default function SignalDashboard() {
  const [initialScanSession] = useState(() => loadRecoverableScanSession());
  // Which page is showing. The header and tab strip are shared; everything
  // below them belongs to one page or the other.
  const [page, setPage] = useState('signal');
  const [result, setResult] = useState(() =>
    initialScanSession?.status === 'complete' ? initialScanSession.result : null
  );
  const [loading, setLoading] = useState(initialScanSession?.status === 'pending');
  const [error, setError] = useState(null);
  const [pendingCard, setPendingCard] = useState(() =>
    initialScanSession?.status === 'pending'
      ? pendingScanCard(initialScanSession.name, initialScanSession.game, initialScanSession.pin || null)
      : null
  );
  const [lastSearched, setLastSearched] = useState(() =>
    initialScanSession
      ? { name: initialScanSession.name, game: initialScanSession.game, pin: initialScanSession.pin || null }
      : null
  );
  const [scanComplete, setScanComplete] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [cardImageUrl, setCardImageUrl] = useState(null);
  const [pdfRendering, setPdfRendering] = useState(false);
  const [pdfCardImageUrl, setPdfCardImageUrl] = useState(null);
  const [addCard, setAddCard] = useState(null);
  const isMobile = useIsMobile();

  const flashSaveMsg = (msg) => {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg((m) => (m === msg ? null : m)), 3500);
  };

  const addScannerBatch = async (entries) => {
    let copies = 0;
    for (const entry of entries || []) {
      addToCollection(entry.card, entry.details);
      copies += Number(entry?.details?.quantity) || 1;
    }
    window.dispatchEvent(new Event('signal-collection-updated'));
    flashSaveMsg(`${copies} card${copies === 1 ? '' : 's'} added to collection`);
  };

  // Held across renders so the brand-mark "go home" handler can abort an
  // in-flight scan and so a stale scan-result can't punch its way onto the
  // home page if the user navigates away mid-scan.
  const abortRef = useRef(null);
  const navTokenRef = useRef(0);
  const scanStartedAtRef = useRef(
    initialScanSession?.status === 'pending' ? initialScanSession.startedAt : null
  );
  const resultTopRef = useRef(null);
  const recoveryStartedRef = useRef(false);

  const scrollResultFirst = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resultTopRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    });
  };

  const goHome = () => {
    navTokenRef.current += 1;
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
      abortRef.current = null;
    }
    setResult(null);
    setCardImageUrl(null);
    setError(null);
    setLoading(false);
    setLastSearched(null);
    setPendingCard(null);
    setScanComplete(false);
    scanStartedAtRef.current = null;
    clearScanSession();
    setPage('signal');
  };

  // Cache hit with a stale price block: the scan itself is still good, only the
  // money number has aged. Refresh it straight from the free TCG APIs — no
  // Anthropic call, no loading theater. The result is already on screen; this
  // just swaps the price under it a moment later.
  const topUpPrices = async (name, game, myToken, pin = null) => {
    const patch = await refreshPrices(name, game, pin);
    if (!patch) return;
    refreshCachedPrices(name, game, patch, pin);
    // The user may have navigated away while the free API was in flight.
    if (myToken !== navTokenRef.current) return;
    setResult((prev) =>
      prev ? {
        ...prev,
        prices: { ...prev.prices, ...patch },
        grading_roi: null,
        _relatedPriceDataStale: true,
      } : prev
    );
  };

  // A scan cached before the printing line existed shows no identifier under
  // the name. Ask the free catalogue which printing it was and patch it in —
  // no Anthropic call, no waiting, no re-scan.
  const fillPrinting = async (name, game, myToken, pin = null) => {
    if (!pin?.id) return;
    const printing = await backfillPrinting(name, game, pin);
    if (!printing) return;
    patchCachedPrinting(name, game, printing, pin);
    if (myToken !== navTokenRef.current) return;
    setResult((prev) => (prev && !prev.printing ? { ...prev, printing } : prev));
  };

  const handleSearch = async (query, game = null, opts = {}) => {
    // `pin` is a printing chosen from the search suggestions. It keys the cache
    // and pins the pre-fetch, so two printings of one name stay separate scans.
    const { force = false, pin = null, resumeStartedAt = null } = opts;
    let resolvedPin = pin;
    setError(null);
    setPage('signal');

    // A name can claim "Starlight Rare" while carrying no catalogue identity.
    // That is how an exact-looking recent row launched a broad ROTA scan. Make
    // the user choose the physical printing before any cache or API work runs.
    if (!hasPrintingPin(resolvedPin) && nameClaimsExactPrinting(query)) {
      setLoading(false);
      setPendingCard(null);
      clearScanSession();
      setError('Pick this exact printing from the card list so Signal keeps its set code.');
      return;
    }

    // Fast-path cache check BEFORE flipping loading state — already-scanned
    // cards must return instantly with zero loading-theater flash.
    if (!force && game) {
      const fastEntry = getCachedScanEntry(query, game, resolvedPin);
      if (fastEntry) {
        const cachedData = attachScanPin(fastEntry.data, resolvedPin);
        // Invalidate any in-flight scan so it can't overwrite this result
        // when it lands later.
        navTokenRef.current += 1;
        if (abortRef.current) {
          try { abortRef.current.abort(); } catch {}
          abortRef.current = null;
        }
        setCardImageUrl(null);
        setResult(cachedData);
        setLoading(false);
        setPendingCard(null);
        setScanComplete(false);
        scanStartedAtRef.current = null;
        saveCompletedScanSession({
          name: query,
          game,
          pin: resolvedPin,
          result: cachedData,
        });
        setLastSearched({ name: query, game, pin: resolvedPin });
        if (fastEntry.pricesStale) topUpPrices(query, game, ++navTokenRef.current, resolvedPin);
        if (!cachedData.printing) fillPrinting(query, game, navTokenRef.current, resolvedPin);
        scrollResultFirst();
        return;
      }
    }

    // Set-code path is async (needs to resolve a name), so we have to flip
    // loading first here. Plain card-name clicks skip this branch entirely
    // and hit the early-return above.
    let resolvedName = query;
    let resolvedGame = game;
    if (!game && looksLikeSetCode(query)) {
      try {
        const hit = await lookupBySetCode(query);
        if (hit && hit.name) {
          resolvedName = hit.name;
          resolvedGame = hit.game;
          resolvedPin = {
            id: hit.id || null,
            printingId: hit.printingId || hit.id || null,
            game: hit.game,
            setName: hit.setName || null,
            setId: hit.setId || hit.setCode || null,
            number: hit.number || null,
            printedTotal: hit.printedTotal || null,
            rarity: hit.rarity || null,
          };
        }
      } catch {}
    }

    setLastSearched({ name: resolvedName, game: resolvedGame, pin: resolvedPin });

    // Second cache check now that the set-code resolved (if it did).
    if (!force) {
      const entry = getCachedScanEntry(resolvedName, resolvedGame, resolvedPin);
      if (entry) {
        const cachedData = attachScanPin(entry.data, resolvedPin);
        setCardImageUrl(null);
        setResult(cachedData);
        setLoading(false);
        setPendingCard(null);
        setScanComplete(false);
        scanStartedAtRef.current = null;
        saveCompletedScanSession({
          name: resolvedName,
          game: resolvedGame,
          pin: resolvedPin,
          result: cachedData,
        });
        if (entry.pricesStale) topUpPrices(resolvedName, resolvedGame, ++navTokenRef.current, resolvedPin);
        if (!cachedData.printing) fillPrinting(resolvedName, resolvedGame, navTokenRef.current, resolvedPin);
        scrollResultFirst();
        return;
      }
    }

    // Cache miss — now we actually need to scan.
    setLoading(true);
    setResult(null);
    setCardImageUrl(null);
    setPendingCard(pendingScanCard(resolvedName, resolvedGame, resolvedPin));
    setScanComplete(false);

    const startedAt = Number(resumeStartedAt) || Date.now();
    scanStartedAtRef.current = startedAt;
    savePendingScanSession({
      name: resolvedName,
      game: resolvedGame,
      pin: resolvedPin,
      force,
      startedAt,
    });

    const controller = new AbortController();
    abortRef.current = controller;
    const myToken = ++navTokenRef.current;
    // 120 s hard ceiling. Most scans land in 30-60 s; the long tail (full
    // web_search budget on a slow card / congested model) can stretch to ~90 s.
    // 120 s covers the 99th percentile without sacrificing search coverage.
    const timeout = setTimeout(() => controller.abort(), 120000);

    // Foreground service keeps the request alive if the user minimizes the app
    // mid-scan (Android/Samsung otherwise freezes the app and aborts the fetch).
    await startScanKeepAlive();

    try {
      const raw = await analyzeCard(resolvedName, resolvedGame, { signal: controller.signal, pin: resolvedPin });
      const data = resolvedPin ? { ...raw, _pin: resolvedPin } : raw;
      // If goHome() bumped the nav token while we were scanning, the user has
      // already left the result page — do NOT yank them back by setting result.
      if (myToken !== navTokenRef.current) return;
      // Cache under BOTH the input game and the LLM-detected game so future
      // clicks from any surface hit the cache.
      setCachedScan(resolvedName, resolvedGame, data, resolvedPin);
      if (data?.game && data.game !== resolvedGame) {
        setCachedScan(resolvedName, data.game, data, resolvedPin);
      }
      recordScanDuration(data?.game || resolvedGame, Date.now() - startedAt, {
        sharedCache: Boolean(data?._sharedCache),
      });
      // Save the answer before touching the screen. If Android rebuilds the
      // activity at this exact moment, the next WebView opens on the answer.
      saveCompletedScanSession({
        name: resolvedName,
        game: resolvedGame,
        pin: resolvedPin,
        result: data,
      });
      setScanComplete(true);
      // Let the steady bar visibly land on 100 before replacing it.
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (myToken !== navTokenRef.current) return;
      setResult(data);
      if (document.visibilityState === 'visible') {
        scrollResultFirst();
      }
    } catch (err) {
      if (myToken !== navTokenRef.current) return;
      clearScanSession();
      if (err.name === 'AbortError') {
        setError('Scan exceeded 120 seconds. Network or model congestion — retry.');
      } else {
        setError(err.message);
      }
    } finally {
      clearTimeout(timeout);
      stopScanKeepAlive();
      if (abortRef.current === controller) abortRef.current = null;
      if (myToken === navTokenRef.current) {
        setLoading(false);
        setPendingCard(null);
        setScanComplete(false);
        scanStartedAtRef.current = null;
      }
    }
  };

  // A finished scan may land while another app is on screen. On return, put
  // Signal on the result and move that result to the top of the viewport.
  useEffect(() => {
    const showFinishedScan = () => {
      if (document.visibilityState !== 'visible') return;
      const session = loadRecoverableScanSession();
      if (session?.status !== 'complete') return;
      setPage('signal');
      setResult(session.result);
      setLastSearched({ name: session.name, game: session.game, pin: session.pin || null });
      setLoading(false);
      setPendingCard(null);
      setScanComplete(false);
      scanStartedAtRef.current = null;
      scrollResultFirst();
    };

    document.addEventListener('visibilitychange', showFinishedScan);
    return () => document.removeEventListener('visibilitychange', showFinishedScan);
  }, []);

  // If Android rebuilt the activity, either show the saved answer at once or
  // reconnect the pending request. The gateway cache makes a finished server
  // job return quickly even if the old WebView died before recording it.
  useEffect(() => {
    if (!initialScanSession || recoveryStartedRef.current) return;
    recoveryStartedRef.current = true;

    if (initialScanSession.status === 'complete') {
      scrollResultFirst();
      return;
    }

    handleSearch(initialScanSession.name, initialScanSession.game, {
      force: initialScanSession.force,
      pin: initialScanSession.pin || null,
      resumeStartedAt: initialScanSession.startedAt,
    });
  }, []);

  const scoreDetails = result
    ? calculateScoreDetails(result.signals || [], result.game)
    : null;
  const score = scoreDetails?.score ?? null;

  const changePage = (nextPage) => {
    // A saved answer remains the first thing on the next app opening until the
    // user deliberately leaves that answer. Do not erase it merely because
    // Android briefly called the activity visible.
    if (nextPage !== 'signal' && result && !loading) clearScanSession();
    setPage(nextPage);
  };

  return (
    <div className="signal-dashboard" style={{
      maxWidth: 800,
      margin: '0 auto',
      padding: isMobile ? '24px 16px 60px' : '32px 24px 60px',
      position: 'relative',
    }}>
      <SignalAmbient active={!loading} page={page} />
      {/* Header — wordmark inside a hairline red border. */}
      {/* Kanji slightly smaller than "Signal"; Signal in Syne, no italic. */}
      {/* Click anywhere on the wordmark to go home — aborts an in-flight scan
          if one is running, drops result/error state otherwise. */}
      <div style={{ textAlign: 'center', marginBottom: 32, marginTop: isMobile ? 28 : 0 }}>
        <div
          className="signal-logo-frame"
          role="button"
          tabIndex={0}
          aria-label="Go to home"
          onClick={goHome}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goHome(); } }}
          style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: isMobile ? 10 : 14,
            padding: isMobile ? '10px 20px 12px' : '12px 26px 14px',
            border: '1px solid #C44040',
            borderRadius: 8,
            marginBottom: 10,
            cursor: 'pointer',
            userSelect: 'none',
            background: 'transparent',
          }}>
          <span style={{
            fontSize: isMobile ? 26 : 32,
            fontWeight: 900,
            color: '#C44040',
            lineHeight: 0.95,
            fontFamily: "'Noto Sans JP', sans-serif",
            letterSpacing: '-0.02em',
            background: 'linear-gradient(180deg, #E96565 0%, #C44040 55%, #9C3030 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>株</span>
          <span style={{
            fontSize: isMobile ? 36 : 44,
            color: '#E8E4DC',
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(180deg, #F5F1E8 0%, #D8D4CC 60%, #B0ACA4 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>Signal</span>
        </div>
        <div style={{
          fontSize: 13,
          color: '#92897C',
          fontFamily: "'Instrument Serif', serif",
          fontStyle: 'italic',
          letterSpacing: 0,
        }}>
          Trading card intelligence
        </div>
      </div>

      <PageTabs page={page} onChange={changePage} />

      {page === 'dossier' && (
        <div id="panel-dossier" role="tabpanel" aria-labelledby="tab-dossier">
          <Dossier />
        </div>
      )}

      {page === 'collection' && (
        <div id="panel-collection" role="tabpanel" aria-labelledby="tab-collection">
          <Collection
            onAddCard={(card) => setAddCard(card)}
            onAddBatch={addScannerBatch}
            onLookup={(name, game, opts) => {
              setPage('signal');
              handleSearch(name, game, opts);
            }}
          />
        </div>
      )}

      {page === 'signal' && (
      <div id="panel-signal" role="tabpanel" aria-labelledby="tab-signal">
      {/* Search is the dashboard, not result-page furniture. Hiding it during
          work and after completion makes the scan/result the first thing seen
          without depending on a fragile saved scroll position. */}
      {!result && !loading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          marginBottom: 40,
        }}>
          <SearchBar
            onSearch={handleSearch}
            onScannerAdd={(card) => setAddCard(card)}
            onScannerBatch={addScannerBatch}
            loading={loading}
            accentBorder
          />
          <QuickPicks onSelect={handleSearch} loading={loading} />
          <RecentScans onSelect={handleSearch} loading={loading} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          borderLeft: '3px solid #C44040',
          background: 'rgba(196, 64, 64, 0.04)',
          padding: '16px 20px',
          marginBottom: 24,
          borderRadius: '0 2px 2px 0',
        }}>
          <div style={{
            fontSize: 11,
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: '#C44040',
            textTransform: 'uppercase',
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            Scan failed
            {lastSearched?.name && (
              <span style={{ fontWeight: 400, color: '#92897C', textTransform: 'none', letterSpacing: 0 }}>
                — {lastSearched.name}
              </span>
            )}
          </div>
          <div style={{
            fontSize: 12,
            color: '#92897C',
            fontFamily: "'JetBrains Mono', monospace",
            marginBottom: 12,
            lineHeight: 1.55,
          }}>
            {error}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button
              onClick={() => lastSearched && handleSearch(lastSearched.name, lastSearched.game, { force: true, pin: lastSearched.pin || null })}
              style={{
                background: 'none',
                border: '1px solid rgba(196, 64, 64, 0.4)',
                borderRadius: 2,
                padding: '4px 14px',
                color: '#C44040',
                fontSize: 11,
                fontFamily: "'Syne', sans-serif",
                fontWeight: 700,
                letterSpacing: '0.08em',
                cursor: 'pointer',
              }}
            >
              Retry scan
            </button>
            <span style={{
              fontSize: 10,
              color: '#605C54',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.04em',
            }}>
              Check spelling · TCG card names are exact
            </span>
          </div>
        </div>
      )}

      {/* Loading Theater */}
      {loading && (
        <div style={{
          margin: '0 calc(-50vw + 50%)',
          padding: '0 16px',
          maxWidth: '100vw',
        }}>
          <LoadingTheater
            cardName={pendingCard?.name}
            game={pendingCard?.game}
            pin={pendingCard?.pin}
            onCancel={goHome}
            startedAt={scanStartedAtRef.current}
            complete={scanComplete}
          />
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {/* Result-page actions: back to dashboard + save as PDF.
              Save PDF captures the #signal-report-capture wrapper below. */}
          <div ref={resultTopRef} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                clearScanSession();
                setResult(null);
                setCardImageUrl(null);
                setLastSearched(null);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px 4px 6px',
                background: 'transparent',
                border: '1px solid #1A1D24',
                borderRadius: 4,
                color: '#A8A498',
                fontSize: 11,
                fontFamily: "'Syne', sans-serif",
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#C44040';
                e.currentTarget.style.color = '#C8C4BC';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#1A1D24';
                e.currentTarget.style.color = '#A8A498';
              }}
              aria-label="Back to dashboard"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back
            </button>

            <button
              onClick={() => {
                const pin = resultCardPin(result) || {};
                setAddCard({
                  ...pin,
                  id: pin.id || pin.catalogId || result.printing?.catalogId || null,
                  printingId: pin.printingId || pin.id || pin.catalogId || null,
                  name: result.card_name,
                  game: result.game,
                  setName: pin.setName || result.printing?.setName || null,
                  setId: pin.setId || result.printing?.setId || null,
                  number: pin.number || result.printing?.number || null,
                  imageUrl: pin.imageUrl || cardImageUrl,
                  imageLarge: pin.imageLarge || cardImageUrl,
                  price: pin.price ?? firstDollar(result.prices?.en_price),
                  marketPrices: pin.marketPrices || null,
                });
              }}
              className="result-add-button"
              aria-label={`Add ${result.card_name || 'card'} to collection`}
            >
              <span aria-hidden>＋</span>
              Add to collection
            </button>

            <button
              onClick={async () => {
                try {
                  setPdfRendering(true);
                  setPdfCardImageUrl(await imageUrlToDataUrl(cardImageUrl).catch(() => null));
                  // One animation frame to mount PdfReport, then a short pause
                  // so the off-screen card image + fonts settle before capture.
                  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
                  await new Promise((r) => setTimeout(r, 900));
                  const res = await exportReportToPdf({
                    elementId: 'pdf-report-capture',
                    filename: reportFilename(result.card_name),
                  });
                  if (res?.method === 'native') {
                    flashSaveMsg(`Saved to Documents · ${res.filename}`);
                  } else {
                    flashSaveMsg(`Downloaded · ${res?.filename || 'report.pdf'}`);
                  }
                } catch (err) {
                  // eslint-disable-next-line no-console
                  console.error('[signal] PDF export failed', err);
                  flashSaveMsg(`Save failed: ${err?.message?.slice(0, 60) || 'unknown error'}`);
                } finally {
                  setPdfRendering(false);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px 4px 6px',
                background: 'transparent',
                border: '1px solid #1A1D24',
                borderRadius: 4,
                color: '#A8A498',
                fontSize: 11,
                fontFamily: "'Syne', sans-serif",
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#A09060';
                e.currentTarget.style.color = '#C8C4BC';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#1A1D24';
                e.currentTarget.style.color = '#A8A498';
              }}
              aria-label="Download report as PDF"
              disabled={pdfRendering}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Save PDF
            </button>

            {/* Share — opens system share sheet (email, Messages, etc.) with the
                generated PDF as an attachment. Falls back to download. */}
            <button
              onClick={async () => {
                try {
                  setPdfRendering(true);
                  setPdfCardImageUrl(await imageUrlToDataUrl(cardImageUrl).catch(() => null));
                  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                  await document.fonts?.ready;
                  await shareReportAsPdf({
                    elementId: 'pdf-report-capture',
                    filename: reportFilename(result.card_name),
                    title: `Signal: ${result.card_name || 'card'}`,
                    text: `${result.card_name || 'Card'} · ${result.summary?.slice(0, 140) || ''}`,
                  });
                } catch (err) {
                  // eslint-disable-next-line no-console
                  console.error('[signal] share failed', err);
                  flashSaveMsg(`Share failed: ${err?.message?.slice(0, 60) || 'unknown error'}`);
                } finally {
                  setPdfRendering(false);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px 4px 6px',
                background: 'transparent',
                border: '1px solid #1A1D24',
                borderRadius: 4,
                color: '#A8A498',
                fontSize: 11,
                fontFamily: "'Syne', sans-serif",
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#A09060';
                e.currentTarget.style.color = '#C8C4BC';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#1A1D24';
                e.currentTarget.style.color = '#A8A498';
              }}
              aria-label="Share / email report"
              disabled={pdfRendering}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </button>

            {/* Re-scan — bypasses the local cache and burns a fresh Anthropic
                run when the cached data is stale. */}
            <button
              onClick={() => {
                if (!result?.card_name) return;
                const resultPin = resultCardPin(result);
                clearCachedScan(result.card_name, result.game, resultPin);
                handleSearch(result.card_name, result.game, { force: true, pin: resultPin });
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px 4px 6px',
                background: 'transparent',
                border: '1px solid #1A1D24',
                borderRadius: 4,
                color: '#A8A498',
                fontSize: 11,
                fontFamily: "'Syne', sans-serif",
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#C44040';
                e.currentTarget.style.color = '#C8C4BC';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#1A1D24';
                e.currentTarget.style.color = '#A8A498';
              }}
              aria-label="Re-scan with fresh data"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Re-scan
            </button>
          </div>

          <div id="signal-report-capture">

          {score !== null && (
            <OverallScore
              score={score}
              cardName={result.card_name}
              game={result.game}
              summary={result.summary}
              truncated={result._truncated}
              signalCount={(result.signals || []).length}
              expectedSignalCount={8}
              coveragePct={scoreDetails?.coveragePct || 0}
              evidencePct={scoreDetails?.evidencePct || 0}
              onRetry={() => handleSearch(result.card_name, result.game, { force: true, pin: resultCardPin(result) })}
              signals={result.signals || []}
              enPrice={result.prices?.en_price}
              onCardImageLoaded={setCardImageUrl}
              printing={result.printing}
              pin={resultCardPin(result)}
            />
          )}

          <PriceComparison
            data={{
              ...result.prices,
              trend_30d: result.prices?.trend_30d,
              signal_vs_market: result.prices?.signal_vs_market,
            }}
          />

          <EbayListings data={result.ebay_listings} cachedAt={result._scannedAt} stale={result._relatedPriceDataStale} />

          <GradingROI data={result.grading_roi} />

          {/* Signal navigation — jump to any section */}
          <SignalNav signals={result.signals || []} />

          {SIGNAL_SECTIONS.map((section, sIdx) => (
            <SignalSection
              key={section.id}
              section={section}
              signals={result.signals || []}
              baseDelay={sIdx * 3}
            />
          ))}

          <div className="fade-slide-up fade-slide-up-9" style={{
            marginTop: 40,
            paddingTop: 16,
            borderTop: '1px solid #14161A',
            fontSize: 10,
            color: '#605C54',
            textAlign: 'center',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.06em',
          }}>
            Signal data is for informational purposes only. Not financial advice.
          </div>
          </div>{/* /#signal-report-capture */}
        </>
      )}

      {!result && !loading && !error && (
        <>
          <WatchedCards onSelect={handleSearch} />
          <NewsStrip />
          <EmptyState />
          <CardBrowser onCardSelect={handleSearch} accentBorder />
        </>
      )}
      </div>
      )}

      {/* Off-screen premium PDF report — mounted only during Save PDF flow so
          html2pdf captures THIS clean editorial layout instead of the dark
          live dashboard. Positioned off-canvas, never visible to the user. */}
      {pdfRendering && result && (
        <div style={{
          position: 'fixed',
          left: -10000,
          top: 0,
          width: 720,
          background: '#FAF7F0',
          zIndex: -1,
          pointerEvents: 'none',
        }}>
          <div id="pdf-report-capture">
            <PdfReport result={result} score={score} cardImageUrl={pdfCardImageUrl} />
          </div>
        </div>
      )}

      {saveMsg && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#0E1014',
          border: `1px solid ${saveMsg.startsWith('Save failed') ? '#C44040' : '#608870'}`,
          borderRadius: 4,
          padding: '11px 18px',
          color: saveMsg.startsWith('Save failed') ? '#C44040' : '#608870',
          fontFamily: "'Syne', sans-serif",
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 700,
          zIndex: 1000,
          boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
          maxWidth: 'calc(100vw - 32px)',
          textAlign: 'center',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}>
          {saveMsg}
        </div>
      )}

      <AddToCollectionDialog
        card={addCard}
        isOpen={!!addCard}
        onClose={() => setAddCard(null)}
        onAdded={(_list, details) => {
          flashSaveMsg(`${details.quantity} added to collection`);
        }}
      />
    </div>
  );
}
