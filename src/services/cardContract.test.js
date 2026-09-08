import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sources = {
  dashboard: read('../components/SignalDashboard.jsx'),
  search: read('../components/SearchBar.jsx'),
  scanner: read('../components/CardScanner.jsx'),
  scanImage: read('./scanCardImage.js'),
  nativeScanner: read('./nativeCardScanner.js'),
  nativeCamera: read('../../android/app/src/main/java/com/gugosf114/signal/NativeCardScannerActivity.java'),
  trending: read('../components/QuickPicks.jsx'),
  recent: read('../components/RecentScans.jsx'),
  watched: read('../components/WatchedCards.jsx'),
  browser: read('../components/CardBrowser.jsx'),
  collection: read('../components/Collection.jsx'),
  add: read('../components/AddToCollectionDialog.jsx'),
  latest: read('../components/EmptyState.jsx'),
  score: read('../components/OverallScore.jsx'),
  loading: read('../components/LoadingTheater.jsx'),
  price: read('../components/PriceComparison.jsx'),
  pdf: read('../components/PdfReport.jsx'),
  cache: read('./scanCache.js'),
  session: read('./scanSession.js'),
  analysis: read('./analyzeCard.js'),
  evidence: read('./citations.js'),
  validation: read('./validateAnalysis.js'),
  cardData: read('./fetchCardData.js'),
  signals: read('../config/signals.js'),
  styles: read('../styles/animations.css'),
};

