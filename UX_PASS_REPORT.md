# Signal UX Pass — Report

## Cluster C — Critical

### C1. Mobile responsive overhaul

**`src/hooks/useIsMobile.js`** (new file)
- Custom hook that wraps `window.innerWidth < breakpoint` with a resize listener. Used in components instead of CSS `!important` overrides, keeping the existing inline-style pattern intact.

**`src/components/OverallScore.jsx`**
- `gridTemplateColumns` switches from `'200px 1fr'` → `'1fr'` at < 640px (line 57–58)
- Art cell becomes `height: 120px` banner with no right border, bottom border separating it from data (lines 62–70)
- `CardImage` size drops from 220 → 100 on mobile (line 71)
- Kanji watermark hidden below 768px via second `useIsMobile(768)` call (lines 12, 137–149)
- `textWrap: 'balance'` added to h1 card title (L2, line 87)

**`src/components/PriceComparison.jsx`**
- Below 640px: outer container switches from `display: flex` to `display: grid; grid-template-columns: repeat(6, 1fr)` (lines 41–50)
- EN cell: `gridColumn: '1 / 4'`; JP cell: `gridColumn: '4 / 7'` — 50/50 top row
- ARBITRAGE: `1/3`, 30-DAY TREND: `3/5`, ALIGNMENT: `5/7` — 33/33/33 bottom row with `borderTop`
- Divider `<div>` elements hidden on mobile via `{!isMobile && <div.../>}` pattern

**`src/components/SignalDashboard.jsx`**
- Outer padding: desktop `'32px 24px 60px'`, mobile `'24px 16px 60px'` via `isMobile` (line 23)

**`src/styles/animations.css`** (appended)
- `@media (max-width: 639px)`: pip labels hidden, pip-meta hidden, markets badge hidden, cardslate-name max-width 160px, Solari title `font-size: 12px; letter-spacing: 0.04em; flex-wrap: nowrap; overflow: hidden` to prevent wrapping on long phase titles, canvas padding reduced
- **Bug fix (pre-existing):** `@media (max-width: 760px) { .lt-log, .lt-grid { display: none } }` was overridden by later `.lt-log { display: flex }` in source order. Re-declared at end of file to fix the cascade. Side rails now correctly hide on mobile.

**Before/after:** `signal-ux-pass-C/empty-375x812.png` (before) → `signal-ux-pass-final/result-375x812.png` (after)

---

### C2. Solari flip animation pacing

**`src/components/LoadingTheater.jsx`** — `SolariTitle` function (lines ~248–295)

- `STAGGER`: 65ms → 38ms. A 26-char title now has all letters starting their cycle within ~1s instead of ~2.7s.
- Added `prevTargetsRef = useRef([])` + `useEffect(() => { prevTargetsRef.current = targets }, [targets])`. Because the effect runs after render, on the first render with new targets the ref still holds the old chars. Pre-cycle letters (`dt < startAt`) now render the previous-phase character at `opacity: 0.28` instead of a bare `·` placeholder.
- Removed special-casing of `'·'` and `'—'` since they no longer appear as placeholders.
- Phase transition snap-lock is handled automatically by `t0 = useMemo(() => Date.now(), [text])` — when `text` changes, `t0` resets and the whole animation restarts with new targets.

**Judgment call:** On very first mount (no previous phase), pre-cycle positions fall back to the target character itself at 0.28 opacity, creating a "fades in from dim" effect rather than cycling from blank. Looks intentional, not broken.

---

### C3. JP section to top

**`src/config/signals.js`** — `SIGNAL_SECTIONS` array (line 4)

Order changed: `japan → short-term → structural` (was `short-term → structural → japan`). JP is now the first section a user sees after the price strip.

---

## Cluster H — High Impact

### H1. Empty state with product preview

**`src/components/EmptyState.jsx`** (new file, ~130 lines)

Three tiles: `ScoreTile` (82/100 SURGING Charizard ex), `PriceTile` (EN/JP prices + ARBITRAGE/30-DAY TREND), `SignalTile` (Creator Attention with YouTube citation). Uses actual brand icons (BrandIcon), actual type system, actual HeatBar dots. Horizontally stacked desktop, stacks vertically at ≤ 640px via `.empty-state-tiles` CSS class.

Subtitle: "Scan any card across 30+ sources — creator buzz, tournament data, Mercari JP, eBay sold listings — in 30 seconds."

**`src/components/SignalDashboard.jsx`** — replaces single italic line with `<EmptyState />` (line 138)

---

### H2. Score anchor — relative position

**`src/components/OverallScore.jsx`** — `useEffect` at lines 18–48

