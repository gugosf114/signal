# 株 Signal

Trading card price intelligence powered by alternative data signals. Japanese
market intelligence included.

Single-card scan returns a 9-signal scorecard with structured, link-verified
citations, weighted to a 0-100 score. Sources span English (TCGPlayer, eBay,
YouTube creators, Reddit, tournaments via Limitless, editorial outlets like
PokeBeach / Game8 / TCGFish) and Japanese (Mercari JP, Yahoo Auctions JP,
Rakuten, JP-language YouTube, JP set release calendars).

Designed as Bloomberg-terminal-meets-Tokyo-3am, not "AI-powered TCG dashboard."

---

## Current state — 2026-05-10

- Last commit on `main`: **893429f** ("Citation upgrade, loading theater, brand
  icons, audit cleanup")
- Stack: Vite 6 + React 18, `simple-icons` NPM, no TypeScript
- Bundle: 213 KB / 70 KB gzipped
- Dev server: `npm run dev` → http://localhost:3000

---

## Session log — 2026-05-10 (Opus 4.7, 1M context)

Layered build-out in one day, shipped as commit `893429f`:

**Citation upgrade.** `analyzeCard.js` schema requires structured `sources[]`
per signal with type/source/title/date/summary/implication/url/reach/audience.
URL filter rejects any cited URL not actually visited via `web_search` —
YouTube matched by extracted video ID, other hosts require slash-boundary
sub-paths, bare-host `/` roots rejected. (Anti-hallucination is the wedge.)

**Loading theater.** 8-phase `LoadingTheater.jsx`: Solari flip-board phase
title, animated SVG data trace per phase, scan-log left rail, 9-signal grid
right rail, twin parallax tickers, 株 kanji backdrop on JP phases, live PT +
Asia/Tokyo clocks. 90s `AbortController` timeout failsafe.

**Brand icons.** `brandIcons.jsx` — real logos via `simple-icons` NPM (inline
SVG, no CDN). Custom inline SVGs for TCG-specific brands not in the library
(TCGPlayer, Yu-Gi-Oh!, MTG, Limitless, PokeBeach, Game8, TCGFish, MTGGoldfish,
Bulbapedia, Mercari, Yahoo!, Pokémon).

**Curated creator directory.** `creators.js` — per-game whitelist with
audience tiers and focus areas. Prompt-injected so Claude reports hits AND
explicit silences from named creators (Leonhart, PokeRev, Real Break Reviews,
Tricky Gym, TCG Protectors for Pokémon; Cimoooooooo, MBT, Farfa, TeamAPS,
Dkayed for YGO; Alpha Investments, The Professor, CovertGoBlue, MTGGoldfish,
Saffron Olive for MTG).

**Audit cleanup (3 BLOCKERs + 6 HIGHs + 8 MEDIUMs):** hallucination filter
pathname-prefix hole closed; `CardImage` stale-promise race fixed via
cancelled-flag pattern; `fetchCardImage` distinguishes 404 from 4xx/5xx with
context-aware logging; truncation repair surfaces a `PARTIAL` chip on the
score readout via `_truncated` flag; `PhasePips` clamped to last index once
past linear (no rewinding); `brandFromUrl` returns null on URL parse failure
(no substring fallback that misattributed `?ref=youtube.com` style URLs);
`SignalSection` grid uses `auto-fit minmax` for mobile collapse; JP clock
uses `Intl.DateTimeFormat` with `Asia/Tokyo` (DST-correct).

---

## Open work — handoff for next agent

### In flight right now

A separate Claude Code session (Sonnet 4.6 1M, extended thinking, max effort)
is executing a UX/design overhaul covering ~20 ranked fixes:

- **C1:** Mobile responsive overhaul (the dashboard has zero `@media` rules
  outside `LoadingTheater` — `OverallScore` and `PriceComparison` collapse
  catastrophically below 640px)
- **C2:** Solari flip animation pacing (mid-cycle `FK W ........` looks like
  a render bug)
- **C3:** Reorder `SIGNAL_SECTIONS` so `japan` is FIRST (currently buried last
  — contradicts the "JP is leading indicator" wedge)
- **H1:** Empty state with 3-tile product preview (currently a one-line
  whisper users can't decode)
- **H2:** Score anchor — percentile via `localStorage` scan history
- **H3:** Rename `Sig·Mkt` → `ALIGNMENT`, `30D` → `30-DAY TREND`, `JP↔EN Gap`
  → `ARBITRAGE`
- **H4:** Score vocab `HOT/WARMING/LUKEWARM/COLD` →
  `SURGING/HEATING/STEADY/DORMANT`
- **H5:** Promote section headers; treat all 3 as peers (currently only JP
  reads as a real divider)
- **M1-M6:** vertical waste reduction, 2-up YouTube grid on desktop, stronger
  expand affordance, inline `PARTIAL · 6 of 9 signals · [Retry]` message,
  error state with retry button, quick-picks reality audit
- **L1-L7:** `HeatBar` as actual visual bar, card-title `text-wrap: balance`,
  disclaimer legibility, header logo balance, `RecentScans` strip,
  `ComparisonView` (pin-to-compare), tap-to-expand score contribution
  breakdown

When that session lands `READY FOR REVIEW`:
- Final report at `UX_PASS_REPORT.md` (repo root)
- Screenshot set at `C:/Users/georg/Desktop/signal-ux-pass-final/` covering
  empty / loading-mid-phase / result / expanded / error / partial /
  comparison states at 375×812, 390×844, 768×1024, 1440×900
- Working tree uncommitted (commits gated on human review)

### Next agent's first task — REVIEW what Sonnet shipped

When George returns, the next agent's job is to review the Sonnet UX pass
against the original brief. Specifically:

1. **Read `UX_PASS_REPORT.md`** at the repo root to understand what Sonnet
   chose to ship and what decisions it made in ambiguous cases.
2. **Inspect screenshots** at `C:/Users/georg/Desktop/signal-ux-pass-final/`
   for visual coherence at all four viewport sizes.
3. **Run a real scan** ("Mega Charizard X ex" via the quick pick) and verify
   the audit fixes from `893429f` still work end-to-end:
   - Hallucination filter still rejects fabricated URLs (peek the console
     for `[signal] dropped N source URL(s)` warnings — should fire normally)
   - YouTube embeds still play
   - `PARTIAL` chip surfaces correctly on truncated responses
   - Mobile layout (375px) is now USABLE, not the single-letter-column
     disaster from the pre-overhaul state
4. **Flag drift from the brand DNA** — generic AI aesthetics (Inter, Roboto,
   purple gradients), violations of the three-typeface system, abandoned
   color palette, marketing copy creeping into UI text, security/privacy
   claims, monetization scaffolding.
5. **Produce a punchlist** prioritized by severity. For each item: file:line,
   what drifted, fix sketch.
6. **Do NOT commit** anything yet — wait for human approval per cluster.

The brief that drove the Sonnet session lives in this chat's transcript at
`C:\Users\georg\.claude\projects\C--Windows-System32\<session-id>.jsonl`.
Recover it with grep if needed.

---

## Session log — 2026-05-23 (Gemini 2.5 Pro)

**Goal:** Implement Google Auth via `@capgo/capacitor-social-login` inside an Android Capacitor Wrapper and fix Adaptive Icon clipping on Samsung devices (Android 16).

**Actions Taken:**
1.  **Auth Button Re-positioning:** Removed the original full-width "Sign in with Google" text button blocking the main logo and relocated it to an absolute top-right container displaying "10 SCANS LEFT" and a circular Google 'G' icon.
2.  **Android 16 WebView Bounds Bug Fix:** Initially, touches on the React Auth Modal and its dimmed background were "falling through" to the dashboard because Android 16 WebView reported a `0x0` physical hit box for the SVG inside the `<button>` despite the CSS layout. Fixed this by explicitly declaring `width: '100%', height: '100%'` on the modal overlay and explicit 32x32 pixel bounds on the Avatar icon.
3.  **Migrated to Native Auth:** Ripped out `supabase.auth.signInWithOAuth` (which was triggering broken WebView browser redirects inside Android) and replaced it with native OS-level Google Sign-In using the `@capgo/capacitor-social-login` Capacitor plugin connected to `supabase.auth.signInWithIdToken`. 
4.  **Adaptive Icon Fix:** Discovered the 1024x1024 '株' icon was heavily cropped by Samsung's squircle mask because it lacked padding. Used a Python Pillow script to recreate the master asset with the font size shrunk to `300pt` to safely fit inside the Android `66%` safe zone. Generated 59 mipmap variants via `@capacitor/assets`.

**Current Status:** The code is completely committed to the `main` branch. The Android wrapper compiles via Gradle successfully with the new icons and the native auth flow code. Testing the UI flow using physical screen taps directly on Android 16 requires real-device manual validation due to Capacitor/WebView bounding intricacies, but the codebase has been permanently synchronized to these fixes.

---

## Architecture quick reference

```
src/
  components/
    SignalDashboard.jsx     — top-level state + layout, error/loading routing
    SearchBar.jsx           — query input
    QuickPicks.jsx          — sample card chips with game brand logos
    LoadingTheater.jsx      — 8-phase loading UI (Solari + tickers + grid)
    OverallScore.jsx        — score readout, PARTIAL chip, summary
    PriceComparison.jsx     — EN/JP/Arb/Trend/Alignment strip
    SignalSection.jsx       — section grouping (short-term/structural/JP)
    SignalCard.jsx          — expandable signal row with citations
    SourceCitation.jsx      — citation with brand icon + YouTube embed
    HeatBar.jsx             — signal level (currently numeric "3/5")
    CardImage.jsx           — TCG card art (cancelled-flag race fix)
  config/
    signals.js              — signal taxonomy + per-game weights + getScoreLabel
    creators.js             — curated creator directory per game
    brandIcons.jsx          — brand logo registry (simple-icons + custom)
  services/
    analyzeCard.js          — Anthropic API + structured JSON parse + URL filter
    fetchCardImage.js       — Scryfall/YGOPRODeck/PokemonTCG API wrappers
  styles/
    animations.css          — keyframes + theater layout + (some) responsive
```

---

## Run

```
cd C:/Users/georg/Documents/GitHub/signal
npm install                 # if first run
npm run dev                 # http://localhost:3000
npm run build               # production build into dist/
```

Anthropic API key goes in `.env.local` as `VITE_ANTHROPIC_API_KEY=...` (file
is gitignored).

---

## Aesthetic lock — preserve

- **Typography:** Instrument Serif italic (editorial), Syne (UI labels),
  JetBrains Mono (numbers/timestamps), Noto Sans JP (kanji only)
- **Canvas:** `#08090A` near-black; surfaces `#0E1014` / `#0A0C10`
- **JP red:** `#C44040` (primary brand accent)
- **Muted text graduation:** `#6B6860` → `#5A5850` → `#4A4840` → `#3A3830`
  → `#2A2820`
- **Per-signal type colors** in `signals.js` are intentional — never reassign
- **株 kanji** is THE logomark — never replace, only resize
- **Voice:** editorial-trader, no SaaS marketing copy, no emoji pollution
- **Disclaimer** "Not financial advice" must remain visible

---

## Constraints (do not violate)

- No commit/push without explicit human approval
- No analytics, telemetry, or tracking
- No security/privacy/confidentiality claims in UI text
- No monetization scaffolding
- No new dependencies beyond Vite, React, `simple-icons`
- No TypeScript
- Don't break the audit fixes from `893429f`