describe('every card door uses one exact record', () => {
  test('name, number, camera, upload, and every saved-card route meet one gate', () => {
    assert.match(sources.search, /normalizeCardRecord/);
    assert.match(sources.search, /isExactScanTarget/);
    assert.match(sources.dashboard, /normalizeCardRecord\(resolvedPin/);
    assert.match(sources.dashboard, /isExactScanTarget\(resolvedGame, resolvedPin\)/);
    assert.equal((sources.dashboard.match(/await analyzeCard\(/g) || []).length, 1);
    assert.match(sources.trending, /pin: card \}/);
    assert.match(sources.recent, /pin: s\.pin \|\| null/);
    assert.match(sources.watched, /pin: card\.pin \|\| null/);
    assert.match(sources.browser, /pin: c \}/);
    assert.match(sources.collection, /onLookup\(card\.name, card\.game, \{ pin: card \}\)/);
    assert.match(sources.session, /withCardRecord/);
    assert.match(sources.analysis, /isExactScanTarget\(game, pin\)/);
    assert.match(sources.cardData, /isExactScanTarget\(game, exactPin\)/);
  });

  test('detail screens show exact identity and market facts', () => {
    for (const name of ['browser', 'collection', 'add', 'latest', 'score']) {
      assert.match(sources[name], /printingLabel|PrintingIdentity|recentPrintingLine/, `${name} must show the exact printing`);
    }
    for (const name of ['search', 'scanner', 'browser', 'collection', 'add', 'latest', 'score', 'price', 'pdf']) {
      assert.match(sources[name], /price|Price|enPrice/, `${name} must carry or show exact price data`);
    }
    assert.match(sources.loading, /printingLabel\(pin\)/);
    assert.match(sources.loading, /CardSlate cardName=\{cardName\} game=\{game\} pin=\{pin\}/);
    assert.match(sources.price, /price_source/);
    assert.match(sources.pdf, /Price Source/);
    for (const name of ['recent', 'watched', 'collection']) {
      assert.match(sources[name], /refreshPrices/, `${name} must refresh its exact saved price`);
    }
  });

  test('compact cards keep their old shapes and pass the full record underneath', () => {
    assert.equal((sources.browser.match(/minmax\(100px, 1fr\)/g) || []).length, 2);
    assert.match(sources.browser, /onCardSelect\(c\.name, c\.game, \{ pin: c \}\)/);

    assert.match(sources.trending, /gridTemplateColumns: 'repeat\(2, minmax\(0, 1fr\)\)'/);
    assert.match(sources.trending, /maxHeight: 108/);
    assert.match(sources.trending, /minHeight: 32/);
    assert.doesNotMatch(sources.trending, /printingLabel|cardPriceLabel/);

    assert.match(sources.recent, /gridTemplateColumns: '72px minmax\(0, 1\.25fr\) minmax\(0, 0\.75fr\)'/);
    assert.match(sources.recent, /onSelect\(s\.name, s\.game, \{ pin: s\.pin \|\| null \}\)/);
    assert.doesNotMatch(sources.recent, /cardPriceLabel/);

    assert.match(sources.watched, /className="watched-chip"/);
    assert.match(sources.watched, /onSelect\(card\.name, card\.game, \{ pin: card\.pin \|\| null \}\)/);
    assert.doesNotMatch(sources.watched, /flexDirection: 'column'/);

    assert.match(sources.collection, /className="col-card"/);
    assert.doesNotMatch(sources.collection, /className="col-printing"/);
    assert.match(sources.collection, /onLookup\(card\.name, card\.game, \{ pin: card \}\)/);

    assert.doesNotMatch(sources.loading, /lt-cardslate-price/);
    assert.match(sources.styles, /\.quick-price-card \{[\s\S]*?grid-template-columns: 52px minmax\(0, 1fr\) auto;/);
    assert.match(sources.styles, /\.live-match-card \{[\s\S]*?grid-template-columns: 58px minmax\(0, 1fr\) auto;/);
  });

  test('cache and reopen storage are identity-only', () => {
    assert.match(sources.cache, /return identity \? `\$\{\(game \|\| pin\?\.game/);
    assert.match(sources.cache, /if \(!name \|\| !isExactScanTarget\(game, exactPin\)\) return null/);
    assert.match(sources.cache, /withCardRecord/);
    assert.match(sources.session, /normalizeCardRecord/);
  });

  test('the 30-day figure is only ever the exact SKU history, never the retired estimate', () => {
    for (const name of ['dashboard', 'latest', 'price', 'pdf', 'signals']) {
      assert.doesNotMatch(sources[name], /trend_30d/i, `${name} still exposes the retired field`);
    }
    // Surfaces that print a 30-day move read it from prices.history, which
    // only exists when TCGplayer answered for this exact product SKU.
    for (const name of ['latest', 'price', 'pdf']) {
      if (/30[- ]?day/i.test(sources[name])) assert.match(sources[name], /history/, `${name} shows a 30-day move without the exact history`);
    }
    assert.doesNotMatch(sources.signals, /30[- ]?day|trend_30d/i);
    assert.doesNotMatch(sources.latest, /SAMPLE_DATA|Sample Signal/);
  });

  test('source identity belongs to retrieval and empty schema slots never pose as evidence', () => {
    assert.match(sources.analysis, /lockSourcesToEvidence\(normalized, evidenceRegistry/);
    assert.match(sources.analysis, /fillEvidenceGaps\(locked, evidenceRegistry/);
    assert.match(sources.analysis, /buildVerifiedSummary/);
    assert.match(sources.evidence, /Model-written metadata and factual[\s\S]*prose are discarded/);
    assert.match(sources.evidence, /level: sources\.length \? signal\.level : 0/);
    assert.match(sources.score, /AREAS SOURCED/);
    assert.match(sources.score, /UNIQUE SOURCE/);
    assert.doesNotMatch(sources.score, /SIGNALS · .*VERIFIED SOURCES/);
    assert.match(sources.cache, /signal_scan_cache_v3/);
    assert.match(sources.session, /signal_active_scan_v3/);
    assert.doesNotMatch(sources.validation, /source: text\(source\.source/);
    assert.doesNotMatch(sources.validation, /title: text\(source\.title/);
  });

  test('Gemini reads photos, the catalog gates them, and Sonnet is fallback only', () => {
    assert.match(sources.scanImage, /identifyCardViaGemini/);
    assert.match(sources.scanImage, /claude-sonnet-4-6/);
    assert.match(sources.search, /identifyAndResolve\('gemini'\)/);
    assert.match(sources.search, /if \(gemini\.candidates\.length\) return gemini/);
    assert.match(sources.search, /identifyAndResolve\('sonnet'\)/);
    assert.match(sources.search, /!candidates\[0\]\?\.requiresOwnerChoice/);
  });

  test('native card scans preserve the explicit Price and Full Signal modes', () => {
    assert.match(sources.search, /aria-label="Choose scan or upload"/);
    assert.match(sources.search, /LookupModeToggle/);
    assert.match(sources.search, /<strong>Scan card<\/strong>/);
    assert.match(sources.search, /<strong>Batch scan<\/strong>/);
    assert.match(sources.search, /<strong>Upload photo<\/strong>/);
    assert.match(sources.scanner, /const priceOnly/);
    assert.match(sources.scanner, />Add to collection</);
    assert.match(sources.scanner, />Confirm & run full Signal</);
    assert.match(sources.scanner, />Done · Price only</);
    assert.doesNotMatch(sources.scanner, />AUTO<|SET \/ NUMBER/);
    assert.doesNotMatch(sources.styles, /live-scanner-preview[^}]*brightness/);
    assert.match(sources.nativeScanner, /scanCardsNatively/);
    assert.match(sources.nativeCamera, /LifecycleCameraController/);
    assert.match(sources.nativeCamera, /CAPTURE_MODE_MAXIMIZE_QUALITY/);
    assert.match(sources.nativeCamera, /setHideOverlayWindows\(true\)/);
    assert.match(sources.scanner, /live-scanner--native-wait/);
    assert.doesNotMatch(sources.scanner, /if \(!shouldRenderScannerShell[^\n]*\) return null/);
  });
});
