import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
import SearchBar from './SearchBar';
import QuickPicks from './QuickPicks';
import RecentScans from './RecentScans';
import ReportTools from './ReportTools';
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
import BottomNavigation from './BottomNavigation';
import Collection from './Collection';
import Dossier from './Dossier';
import AddToCollectionDialog from './AddToCollectionDialog';
import SignalAmbient from './SignalAmbient';
import ScrollReveal from './ScrollReveal';
import { SIGNAL_TYPES } from '../config/signals';
import { SIGNAL_SECTIONS, calculateScoreDetails } from '../config/signals';
import { analyzeCard } from '../services/analyzeCard';
import { exportReportToPdf, shareReportAsPdf, imageUrlToDataUrl } from '../services/exportReport';
import { lookupBySetCode, looksLikeSetCode } from '../services/lookupBySetCode';
import { attachScanPin, getCachedScanEntry, setCachedScan, clearCachedScan, refreshCachedPrices, patchCachedPrinting } from '../services/scanCache';
import { backfillPrinting } from '../services/backfillPrinting';
import { refreshPrices } from '../services/refreshPrices';
import { startScanKeepAlive, stopScanKeepAlive } from '../services/scanKeepAlive';
import { isExactScanTarget } from '../services/scanIdentity';
import { recordScanDuration } from '../services/scanProgress';
import { pendingScanCard } from '../services/pendingScan';
import { resultCardPin } from '../services/printing';
import { normalizeCardRecord, stampCardPrice, withCardRecord } from '../services/cardRecord';
import { addToCollection } from '../services/collection';
import { reportEvidenceStats } from '../services/citations';
import {
  DEFAULT_PAGE,
  PAGE_SWIPE_IGNORE_SELECTOR,
  pageAfterSwipe,
  pageSwipeDirection,
} from '../services/pageSwipe';
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
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [visitedPages, setVisitedPages] = useState(() => new Set([DEFAULT_PAGE]));
  const currentPageRef = useRef(DEFAULT_PAGE);
  const pageScrollRef = useRef({});
  const pendingScrollRef = useRef(null);
  const resultScrollPendingRef = useRef(false);
  const pageTabsRef = useRef(null);
  const collectionScannerRef = useRef(null);
  const [pageEntryDirection, setPageEntryDirection] = useState(null);
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

  const openPage = (nextPage, entryDirection = null) => {
    if (nextPage === currentPageRef.current) return;
    pageScrollRef.current[currentPageRef.current] = window.scrollY;
    pendingScrollRef.current = pageScrollRef.current[nextPage] || 0;
    currentPageRef.current = nextPage;
    setVisitedPages((previous) => new Set([...previous, nextPage]));
    setPageEntryDirection(entryDirection);
    setPage(nextPage);
  };

  useLayoutEffect(() => {
    if (pendingScrollRef.current === null) return;
    const top = pendingScrollRef.current;
    pendingScrollRef.current = null;
    window.scrollTo({ top, left: 0, behavior: 'instant' });
    const frame = requestAnimationFrame(() => {
      if (page === 'signal' && resultScrollPendingRef.current) {
        resultScrollPendingRef.current = false;
        resultTopRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
      } else window.scrollTo({ top, left: 0, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [page]);

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
  const pageSwipeStartRef = useRef(null);
  const pageSwipeClickTimerRef = useRef(null);
  const suppressPageSwipeClickRef = useRef(false);

  const scrollResultFirst = () => {
    if (currentPageRef.current !== 'signal') {
      resultScrollPendingRef.current = true;
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (currentPageRef.current !== 'signal') { resultScrollPendingRef.current = true; return; }
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
    openPage('signal');
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
    setResult((prev) => {
      if (!prev) return prev;
      const next = withCardRecord({
        ...prev,
        prices: { ...prev.prices, ...patch },
        grading_roi: null,
        _relatedPriceDataStale: true,
      }, prev.card || pin);
      saveCompletedScanSession({ name, game, pin: next.card || pin, result: next });
      return next;
    });
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
    let resolvedName = query;
    let resolvedGame = game;
    setError(null);
    openPage('signal');

    if (!game && looksLikeSetCode(query)) {
      try {
        const hit = await lookupBySetCode(query);
        if (hit?.name) {
          resolvedName = hit.name;
          resolvedGame = hit.game;
          resolvedPin = {
            ...hit,
            id: hit.id || null,
            printingId: hit.printingId || hit.id || null,
            game: hit.game,
            setId: hit.setId || hit.setCode || null,
          };
        }
      } catch {}
    }

    resolvedPin = stampCardPrice(normalizeCardRecord(resolvedPin || {}, {
      name: resolvedName,
      game: resolvedGame,
    }));

    // One gate guards every paid entry path: typed search, camera, upload,
    // browse, recent, watched, Trending, retry, and restored sessions.
    if (!isExactScanTarget(resolvedGame, resolvedPin)) {
      setLoading(false);
      setPendingCard(null);
      clearScanSession();
      setError('Choose one exact printing from the card list before running Full Signal.');
      return;
    }

    setLastSearched({ name: resolvedName, game: resolvedGame, pin: resolvedPin });

    // Fast-path cache check BEFORE flipping loading state — already-scanned
    // cards must return instantly with zero loading-theater flash.
    if (!force) {
      const fastEntry = getCachedScanEntry(resolvedName, resolvedGame, resolvedPin);
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
          name: resolvedName,
          game: resolvedGame,
          pin: resolvedPin,
          result: cachedData,
        });
        if (fastEntry.pricesStale) topUpPrices(resolvedName, resolvedGame, ++navTokenRef.current, resolvedPin);
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
      const raw = await analyzeCard(resolvedName, resolvedGame, { signal: controller.signal, pin: resolvedPin, force });
      const data = withCardRecord(raw, resolvedPin);
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
      openPage('signal');
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
  const evidenceStats = result ? reportEvidenceStats(result.signals || []) : null;
  const score = scoreDetails?.score ?? null;
  const signalHomeReady = page === 'signal' && !result && !loading && !error;

  const changePage = (nextPage, entryDirection = null) => {
    // A saved answer remains the first thing on the next app opening until the
    // user deliberately leaves that answer. Do not erase it merely because
    // Android briefly called the activity visible.
    if (nextPage !== 'signal' && result && !loading) clearScanSession();
    openPage(nextPage, entryDirection);
  };

  useEffect(() => () => {
    if (pageSwipeClickTimerRef.current) clearTimeout(pageSwipeClickTimerRef.current);
  }, []);

  const startPageSwipe = (event) => {
    const touch = event.touches?.[0];
    if (event.touches?.length !== 1 || !touch
      || event.target?.closest?.(PAGE_SWIPE_IGNORE_SELECTOR)) {
      pageSwipeStartRef.current = null;
      return;
    }
    pageSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const finishPageSwipe = (event) => {
    const start = pageSwipeStartRef.current;
    pageSwipeStartRef.current = null;
    const touch = event.changedTouches?.[0];
    if (!start || !touch) return;
    const direction = pageSwipeDirection(touch.clientX - start.x, touch.clientY - start.y);
    if (!direction) return;

    // A swipe that starts on a card or button must change the page without
    // firing that control's click as the finger lifts. This also applies at
    // the two stopped ends, where the page stays put.
    suppressPageSwipeClickRef.current = true;
    if (pageSwipeClickTimerRef.current) clearTimeout(pageSwipeClickTimerRef.current);
    pageSwipeClickTimerRef.current = setTimeout(() => {
      suppressPageSwipeClickRef.current = false;
      pageSwipeClickTimerRef.current = null;
    }, 450);
    const nextPage = pageAfterSwipe(page, direction);
    if (nextPage === page) return;
    changePage(nextPage, direction);
  };

  const cancelPageSwipe = () => {
    pageSwipeStartRef.current = null;
  };

  const stopSwipeClick = (event) => {
    if (!suppressPageSwipeClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressPageSwipeClickRef.current = false;
  };

  const pagePanelClass = `page-swipe-panel${pageEntryDirection ? ` page-swipe-panel--${pageEntryDirection}` : ''}`;

  const isReport = page === 'signal' && Boolean(result) && !loading;
  const backFromReport = () => {
                clearScanSession();
                setResult(null);
                setCardImageUrl(null);
                setLastSearched(null);
              };
  const addReportCard = () => {
                const pin = resultCardPin(result) || {};
                setAddCard(normalizeCardRecord({
                  ...pin,
                  name: result.card_name,
                  game: result.game,
                  imageUrl: pin.imageUrl || cardImageUrl,
                  imageLarge: pin.imageLarge || cardImageUrl,
                  price: pin.price ?? firstDollar(result.prices?.en_price),
                  priceSource: result.prices?.price_source || pin.priceSource,
                  priceCheckedAt: result.prices?.price_checked_at || pin.priceCheckedAt,
                }));
              };
  const saveReportPdf = async () => {
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
              };
  const shareReportPdf = async () => {
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
              };
  const rescanReport = () => {
                if (!result?.card_name) return;
                const resultPin = resultCardPin(result);
                clearCachedScan(result.card_name, result.game, resultPin);
                handleSearch(result.card_name, result.game, { force: true, pin: resultPin });
              };

  return (
    <div className={`signal-dashboard${isReport ? ' signal-report-mode' : ''}`} style={{
      maxWidth: 800,
      margin: '0 auto',
      padding: isMobile ? '24px 16px calc(84px + env(safe-area-inset-bottom))' : '32px 24px calc(84px + env(safe-area-inset-bottom))',
      position: 'relative',
    }}>
      {!isReport && <SignalAmbient active={!loading} page={page} />}
      {/* Header — wordmark inside a hairline red border. */}
      {/* Kanji slightly smaller than "Signal"; Signal in Syne, no italic. */}
      {/* Click anywhere on the wordmark to go home — aborts an in-flight scan
          if one is running, drops result/error state otherwise. */}
      <div className="signal-brand" style={{ textAlign: 'center', marginBottom: 32, marginTop: isMobile ? 28 : 0 }}>
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
        <div className="signal-brand-tagline" style={{
          fontSize: 13,
          color: '#92897C',
          fontFamily: "'Instrument Serif', serif",
          fontStyle: 'italic',
          letterSpacing: 0,
        }}>
          Trading card intelligence
        </div>
      </div>

      <PageTabs page={page} onChange={changePage} tabsRef={pageTabsRef} />

      <div
        className="page-swipe-surface"
        onTouchStart={startPageSwipe}
        onTouchEnd={finishPageSwipe}
        onTouchCancel={cancelPageSwipe}
        onClickCapture={stopSwipeClick}
      >

      {visitedPages.has('dossier') && (
        <div key="dossier" id="panel-dossier" hidden={page !== 'dossier'} className={page === 'dossier' ? pagePanelClass : ''} role="tabpanel" aria-labelledby="tab-dossier">
          <Dossier entryActive={page === 'dossier'} />
        </div>
      )}

      {visitedPages.has('collection') && (
        <div key="collection" id="panel-collection" hidden={page !== 'collection'} className={page === 'collection' ? pagePanelClass : ''} role="tabpanel" aria-labelledby="tab-collection">
          <Collection
            entryActive={page === 'collection'}
            scannerRef={collectionScannerRef}
            onRevealSearch={() => {
              pageScrollRef.current.collection = 0;
              openPage('collection');
              requestAnimationFrame(() => document.querySelector('#panel-collection .col-finder')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
            }}
            onAddCard={(card) => setAddCard(card)}
            onAddBatch={addScannerBatch}
            onLookup={(name, game, opts) => {
              openPage('signal');
              handleSearch(name, game, opts);
            }}
          />
        </div>
      )}

      {visitedPages.has('signal') && (
      <div key="signal" id="panel-signal" hidden={page !== 'signal'} className={page === 'signal' ? pagePanelClass : ''} role="tabpanel" aria-labelledby="tab-signal">
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
          />
          <QuickPicks
            onSelect={handleSearch}
            loading={loading}
            introActive={signalHomeReady}
          />
          <RecentScans
            onSelect={handleSearch}
            loading={loading}
            introActive={signalHomeReady}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="signal-error-panel" style={{
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
              className="signal-error-retry"
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
              color: 'var(--signal-text-muted)',
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
          <div ref={resultTopRef} className="result-actions report-toolbar">
            <button type="button" className="report-back" onClick={backFromReport} aria-label="Back to dashboard"><span aria-hidden="true">←</span> Back</button>
            <ReportTools onSave={saveReportPdf} onShare={shareReportPdf} onRescan={rescanReport} busy={pdfRendering} />
          </div>

          <div id="signal-report-capture">

            <ScrollReveal delay={70}>
              <OverallScore
                score={score}
                cardName={result.card_name}
                game={result.game}
                summary={result.summary}
                truncated={result._truncated}
                signalCount={(result.signals || []).length}
                expectedSignalCount={8}
                sourcedSignalCount={evidenceStats?.sourcedSignalCount || 0}
                uniqueSourceCount={evidenceStats?.uniqueSourceCount || 0}
                onRetry={() => handleSearch(result.card_name, result.game, { force: true, pin: resultCardPin(result) })}
                signals={result.signals || []}
                enPrice={result.prices?.en_price}
                prices={result.prices}
                onAdd={addReportCard}
                onCardImageLoaded={setCardImageUrl}
                printing={result.printing}
                pin={resultCardPin(result)}
              />
            </ScrollReveal>



          <ScrollReveal>
            <EbayListings data={result.ebay_listings} cachedAt={result._scannedAt} stale={result._relatedPriceDataStale} />
          </ScrollReveal>

          <ScrollReveal delay={70}>
            <GradingROI data={result.grading_roi} />
          </ScrollReveal>

          {/* Signal navigation — jump to any section */}
          <ScrollReveal>
            <SignalNav signals={(result.signals || []).filter((signal) => signal.sources?.length)} />
          </ScrollReveal>

          {SIGNAL_SECTIONS.map((section, sIdx) => (
            <ScrollReveal key={section.id}>
              <SignalSection
                section={section}
                signals={result.signals || []}
                baseDelay={sIdx * 3}
              />
            </ScrollReveal>
          ))}
          {(result.signals || []).some((signal) => !signal.sources?.length) && (
            <details className="report-empty-areas">
              <summary>Areas without sources</summary>
              <ul>{(result.signals || []).filter((signal) => !signal.sources?.length).map((signal) => (
                <li key={signal.key}>{SIGNAL_SECTIONS.flatMap(section => section.signals).includes(signal.key) ? SIGNAL_TYPES[signal.key]?.label || signal.key : signal.key}</li>
              ))}</ul>
            </details>
          )}



          </div>{/* /#signal-report-capture */}
        </>
      )}

      {!result && !loading && !error && (
        <>
          <WatchedCards onSelect={handleSearch} />
          <NewsStrip />
          <EmptyState />
          <CardBrowser onCardSelect={handleSearch} accentBorder compactTop />
        </>
      )}
      </div>
      )}
      </div>{/* /.page-swipe-surface */}

      <BottomNavigation
        page={page}
        tabsRef={pageTabsRef}
        onChange={changePage}
        onScan={(kind) => collectionScannerRef.current?.openScanner(kind)}
      />

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
          bottom: 'calc(76px + env(safe-area-inset-bottom))',
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
