import React, { useState, useRef } from 'react';
import SearchBar from './SearchBar';
import QuickPicks from './QuickPicks';
import RecentScans from './RecentScans';
import PriceComparison from './PriceComparison';
import EbayListings from './EbayListings';
import OverallScore from './OverallScore';
import SignalSection from './SignalSection';
import SignalNav from './SignalNav';
import LoadingTheater from './LoadingTheater';
import EmptyState from './EmptyState';
import CardBrowser from './CardBrowser';
import WatchedCards from './WatchedCards';
import NewsStrip from './NewsStrip';
import PdfReport from './PdfReport';
import { SIGNAL_SECTIONS, calculateOverallScore } from '../config/signals';
import { analyzeCard } from '../services/analyzeCard';
import { exportReportToPdf, shareReportAsPdf } from '../services/exportReport';
import { lookupBySetCode, looksLikeSetCode } from '../services/lookupBySetCode';
import { getCachedScan, setCachedScan, clearCachedScan } from '../services/scanCache';
import { startScanKeepAlive, stopScanKeepAlive } from '../services/scanKeepAlive';
import { useIsMobile } from '../hooks/useIsMobile';

export default function SignalDashboard() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingCard, setPendingCard] = useState(null);
  const [lastSearched, setLastSearched] = useState(null);
  const [saveMsg, setSaveMsg] = useState(null);
  const [cardImageUrl, setCardImageUrl] = useState(null);
  const [pdfRendering, setPdfRendering] = useState(false);
  const isMobile = useIsMobile();

  const flashSaveMsg = (msg) => {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg((m) => (m === msg ? null : m)), 3500);
  };

  // Held across renders so the brand-mark "go home" handler can abort an
  // in-flight scan and so a stale scan-result can't punch its way onto the
  // home page if the user navigates away mid-scan.
  const abortRef = useRef(null);
  const navTokenRef = useRef(0);

  const goHome = () => {
    navTokenRef.current += 1;
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
      abortRef.current = null;
    }
    setResult(null);
    setError(null);
    setLoading(false);
    setLastSearched(null);
    setPendingCard(null);
  };

  const handleSearch = async (query, game = null, opts = {}) => {
    const { force = false } = opts;
    setError(null);

    // Fast-path cache check BEFORE flipping loading state — already-scanned
    // cards must return instantly with zero loading-theater flash.
    if (!force && game) {
      const fastCached = getCachedScan(query, game);
      // eslint-disable-next-line no-console
      console.warn('[signal:cache] fast-path lookup', { query, game, hit: !!fastCached });
      if (fastCached) {
        setResult(fastCached);
        setLastSearched({ name: query, game });
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
        }
      } catch {}
    }

    setLastSearched({ name: resolvedName, game: resolvedGame });

    // Second cache check now that the set-code resolved (if it did).
    if (!force) {
      const cached = getCachedScan(resolvedName, resolvedGame);
      if (cached) {
        setResult(cached);
        return;
      }
    }

    // Cache miss — now we actually need to scan.
    setLoading(true);
    setResult(null);
    setPendingCard({ name: resolvedName, game: resolvedGame });

    const controller = new AbortController();
    abortRef.current = controller;
    const myToken = ++navTokenRef.current;
    // 150s hard ceiling. Most scans land in 30-60s; the long tail (full
    // 10-13 web_search budget on a slow card / congested model) used to skirt
    // the old 90s wall. 150s covers the 99th percentile without sacrificing
    // search coverage or model quality.
    const timeout = setTimeout(() => controller.abort(), 120000);

    // Foreground service keeps the request alive if the user minimizes the app
    // mid-scan (Android/Samsung otherwise freezes the app and aborts the fetch).
    startScanKeepAlive();

    try {
      const data = await analyzeCard(resolvedName, resolvedGame, { signal: controller.signal });
      // If goHome() bumped the nav token while we were scanning, the user has
      // already left the result page — do NOT yank them back by setting result.
      if (myToken !== navTokenRef.current) return;
      setResult(data);
      // Cache under BOTH the input game and the LLM-detected game so future
      // clicks from any surface hit the cache.
      setCachedScan(resolvedName, resolvedGame, data);
      if (data?.game && data.game !== resolvedGame) {
        setCachedScan(resolvedName, data.game, data);
      }
    } catch (err) {
      if (myToken !== navTokenRef.current) return;
      if (err.name === 'AbortError') {
        setError('Scan exceeded 150 seconds. Network or model congestion — retry.');
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
      }
    }
  };

  const score = result
    ? calculateOverallScore(result.signals || [], result.game)
    : null;

  return (
    <div style={{
      maxWidth: 800,
      margin: '0 auto',
      padding: isMobile ? '24px 16px 60px' : '32px 24px 60px',
      position: 'relative',
    }}>
      {/* Header — wordmark inside a hairline red border. */}
      {/* Kanji slightly smaller than "Signal"; Signal in Syne, no italic. */}
      {/* Click anywhere on the wordmark to go home — aborts an in-flight scan
          if one is running, drops result/error state otherwise. */}
      <div style={{ textAlign: 'center', marginBottom: 32, marginTop: isMobile ? 28 : 0 }}>
        <div
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

      {/* Search */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        marginBottom: 40,
      }}>
        <SearchBar onSearch={handleSearch} loading={loading} />
        <QuickPicks onSelect={handleSearch} loading={loading} />
        <RecentScans onSelect={handleSearch} loading={loading} />
      </div>

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
              onClick={() => lastSearched && handleSearch(lastSearched.name, lastSearched.game)}
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
          />
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {/* Result-page actions: back to dashboard + save as PDF.
              Save PDF captures the #signal-report-capture wrapper below. */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              onClick={() => { setResult(null); setLastSearched(null); }}
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
              onClick={async () => {
                try {
                  setPdfRendering(true);
                  // One animation frame to mount PdfReport, then a short pause
                  // so the off-screen card image + fonts settle before capture.
                  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
                  await new Promise((r) => setTimeout(r, 900));
                  const res = await exportReportToPdf({
                    elementId: 'pdf-report-capture',
                    filename: `signal-${(result.card_name || 'card').toLowerCase().replace(/\s+/g, '-')}.pdf`,
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
                  await shareReportAsPdf({
                    filename: `signal-${(result.card_name || 'card').toLowerCase().replace(/\s+/g, '-')}.pdf`,
                    title: `Signal: ${result.card_name || 'card'}`,
                    text: `${result.card_name || 'Card'} · ${result.summary?.slice(0, 140) || ''}`,
                  });
                } catch (err) {
                  // eslint-disable-next-line no-console
                  console.error('[signal] share failed', err);
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
                clearCachedScan(result.card_name, result.game);
                handleSearch(result.card_name, result.game, { force: true });
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
              onRetry={() => handleSearch(result.card_name, result.game)}
              signals={result.signals || []}
              enPrice={result.prices?.en_price}
              jpPrice={result.prices?.jp_price}
              trend={result.prices?.trend_30d}
              onCardImageLoaded={setCardImageUrl}
            />
          )}

          <PriceComparison
            data={{
              ...result.prices,
              trend_30d: result.prices?.trend_30d,
              signal_vs_market: result.prices?.signal_vs_market,
            }}
            jpMatch={(result.signals || []).find(s => s.key === 'jp_price')?.jp_match}
          />

          <EbayListings data={result.ebay_listings} />

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
          <CardBrowser onCardSelect={handleSearch} />
        </>
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
            <PdfReport result={result} score={score} cardImageUrl={cardImageUrl} />
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
    </div>
  );
}