- Saves `{score, date, cardName, game}` to `signal_score_history` (max 100), deduping by `cardName + game` so repeated scans of the same card don't inflate the count.
- Also populates `signal_recent_scans` (max 8) for L5.
- After ≥ 5 entries, computes `topPct = 100 - (lowerCount / total * 100)` and renders `"Top X% of your last N scans"` in JetBrains Mono 10px below the score number (lines 103–110).
- All localStorage ops wrapped in `try/catch` (Safari private mode).

---

### H3. Rename PriceComparison labels

**`src/components/PriceComparison.jsx`**

- `'Sig·Mkt'` → `'Alignment'` (renders as ALIGNMENT via `textTransform: uppercase`)
- `'30D'` → `'30-Day Trend'` (renders as 30-DAY TREND)
- `'JP↔EN Gap'` → `'Arbitrage'` (renders as ARBITRAGE)

Style unchanged (Syne 8px caps with 0.16em letter-spacing).

---

### H4. Score vocabulary overhaul

**`src/config/signals.js`** — `getScoreLabel` (line 145)

| Score | Before | After |
|-------|--------|-------|
| 75–100 | HOT | SURGING |
| 50–74 | WARMING | HEATING |
| 30–49 | LUKEWARM | STEADY |
| 0–29 | COLD | DORMANT |

Colors unchanged. All four labels confirmed in browser.

---

### H5. Promote section headers

**`src/components/SignalSection.jsx`** (full rewrite)

- Section label: 10px → 12px, `#3A3830` → `#8A8678` at opacity 0.85 for non-JP sections
- 2px colored left bar added per section: JP = `#C44040`, short-term = `#A09060`, structural = `#7E7894`
- Header row uses `alignItems: 'flex-start'` with gap to accommodate the bar
- `flexWrap: 'wrap'` on label+subtitle div so subtitle stacks on very narrow widths
- Subtitle prefix glyph: `⏱` prepended to short-term subtitle
- Japan section retains its serif italic red treatment — distinct but no longer disproportionately privileged

---

## Cluster M — Medium Polish

### M1. Padding tightened

Done in C1 (SignalDashboard outer padding). Desktop: `32px 24px 60px` (was `48px 24px 80px`).

---

### M2. YouTube citations 2-up grid on desktop

**`src/components/SignalCard.jsx`** — expanded panel (lines ~105–128)

- `extractYouTubeId` imported from `brandIcons`
- Sources split into `ytSources` and `otherSources`
- When `ytSources.length >= 2`, rendered in `<div className="yt-sources-grid">` (2-col grid at ≥ 768px, 1-col below)
- Non-YouTube citations stay single-column below YouTube group

CSS in `animations.css`: `.yt-sources-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }` + mobile override.

---

### M3. Stronger expand affordance

**`src/components/SignalCard.jsx`**

- Outer div: `role="button"`, `tabIndex={0}`, `aria-expanded={expanded}` (lines 76–78)
- `onKeyDown`: Space + Enter toggle expansion (line 81)
- `--signal-color` CSS variable set on outer div for focus ring
- `className="signal-card-row"` on outer div, `className="signal-card-label"` on label span
- CSS: `.signal-card-row:hover .signal-card-label { text-decoration: underline; text-underline-offset: 3px; }` and `:focus-visible { outline: 1px solid var(--signal-color) }`
- Chevron: 8px → 11px, color `#2A2820` → `#5A5850` (lines 116–124)

---

### M4. PARTIAL state inline

**`src/components/OverallScore.jsx`** — replaced tooltip pill with inline line (lines 112–133)

`"PARTIAL · {N} of 9 signals [Retry] for full data"` — JetBrains Mono 11px `#A09060`. Retry button calls `onRetry()` which is wired up in SignalDashboard to `handleSearch(result.card_name, result.game)`.

**`src/components/SignalDashboard.jsx`** — passes `signalCount` + `onRetry` props to OverallScore (lines 120–123).

---

### M5. Error state with retry

**`src/components/SignalDashboard.jsx`** — error block (lines 66–99)

- 3px left `#C44040` border, `rgba(196,64,64,0.04)` background, 16px padding
- "Scan failed" header + card name (from `lastSearched` state, which persists through `finally` block)
- Error message in JetBrains Mono
- "Retry scan" button + "Check spelling · TCG card names are exact" tip
- `lastSearched` state added (line 16) to preserve card name after `pendingCard` is cleared in `finally`

---

### M6. Quick picks audit

**`src/config/signals.js`** — `SAMPLE_CARDS` array (line 114)

