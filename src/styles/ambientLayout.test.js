import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./animations.css', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('../components/SignalDashboard.jsx', import.meta.url), 'utf8');
const searchSource = readFileSync(new URL('../components/SearchBar.jsx', import.meta.url), 'utf8');
const quickPicksSource = readFileSync(new URL('../components/QuickPicks.jsx', import.meta.url), 'utf8');
const recentScansSource = readFileSync(new URL('../components/RecentScans.jsx', import.meta.url), 'utf8');
const gameMarkSource = readFileSync(new URL('../components/GameMark.jsx', import.meta.url), 'utf8');
const newsSource = readFileSync(new URL('../components/NewsStrip.jsx', import.meta.url), 'utf8');

test('ambient art cannot widen the page horizontally', () => {
  const dashboard = css.match(/\.signal-dashboard\s*\{([^}]*)\}/)?.[1] || '';
  const ambient = css.match(/\.signal-ambient\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(dashboard, /overflow-x:\s*clip/);
  assert.match(dashboard, /overscroll-behavior-x:\s*none/);
  assert.match(ambient, /left:\s*0;/);
  assert.match(ambient, /right:\s*0;/);
});

test('home attention pass reuses the existing logo, search, tiles, marks, and news', () => {
  assert.match(dashboardSource, /signal-logo-frame--launch/);
  assert.match(dashboardSource, /homePulse/);
  assert.match(searchSource, /signal-search-form--home/);
  assert.match(quickPicksSource, /quick-pick-card/);
  assert.match(quickPicksSource, /<GameMark game=\{card\.game\} compact alive \/>/);
  assert.match(gameMarkSource, /game-row-mark--alive/);
  assert.match(newsSource, /news-strip-shell--foil/);
  assert.match(newsSource, /--news-card-accent/);
  assert.match(newsSource, /foilActive=\{index % articles\.length === activeIdx\}/);
  assert.match(css, /\.npc-outer--foil-active \.npc-above::after/);
});

test('only the first three recent scans receive the slab impact', () => {
  assert.match(recentScansSource, /const isSlab = i < 3/);
  assert.match(recentScansSource, /recent-scans-panel--intro-/);
  assert.match(recentScansSource, /recent-scan-slab/);
  assert.match(css, /@keyframes recentSlabDrop/);
  assert.match(css, /@keyframes recentSlabImpact/);
  assert.match(css, /@keyframes recentSlabDust/);
});

test('home attention motion has a reduced-motion exit', () => {
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /signal-logo-frame--launch::before/);
  assert.match(reduced, /signal-search-form--home::after/);
  assert.match(reduced, /quick-picks-panel--intro-active/);
  assert.match(reduced, /news-strip-shell--foil/);
  assert.match(reduced, /npc-above::after/);
  assert.match(reduced, /recent-scans-panel--intro-active/);
  assert.match(reduced, /recent-scan-slab::after/);
});
