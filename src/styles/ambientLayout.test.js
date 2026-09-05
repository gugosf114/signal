import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./animations.css', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('../components/SignalDashboard.jsx', import.meta.url), 'utf8');
const pageTabsSource = readFileSync(new URL('../components/PageTabs.jsx', import.meta.url), 'utf8');
const searchSource = readFileSync(new URL('../components/SearchBar.jsx', import.meta.url), 'utf8');
const quickPicksSource = readFileSync(new URL('../components/QuickPicks.jsx', import.meta.url), 'utf8');
const recentScansSource = readFileSync(new URL('../components/RecentScans.jsx', import.meta.url), 'utf8');
const collectionSource = readFileSync(new URL('../components/Collection.jsx', import.meta.url), 'utf8');
const dossierSource = readFileSync(new URL('../components/Dossier.jsx', import.meta.url), 'utf8');
const gameMarkSource = readFileSync(new URL('../components/GameMark.jsx', import.meta.url), 'utf8');
const newsSource = readFileSync(new URL('../components/NewsStrip.jsx', import.meta.url), 'utf8');
const browserSource = readFileSync(new URL('../components/CardBrowser.jsx', import.meta.url), 'utf8');
const scoreSource = readFileSync(new URL('../components/OverallScore.jsx', import.meta.url), 'utf8');
const priceSource = readFileSync(new URL('../components/PriceComparison.jsx', import.meta.url), 'utf8');
const signalCardSource = readFileSync(new URL('../components/SignalCard.jsx', import.meta.url), 'utf8');
const watchedSource = readFileSync(new URL('../components/WatchedCards.jsx', import.meta.url), 'utf8');
const signalNavSource = readFileSync(new URL('../components/SignalNav.jsx', import.meta.url), 'utf8');
const citationSource = readFileSync(new URL('../components/SourceCitation.jsx', import.meta.url), 'utf8');

test('ambient art cannot widen the page horizontally', () => {
  const dashboard = css.match(/\.signal-dashboard\s*\{([^}]*)\}/)?.[1] || '';
  const ambient = css.match(/\.signal-ambient\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(dashboard, /overflow-x:\s*clip/);
  assert.match(dashboard, /overscroll-behavior-x:\s*none/);
  assert.match(ambient, /left:\s*0;/);
  assert.match(ambient, /right:\s*0;/);
});

test('home attention pass reuses the existing logo, search, tiles, marks, and news', () => {
  assert.match(dashboardSource, /className="signal-logo-frame"/);
  assert.match(searchSource, /className="signal-search-form"/);
  assert.match(quickPicksSource, /quick-pick-card/);
  assert.match(quickPicksSource, /<GameMark game=\{card\.game\} compact alive \/>/);
  assert.match(gameMarkSource, /game-row-mark--alive/);
  assert.match(newsSource, /news-strip-shell--foil/);
  assert.match(newsSource, /--news-card-accent/);
  assert.match(newsSource, /foilActive=\{index % articles\.length === activeIdx\}/);
  assert.match(css, /\.npc-outer--foil-active \.npc-above::after/);
});

