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
const emptyStateSource = readFileSync(new URL('../components/EmptyState.jsx', import.meta.url), 'utf8');
const scrollRevealSource = readFileSync(new URL('../components/ScrollReveal.jsx', import.meta.url), 'utf8');

test('ambient art cannot widen the page horizontally', () => {
  const dashboard = css.match(/\.signal-dashboard\s*\{([^}]*)\}/)?.[1] || '';
  const ambient = css.match(/\.signal-ambient\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(dashboard, /overflow-x:\s*clip/);
  assert.match(dashboard, /overscroll-behavior-x:\s*none/);
  assert.match(ambient, /left:\s*0;/);
  assert.match(ambient, /right:\s*0;/);
});

test('ambient orbs keep enough contrast for bright surroundings', () => {
  const field = css.match(/\.signal-ambient-field\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(field, /filter:\s*blur\(36px\) saturate\(1\.18\)/);
  assert.doesNotMatch(field, /blur\(44px\)/);
  for (const [selector, opacity] of [
    ['signal-ambient-field--red', '0.52'],
    ['signal-ambient-field--gold', '0.4'],
    ['signal-ambient-field--cool', '0.46'],
    ['signal-ambient-field--lower-red', '0.46'],
    ['signal-ambient-field--lower-gold', '0.44'],
    ['signal-ambient-field--lower-cool', '0.42'],
  ]) {
    const rule = css.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`))?.[1] || '';
    assert.match(rule, new RegExp(`rgba\\([^)]*, ${opacity.replace('.', '\\.')}\\)`));
  }
});

test('home attention pass reuses the existing logo, search, tiles, marks, and news', () => {
  assert.match(dashboardSource, /className="signal-logo-frame"/);
  assert.match(searchSource, /className="signal-search-form"/);
  assert.doesNotMatch(searchSource, /accentBorder/);
  assert.doesNotMatch(dashboardSource, /<SearchBar[\s\S]{0,400}accentBorder/);
  assert.match(searchSource, /border: `1px solid \$\{focused \? '#2A2D34' : '#1A1D24'\}`/);
  assert.match(quickPicksSource, /quick-pick-card/);
  assert.match(quickPicksSource, /<GameMark game=\{card\.game\} compact alive \/>/);
  assert.match(gameMarkSource, /game-row-mark--alive/);
  assert.match(newsSource, /news-strip-shell--foil/);
  assert.match(newsSource, /--news-card-accent/);
  assert.match(newsSource, /IntersectionObserver/);
  assert.match(newsSource, /centeredNewsIndex/);
  assert.match(newsSource, /foilActive=\{!reducedMotion && foilVisible/);
  assert.match(newsSource, /npc-foil-bloom/);
  assert.match(newsSource, /npc-foil-sweep/);
  assert.match(css, /@keyframes newsFoilBloom/);
  assert.match(css, /@keyframes newsCardFoil/);
  assert.match(css, /\.npc-foil-sweep::before/);
  assert.doesNotMatch(css, /\.npc-above::after/);
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

test('home uses one compact latest Signal panel before Browse Cards', () => {
  assert.match(emptyStateSource, /function LatestSignalPanel/);
  assert.match(emptyStateSource, /className="latest-signal fade-slide-up"/);
  assert.match(emptyStateSource, /className="latest-signal-market"/);
  assert.match(emptyStateSource, /className="latest-signal-creator"/);
  assert.doesNotMatch(emptyStateSource, /empty-state-tiles|ScoreTile|PriceTile|SignalTile/);
  assert.match(dashboardSource, /<CardBrowser onCardSelect=\{handleSearch\} accentBorder compactTop \/>/);
  assert.match(browserSource, /marginTop: compactTop \? 18 : 40/);
  assert.match(css, /\.latest-signal-wrap \{ padding: 22px 0 0; \}/);
  assert.match(css, /\.latest-signal-market/);
});

test('all page sections reveal once on scroll without taking over child transforms', () => {
  assert.match(scrollRevealSource, /IntersectionObserver/);
  assert.match(scrollRevealSource, /observer\.disconnect\(\)/);
  assert.match(scrollRevealSource, /rootMargin: '0px 0px 14% 0px'/);
  assert.match(scrollRevealSource, /scroll-reveal--\$\{visible \? 'visible' : 'pending'\}/);
  assert.ok((dashboardSource.match(/<ScrollReveal/g) || []).length >= 7);
  assert.match(dashboardSource, /SIGNAL_SECTIONS\.map[\s\S]{0,100}<ScrollReveal key=\{section\.id\}/);
  assert.ok((collectionSource.match(/<ScrollReveal/g) || []).length >= 6);
  assert.ok((dossierSource.match(/<ScrollReveal/g) || []).length >= 4);
  for (const source of [quickPicksSource, recentScansSource, newsSource, emptyStateSource, browserSource, watchedSource]) {
    assert.match(source, /<ScrollReveal/);
  }
  const revealRule = css.match(/\.scroll-reveal\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(revealRule, /translate:\s*0 14px/);
  assert.doesNotMatch(revealRule, /transform:/);
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /\.scroll-reveal/);
  assert.match(reduced, /opacity:\s*1 !important/);
  assert.match(dashboardSource, /<div id="pdf-report-capture">\s*<PdfReport/);
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
  assert.match(reduced, /npc-foil-bloom/);
  assert.match(reduced, /npc-foil-sweep/);
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