- Added 3 confirmed real current cards at front: `Umbreon ex (Stellar Crown)`, `Dragapult ex (Twilight Masquerade)`, `Charizard ex (SV 151)`
- Three flagged '25/'26 cards kept with `// TODO_VERIFY: set names below are unconfirmed` comment
- Fiendsmith Lurgia (Legacy of Destruction) and Snake-Eye Ash (Age of Overlord) confirmed real Yu-Gi-Oh cards — kept unchanged

---

## Cluster L — Low

### L1. HeatBar → 5-dot bar

**`src/components/HeatBar.jsx`** (full rewrite, ~20 lines)

5 × 6px circles: filled in `color`, empty in `#1A1D24`. Gap 3px. No text. `border-radius: 50%`.

---

### L2. Card title balance

**`src/components/OverallScore.jsx`** — h1 style (line 87)

`textWrap: 'balance'`, `lineHeight: 1.0` added. Better for long Yu-Gi-Oh names.

---

### L3. Disclaimer legibility

**`src/components/SignalDashboard.jsx`** — disclaimer div (lines 126–136)

`#2A2820` → `#3A3830`, `9px` → `10px`.

---

### L4. Header logo tighten

**`src/components/SignalDashboard.jsx`** — header section (lines 26–55)

Single horizontal row with `display: flex; alignItems: center; gap: 14; marginBottom: 24` (was centered column with `marginBottom: 40`). Badge padding reduced from `9px 22px 9px 16px` to `7px 16px 7px 12px`. Font sizes: 株 26px → 24px, Signal 22px → 20px. ~40% vertical space reduction.

---

### L5. Recent scans strip

**`src/components/RecentScans.jsx`** (new file, ~55 lines)

Reads `signal_recent_scans` from localStorage. Shows chips formatted as `{score} · {cardName}` — score colored in game color. Hidden if no history. Wired into SignalDashboard below QuickPicks.

History is populated in `OverallScore`'s `useEffect` (same effect that handles H2 score history).

---

## Judgment calls

1. **Solari pre-cycle glyph:** Brief said "previous phase's character at 0.3 opacity." On first mount there is no previous text — used the target character at dim opacity instead of a blank or dot. Makes the initial reveal feel intentional.

2. **PriceComparison bottom row label case:** Brief specifies "ALIGNMENT", "30-DAY TREND", "ARBITRAGE" in caps — source code uses title case ("Alignment" etc.) relying on `textTransform: uppercase` from `labelStyle`. Rendered output is correct uppercase.

3. **LoadingTheater cascade bug fix:** The original `@media (max-width: 760px) { .lt-log { display: none } }` rule was placed before the `.lt-log { display: flex }` definition in the file, causing it to be overridden by later source order. Re-declared at end of file. This is a pre-existing bug fix, not a regression.

4. **L6 (comparison view):** Not shipped. Scope explicitly noted in brief as conditional on time. Would require significant new component work.

5. **L7 (score contribution tap):** Not shipped. Scope too large for remaining time.

---

## Screenshot index

| File | Viewport | State |
|------|----------|-------|
| `signal-ux-pass-final/empty-375x812.png` | 375×812 | Empty |
| `signal-ux-pass-final/empty-390x844.png` | 390×844 | Empty |
| `signal-ux-pass-final/empty-768x1024.png` | 768×1024 | Empty |
| `signal-ux-pass-final/empty-1440x900.png` | 1440×900 | Empty |
| `signal-ux-pass-final/loading-mid-375x812.png` | 375×812 | Loading mid-phase |
| `signal-ux-pass-final/loading-mid-1440x900.png` | 1440×900 | Loading mid-phase |
| `signal-ux-pass-final/result-375x812.png` | 375×812 | Full result |
| `signal-ux-pass-final/result-390x844.png` | 390×844 | Full result |
| `signal-ux-pass-final/result-768x1024.png` | 768×1024 | Full result |
| `signal-ux-pass-final/result-1440x900.png` | 1440×900 | Full result |
| `signal-ux-pass-final/expanded-signal-375x812.png` | 375×812 | Signal expanded |
| `signal-ux-pass-final/expanded-signal-1440x900.png` | 1440×900 | Signal expanded |
| `signal-ux-pass-final/error-375x812.png` | 375×812 | Error state |

---

## Files changed

```
src/hooks/useIsMobile.js               (new)
src/components/EmptyState.jsx          (new)
src/components/RecentScans.jsx         (new)
src/components/SignalDashboard.jsx     (modified)
src/components/OverallScore.jsx        (modified)
src/components/PriceComparison.jsx     (modified)
src/components/LoadingTheater.jsx      (modified)
src/components/SignalSection.jsx       (modified)
src/components/SignalCard.jsx          (modified)
src/components/HeatBar.jsx             (modified)
src/config/signals.js                  (modified)
src/styles/animations.css              (modified)
```

Working tree UNCOMMITTED — awaiting human review.