test('the traveling shine stays on the Signal logo and has no handoff path', () => {
  assert.match(css, /\.signal-logo-frame::after\s*\{/);
  assert.match(css, /animation:\s*signalBorderOrbit 9s linear infinite/);
  assert.match(css, /@keyframes signalBorderOrbit/);
  assert.doesNotMatch(dashboardSource, /claimPageCascade|cascadePage|activeCascade|signal-logo-frame--launch/);
  for (const source of [pageTabsSource, searchSource, quickPicksSource, recentScansSource, newsSource, collectionSource, dossierSource]) {
    assert.doesNotMatch(source, /cascade-border-runner|cascadeActive|homePulse|--cascade/);
  }
  for (const removed of [
    'cascadeLogoHandoff',
    'cascadeShineHandoff',
    'cascadeBorderOrbit',
    'newsCascadeArrival',
    'topCardSplitLight',
    'signal-logo-frame--launch',
    'collection-page--cascade',
    'dos-page--cascade',
  ]) {
    assert.doesNotMatch(css, new RegExp(removed));
  }
});

test('Signal and Collection tile entrances replay on each tab mount', () => {
  assert.match(dashboardSource, /introActive=\{signalHomeReady\}/);
  assert.match(dashboardSource, /entryActive/);
  assert.match(quickPicksSource, /introActive = false/);
  assert.match(recentScansSource, /introActive = false/);
  assert.match(collectionSource, /entryActive = false/);
  assert.match(collectionSource, /collection-page--entry/);
  for (const name of [
    'collectionGollumPeek',
    'collectionPokeballRoll',
    'collectionYgoReveal',
    'collectionMtgIgnite',
  ]) {
    assert.match(css, new RegExp(`@keyframes ${name}`));
  }
});

test('micro-detail pass gives quiet controls a fitting response without changing layout', () => {
  assert.match(searchSource, /signal-photo-trigger/);
  assert.match(searchSource, /signal-main-input/);
  assert.match(scoreSource, /score-watch-button--on/);
  assert.match(priceSource, /price-cell--market/);
  assert.match(signalCardSource, /signal-card-chevron--open/);
  assert.match(signalCardSource, /signal-source-dot--on/);
  assert.match(signalNavSource, /signal-jump-button/);
  assert.match(watchedSource, /watched-chip-open/);
  assert.match(watchedSource, /watched-chip-remove/);
  assert.match(citationSource, /yt-play-button/);
  assert.match(collectionSource, /col-summary-count-value/);
  assert.match(collectionSource, /--top-card-entry-delay/);
  assert.match(collectionSource, /key=\{card\.qty\} className="col-qty-value"/);
  assert.match(browserSource, /cb-sort-chip--on/);
  assert.match(browserSource, /cb-set-chip--on/);
  assert.match(browserSource, /cb-game-tab--on/);
  assert.match(browserSource, /className="cb-card"/);
  assert.match(dossierSource, /entryActive = false/);
  assert.match(dossierSource, /dos-page--entry/);
  for (const name of [
    'microTabSettle',
    'microNewsDotLock',
    'microErrorArrive',
    'microWatchLock',
    'microSourceDotLock',
    'microDataCellSettle',
    'microNumberLock',
    'microCurrencyTick',
    'microTopCardPodium',
    'microQuantityTick',
    'microChipLock',
    'microRuleDraw',
    'microDossierStamp',
  ]) {
    assert.match(css, new RegExp(`@keyframes ${name}`));
  }
});

test('only the first three recent scans receive the slab impact', () => {
  assert.match(recentScansSource, /const isSlab = i < 3/);
  assert.match(recentScansSource, /recent-scans-panel--intro-/);
  assert.match(recentScansSource, /recent-scan-slab/);
  assert.match(css, /@keyframes recentSlabDrop/);
  assert.match(css, /@keyframes recentSlabImpact/);
  assert.match(css, /@keyframes recentSlabDust/);
  assert.match(css, /24% \{ opacity: 0\.768;/);
});

test('home attention motion has a reduced-motion exit', () => {
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /signal-logo-frame::after/);
  assert.match(reduced, /quick-picks-panel--intro-active/);
  assert.match(reduced, /news-strip-shell--foil/);
  assert.match(reduced, /npc-above::after/);
  assert.match(reduced, /recent-scans-panel--intro-active/);
  assert.match(reduced, /recent-scan-slab::after/);
  assert.match(reduced, /collection-page--entry/);
  assert.match(reduced, /price-cell/);
  assert.match(reduced, /col-summary-count-value/);
  assert.match(reduced, /dos-page--entry \.dos-sample-mark/);
  assert.match(reduced, /result-action-button:active/);
  assert.match(reduced, /live-shutter:active/);
  assert.match(reduced, /watched-chip-remove:active/);
});
