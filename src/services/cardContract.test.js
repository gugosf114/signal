import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sources = {
  dashboard: read('../components/SignalDashboard.jsx'),
  search: read('../components/SearchBar.jsx'),
  scanner: read('../components/CardScanner.jsx'),
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
  cardData: read('./fetchCardData.js'),
  signals: read('../config/signals.js'),
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

  test('every relevant screen shows exact identity and market facts', () => {
    for (const name of ['trending', 'recent', 'watched', 'browser', 'collection', 'add', 'latest', 'score']) {
      assert.match(sources[name], /printingLabel|PrintingIdentity|recentPrintingLine/, `${name} must show the exact printing`);
    }
    for (const name of ['search', 'scanner', 'trending', 'recent', 'watched', 'browser', 'collection', 'add', 'latest', 'score', 'price', 'pdf']) {
      assert.match(sources[name], /price|Price|enPrice/, `${name} must carry or show exact price data`);
    }
    assert.match(sources.loading, /printingLabel\(pin\)/);
    assert.match(sources.loading, /CardSlate cardName=\{cardName\} game=\{game\} pin=\{pin\}/);
    assert.match(sources.loading, /cardPriceLabel\(pin\)/);
    assert.match(sources.price, /price_source/);
    assert.match(sources.pdf, /Price Source/);
    for (const name of ['recent', 'watched', 'collection']) {
      assert.match(sources[name], /refreshPrices/, `${name} must refresh its exact saved price`);
    }
  });

  test('cache and reopen storage are identity-only', () => {
    assert.match(sources.cache, /return identity \? `\$\{\(game \|\| pin\?\.game/);
    assert.match(sources.cache, /if \(!name \|\| !isExactScanTarget\(game, exactPin\)\) return null/);
    assert.match(sources.cache, /withCardRecord/);
    assert.match(sources.session, /normalizeCardRecord/);
  });

  test('the retired 30-day field is absent from every user-facing surface', () => {
    for (const name of ['dashboard', 'latest', 'price', 'pdf', 'signals']) {
      assert.doesNotMatch(sources[name], /30[- ]?day|trend_30d/i, `${name} still exposes the retired field`);
    }
    assert.doesNotMatch(sources.latest, /SAMPLE_DATA|Sample Signal/);
  });
});
