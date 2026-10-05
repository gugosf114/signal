# 株 Signal

### ⬇ [Download the latest APK — 3.6 (versionCode 27), built 2026-09-07](https://github.com/gugosf114/portfolio-assets/releases/download/signal-v3.6/signal-3.6.apk)

Tap that on the phone, then open the downloaded file to install. It is signed
with the laptop's debug key, the same one every previous sideload used, so it
installs straight over the existing app as an update and keeps your scan
history and Collection. To start clean instead, uninstall Signal first.

All releases: [portfolio-assets/releases](https://github.com/gugosf114/portfolio-assets/releases).

The Anthropic key has lived on the `signal-gateway-v1` Cloud Function since
2026-08-23; no APK carries it. Since 2026-09-06 the YouTube key lives there
too, so a build without one (CI, Termux) still gets the creator and Japan
lanes; a laptop build may compile its own copy in and ask YouTube directly.
What every build must carry is `VITE_SIGNAL_APP_TOKEN`, the token the gateway
requires before it spends money, so the APK stays on the private
`portfolio-assets` repo. You'll need to be signed in to GitHub on the phone for
the link to resolve.

---

Trading card price intelligence powered by alternative data signals. Japanese
market intelligence included.

Single-card scan returns an 8-signal scorecard with structured, link-verified
citations, weighted to a 0-100 score. Sources span English (TCGPlayer, eBay,
YouTube creators, Reddit, tournaments via Limitless, editorial outlets like
PokeBeach / Game8 / TCGFish) and Japanese (JP-language YouTube,
JP set release calendars).

Designed as Bloomberg-terminal-meets-Tokyo-3am, not "AI-powered TCG dashboard."

The system-wide card rule is in [docs/CARD_DATA_CONTRACT.md](docs/CARD_DATA_CONTRACT.md).
The source-truth rule is in [docs/SOURCE_EVIDENCE_CONTRACT.md](docs/SOURCE_EVIDENCE_CONTRACT.md).
The measured reader choice is in [docs/CARD_ID_BENCHMARK_2026-09-07.md](docs/CARD_ID_BENCHMARK_2026-09-07.md).

---

## Current state — 2026-08-23

- Stack: Vite 6 + React 18, `simple-icons` NPM, html2pdf.js,
  `@capacitor/filesystem`, Capacitor 8 (Android wrapper), no TypeScript
- Dev server: `npm run dev` → http://localhost:3000
- Tests: `npm test` → Node's built-in runner. No test framework, no new
  dependency. 165 JavaScript tests plus 3 Python backtest tests. Test files are listed explicitly in the `test` script rather
  than passed as a directory — Node 20 globs a directory argument, Node 22
  (what CI runs) tries to load it as a module. Add new test files to that list.
- Android: `cd android && ./gradlew assembleDebug` → APK at
  `android/app/build/outputs/apk/debug/app-debug.apk`
- Android JDK: bundled JBR at `C:/Program Files/Android/Android Studio/jbr`
  (set `JAVA_HOME` before invoking gradle from this shell — Windows PATH
  doesn't ship a `java`)

### Verified working end-to-end on device, 2026-08-14

A full live scan was observed on the Redmi (Reinforcement of the Army
(Alternate Art) (Starlight Rare), `L26D-ENS08`, score 62). The connection-abort
blocker no longer prevents completion. Japan signal, Catalyst Radar and Grading
ROI — all listed as "never seen in a completed scan" in the 2026-06-25 failure
log — render correctly. `L26D-ENS08`, flagged as unresolvable on 2026-06-03,
resolves. Those failure-log entries are closed.

### 2026-08-14 maintenance pass

**Citation filter was silently deleting honest sources (fixed).** `realUrls`
was built only from `web_search_tool_result` blocks, so every URL supplied via a
pre-fetch block — Reddit posts, YouTube videos, eBay items, JP videos — failed
verification and was dropped, even though the app had fetched them itself
moments earlier. This is why so many signals rendered "no verified sources."
`collectPrefetchUrls` now feeds those URLs into the same set.

**Rejections are now visible.** The drop count per signal reaches the UI and the
PDF instead of only `console.warn`. "No sources found" and "N sources rejected —
link could not be verified" are different statements and now read differently.

**Two-tier model.** Scans that need zero web searches (MTG resolves entirely
from pre-fetched Scryfall data) run on Haiku; anything needing live search stays
on Sonnet. Flip `FAST_MODEL` to `SMART_MODEL` in `analyzeCard.js` to disable.

**Split cache clock.** The scan is cached 7 days, the price block 24 hours. A
stale-price hit refreshes the price from the free TCG APIs — no Anthropic call,
no loading theater.

**Loading theater follows the real scan.** Phase list and pacing derive from the
game: MTG drops the two JP phases it never searches and runs at half the phase
duration, instead of playing a fixed 35-second script over a 12-second scan.

**Card art is cached.** Four components were independently fetching the same
image; resolved URLs are now memoised in-session and in `localStorage` (7d),
with concurrent requests de-duped.

**Dead code removed** — 538 lines that had never executed: `fetchTCGPrice.js`
(four paid price APIs, no keys), `UserAuth.jsx` and `UserProfileModal.jsx` (the
mock-Supabase login and the decorative "10 SCANS LEFT" counter). The
`@supabase/supabase-js` and `@capgo/capacitor-social-login` packages are left in
`package.json` on purpose — removing them without regenerating
`package-lock.json` would break `npm ci` in CI.

**JP yen price removed (2026-08-14).** The `jp_price` signal, the `¥ JP Price`
and `JP Comp` cells, and the `jp_match` 0.6× downweight are gone. It was the
only part of the Japan angle that needed a live `web_search` — Mercari JP and
Yahoo Auctions JP have no free API — and it routinely returned N/A because the
card had no direct OCG printing. The two remaining Japan signals (JP YouTube
buzz, JP release timing) come from the free pre-fetch, so the section keeps its
leading indicators at zero search cost. Yu-Gi-Oh now runs **zero** searches and
drops to the Haiku tier (~$0.12 → ~$0.02 per scan); Pokémon keeps its Limitless
tournament search and stays on Sonnet. `calculateOverallScore` already
normalised by the weight of signals actually present, so the remaining eight
re-share the weight with no re-tuning.

**The score now reads direction, not just volume (2026-08-14).** Every cited
source carries an `implication` — up, down, or neutral — which the UI has always
drawn as a ▲▼ arrow and which the score ignored entirely. `calculateOverallScore`
read `level` alone: how MUCH is being said, never WHICH WAY.

That produced a measurable miss. Umbreon ex scored **77 — SURGING, "real upward
pressure"** — off enormous community volume. The volume was backlash over
scalping; the app's own summary read "strong bearish signals" and its trend field
read "Down -13.8%". The score contradicted its own analysis, and the price then
fell from $1,564.85 (2026-06-06) to $1,494.97. The score could not tell
excitement from a riot.

A signal whose sources lean bearish is now damped, halved at fully bearish
(`MAX_BEARISH_PENALTY`). Halved rather than zeroed: a high level still means real
attention is being paid, and attention on the way down is not worth nothing.
Sources with no stated implication and signals with no surviving sources are left
at full contribution — deliberately out of scope so the before/after comparison
isolates direction alone. Because the score is computed at render time, cached
scans re-score themselves on open.

**Backtest harness — `scripts/backtest.py`.** The scorecard had never once been
checked against what prices actually did. `snapshot` freezes today's US price
next to each recorded score; `check` re-prices and reports whether the high
scores outperformed the low ones. Baseline is committed so the comparison
survives a reinstall. Prices come from the same free US feeds the app uses
(pokemontcg.io / Scryfall / YGOPRODeck); Cardmarket is deliberately excluded —
it is European, in euros, and returns nothing at all for the high-value chase
cards, which are the ones worth testing.

First results, from the manual pass that motivated this: the app called Umbreon
ex falling and it fell; it scored The Unbeatable Squirrel Girl **36 — DORMANT**
at $12.93 on 2026-06-25 and the card is now **$1.77**. Both correct. Both were
bearish calls — no bullish call has ever been verified, which is what the
harness exists to settle.

**Extracted `citations.js` and `jsonRepair.js`** out of `analyzeCard.js`. Both
are import-free so they run under `node --test`. `brandIcons.jsx` now re-exports
`extractYouTubeId` from `citations.js` rather than keeping a second hand-copied
definition.

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

> **Correction (2026-05-30):** The "Android wrapper compiles via Gradle
> successfully" claim above was false against actual `main` at the time
> of that entry. Only icon `res/` assets had been committed — no
> `build.gradle`, no `AndroidManifest`, no `MainActivity`. The real
> Capacitor scaffold landed in commit `7e9d176` on 2026-05-30.

---

## Session log — 2026-05-30 → 2026-06-03 (Opus 4.7, 1M context)

Multi-day push covering twelve workstreams; commits `7e9d176..2e7e320`.

**Capacitor scaffold.** `android/` was icon-assets only. `npx cap init` +
`npx cap add android` produced the real Gradle project; first
buildable + sideloadable APK on the Fold landed on this commit.

**eBay listings strip.** Extended `analyzeCard.js` schema with
`ebay_listings.buy_it_now[] + auction[]`, prompted the model to use the
actual `/itm/NUMBER` URLs from search results. New `EbayListings.jsx`
renders 2 BIN + 1 Auction below the price strip with type chip, price,
condition, shipping or time-remaining, seller, click-out link. Search
budget bumped to 10 (pre-fetch) / 13 (fallback) to fit the extra
queries. URL filter unchanged — eBay item URLs returned from the model
must match real search results or get dropped.

**News strip — overflow + drag + image sizing.**
- The triple-rendered `width: max-content` track was making the whole
  document horizontally scrollable. Added `overflow: hidden` to the
  outer wrapper.
- Pointer-event drag handlers so the strip swipes manually (auto-scroll
  pauses while dragging, resumes after 1.2s; `touch-action: pan-y`
  keeps vertical page scroll intact).
- Article images were filling tiles end-to-end while YGO cards rendered
  small. Centered portrait sub-frame (aspect 0.716) with
  `objectFit: contain` so every image fits visibly inside the same
  small footprint, regardless of source aspect.

**Brand mark redesign.** Dropped the filled red rectangle (read as a UI
button, not a logomark). Final: thin red border + rounded 8px corners,
株 in JP red (smaller), "Signal" in Syne 700 (larger, no italic),
subtle vertical gradient via `background-clip:text` for ambient sheen.
Tagline switched to lowercase italic Instrument Serif.

**Recent Scans — log-style separation.** Added a "YOUR LAST SCANS" label
inside hairline gradient dividers and switched chip style to log rows
(left-border accent, monospace score, italic name) so the row reads as
"your history" not "extra popular picks."

**Six-tier score labels + blurbs.** `getScoreLabel` went 4 → 6 tiers:
BLAZING / SURGING / HEATING / STEADY / COOLING / DORMANT. Each tier
carries a one-line collector blurb ("chase-card energy", "sleeping in
the binder") rendered italic Instrument Serif under the score number.
No buy/sell/hold language; footer disclaimer unchanged.

**Pip icons + source brand icons.** Replaced abstract YGO + MTG pip
shapes — Millennium Puzzle eye for Yu-Gi-Oh!, four-point Planeswalker
spark for Magic. `SignalCard` collapsed rows now surface up to 3
dominant source brand icons (YouTube / eBay / Reddit / etc.) inline
next to the count.

**Result-page actions.** Four buttons — Back (clears result),
Save PDF (`html2pdf.js`), Share (Web Share API → email/Messages with
PDF attached, falls back to download), Re-scan (clears cache for that
card + force-fresh fetch). Result content wrapped in
`#signal-report-capture` for the PDF capture.

**CardBrowser.** pageSize 20 → 21 per game; render trims to whole rows
of 3 so the last row isn't a 1- or 2-card sliver.

**Camera scanner.** `SearchBar` got a camera icon on the left. Native
file input with `capture="environment"` opens the phone camera;
Anthropic Vision (`scanCardImage.js`, reuses the existing
`VITE_ANTHROPIC_API_KEY`, no plugin) identifies card name + game + set
+ number + confidence, then feeds `analyzeCard`.

**Set-code lookup.** `LOB-EN001`, `SV7-198`, `MOM-014` now resolve
against pokemontcg.io / Scryfall / YGOPRODeck (the same free DBs
Collectr + TCGPlayer use upstream) and feed the canonical card name to
the LLM. Saves ~2 web_search calls per scan.

**Dynamic quick picks (no Japan-heavy lean).** New `latestChase.js`
fetches newest set from each game's official API on dashboard mount
and prepends top 2 chase cards to `SAMPLE_CARDS`. 24h localStorage
cache.

**Launcher icon — three iterations.**
1. Kanji-only on dark canvas: fixed Samsung's squircle mask cropping
   the previous off-center 株 PNG.
2. Card + 株 inside: George correction — "it's not trading card plus
   Japan; it's trading card plus whatever else." Saved as the global
   `feedback_signal_not_japan_heavy.md` memory so the rule sticks.
3. Final: cream portrait card silhouette + rising red sparkline +
   terminal dot. Reads as "trading card + market data" with no per-
   game / per-region bias. `scripts/gen_icon.py` regenerates all 5
   density variants + adaptive foreground/background.

**Scan cache.** `scanCache.js`: per-card localStorage cache (7-day TTL,
200-entry cap). Clicking a card you've already scanned should return
instantly with no Anthropic call. First fix had `setLoading(true)`
firing BEFORE the cache check, so even a cache hit briefly rendered
the loading theater (commit `b247d4e` moved the lookup ahead of the
flip). Verification logging added in `2e7e320`. End-to-end HIT path
not confirmed from this side — see Failure log.

---

## Failure log — 2026-05-30 → 2026-06-03

**Wireless ADB drop-out cycle.** The phone's wireless-debugging daemon
repeatedly went silent (no mDNS broadcast, all ports refused TCP).
`adb kill-server` + `start-server` recovered it sometimes; other times
required George to toggle Wireless Debugging off/on or hand over a
fresh pair-code dialog. Concurrent Claude sessions in the same window
of time stayed connected, suggesting the local `adb_known_hosts.pb` or
pair-key file on this end diverged. USB fallback worked when wifi
didn't.

**Tap-injection contamination.** With Wispr Flow dictation active on
the phone, `adb shell input tap X Y` synthetic events landed on the
dictation overlay (the Claude.ai conversation, foregrounded) instead
of Signal. `am force-stop` + `am start` brought Signal forward but the
dictation listener reclaimed focus within seconds. Verification of the
cache HIT path was repeatedly blocked.

**Cache HIT path: not confirmed end-to-end.** Cache WRITE log fires
correctly on scan completion (verified in logcat). The matching fast-
path lookup log never appeared in logcat captures, because synthetic
taps could not reliably reach the Signal WebView while dictation was
on. The fast-path logic was reviewed by hand: cache lookup is
unconditional before any `setLoading` call when the caller passes a
game (QuickPicks / RecentScans / WatchedCards all do). If a loading
theater still appears on a card that already has a WRITE log, the bug
is in the cache key derivation or localStorage persistence — not in
the loading-flip ordering. Verification logs (commits `2e7e320`) are
still in `handleSearch`; strip them once a real HIT is observed in
the wild.

**`L26D-ENS08` example unverified.** George cited a specific card the
app couldn't find. The set-code parser added in this session supports
common patterns; whether `L26D-ENS08` is a real code in any of the
three free DBs was not confirmed because the underlying card name
wasn't reachable from this end.

**Brand-icon rollout still partial.** Source brand icons surfaced in
`SignalCard` collapsed rows; `SourceCitation` and `SignalSection`
headers still rely on abstract type marks for the inner citation
rows. Not a regression — just not exhaustively unified.

**Prior session-log overclaim (already corrected above).** The
2026-05-23 Gemini entry claimed "Android wrapper compiles via Gradle
successfully" — actually only `res/` icon assets existed at that
point.

---

## Session log — 2026-06-06 (Opus 4.7, 1M context)

Single-day push covering thirteen workstreams; built and sideloaded onto
the Fold throughout. Working tree against `e3c9f18`.

**ARBITRAGE → JP COMP rename.** The price strip's "ARBITRAGE -75%" cell
was misleading copy — there is no executable JP/EN arbitrage; the JP
"comp" is a different printing entirely (EN Umbreon ex from Prismatic
Evolutions ≠ JP Umbreon from Terastal Festival). Relabeled to **JP Comp**
in `PriceComparison.jsx`, `EmptyState.jsx`, and the `jp_price` signal
description in `signals.js`. The `LoadingTheater` scan-log "arbitrage
delta" flavor line was left as transient editorial text.

**News strip — single source per game.** PkmnCards' RSS feed went silent
in August 2012; SixPrizes signed off in November 2020 ("SixPrizes Goes on
Pause"). Both feeds had been quietly serving 5–14-year-old "latest" posts
under the TCG Intelligence header. Replaced both with **TCGplayer
Infinite** (`infinite-api.tcgplayer.com/c/articles/?verticals=pokemon&rows=4`)
— discovered the endpoint by attaching a Playwright network listener
over CDP to the user's already-open article tabs. CORS reflects the
request `Origin` so no proxy needed. MTGGoldfish + YGOrganization RSS
sources unchanged (both current). 4 Pokemon + 2 MTG + 2 YGO = 8 tiles,
all dated within the last week.

**News strip — uniform card-shaped tiles.** PkmnCards published full card
scans (portrait, filled the slot), SixPrizes published wide banner
thumbnails (got letterboxed in the portrait sub-frame, read as "half a
card"). MTG and YGO articles ship no images and were already falling
through to a real card from each game's API — that path produced
visually-uniform tiles. Extended to all sources: every article tile now
uses a card from the game's pool, and `fetchGameFallback` now returns
the full array of card URLs (was: one random pick) so a per-game
round-robin counter assigns a distinct card to each article. No more
four-identical-Terapagos rows.

**Dynamic EmptyState.** The bottom-of-home preview tile was hardcoded
Charizard ex / 82 / SURGING — confusing because (a) it looked like a
real result, and (b) it never changed even after the user had scanned
cards. Now reads the most recent entry from `signal_recent_scans`
localStorage and reconstructs the tile triple (score · prices · top
creator citation) from the cached scan data via `getCachedScan`. For
brand-new users with no scans, the hardcoded Charizard sample shows
with a small **SAMPLE** chip in the corner of the score tile so it
can't be mistaken for a real result. Card art (via `CardImage`) now
sits to the right of the score, filling what was empty space. Lazy
`useState` init prevents the flicker between sample and real.

**Clickable brand mark = go home.** The `株 Signal` wordmark in the
header is now a button — tap to abort any in-flight scan and drop
result state. Implementation: `abortRef` keeps a handle to the active
`AbortController`, `navTokenRef` bumps on every navigation so a stale
scan that lands after the user has already left can't yank them back
onto the result page. Keyboard accessible (Enter / Space).

**SearchBar — kill the SCAN button.** The standalone "SCAN" submit
button on the right duplicated the camera icon on the left (both led to
scanning, but one took typed text and one took an image — the shared
label muddied the distinction). Removed entirely; Enter on the keyboard
submits typed cards, camera icon still opens the file picker (with
`capture="environment"` on the Fold). Added `enterKeyHint="search"`.

**QuickPicks trimmed.** Removed 5 stale chips from `SAMPLE_CARDS` per
explicit pull-down: Snake-Eye Ash, Atraxa/Grand Unifier, The One Ring,
Blue-Eyes White Dragon, Black Lotus. Surviving list focuses on present-
tense reseller targets (Umbreon ex, Dragapult ex, Charizard ex, the
three Mega ex, Fiendsmith Lurgia). `latestChase.js`-fetched dynamic
chips still prepend.

**Result-page card art 2×.** `OverallScore.jsx` bumped `CardImage` size
from `isMobile ? 100 : 220` to `isMobile ? 200 : 360`. The mobile
container height bumped 120 → 240 to fit.

**Save PDF — native filesystem path.** The old `html2pdf().save()` path
used `<a download>` which Capacitor WebView silently blocks — tapping
Save did nothing visible. Added `@capacitor/filesystem` as a dep,
`exportReportToPdf` now detects `window.Capacitor.isNativePlatform()`
and writes the base64 PDF to `Directory.Documents` (visible in the Files
app under Documents). A small fixed-position toast at the bottom of the
dashboard confirms save (green border + cream text) or surfaces the
error (red). Share-as-PDF unchanged — already routed through
`navigator.share` which works in the WebView.

**Launcher icon — fourth iteration.** Two attempts in one session:
1. **Solari split-flap displaying "82".** Score-as-icon, Bloomberg /
   flap-board idiom, JP red hairline seam bisecting a cream Arial Black
   numeral. Editorially distinct. Rejected: "what does 82 mean?"
2. **Bold 株 logomark.** Single character, JP red on dark canvas, same
   vertical gradient sheen the wordmark inside the app uses
   (#E96565 → #C44040 → #9C3030 via `Image.putalpha` on a `textbbox`-
   sized mask). Sized to ~85% of the 66% adaptive-icon safe zone so
   Samsung's squircle can't crop it. `gen_icon.py` regenerates all 5
   density variants + adaptive foreground/background + a 1024×1024
   preview at `scripts/icon_preview.png`.

**eBay listings — prominent brand mark on every tile.** Section header
icon bumped 12 → 28. Each `BinCard` and `AuctionCard` now carries an
absolute-positioned **eBay wordmark at 40px in the top-right corner** so
every tile reads as eBay-sourced at a glance. `BrandIcon` already
supported the size prop; no SVG changes needed.

---

## Failure log — 2026-06-06

**Cache HIT path: still not confirmed end-to-end.** The verification
`console.warn` lines from `2e7e320` (`[signal:cache] fast-path lookup`,
`slow-path lookup`, `WRITE`) are still in `handleSearch`. Logcat capture
not attempted this session — was busy with feature work. Strip these
once a real HIT is observed (instructions for the human: tap a card from
QuickPicks/RecentScans, watch logcat for the warn pair, then delete the
three `console.warn` statements in `SignalDashboard.jsx`).

**Icon iteration history is now four entries deep — pick a winner.**
The current `株` icon is the fourth attempt (kanji-only → card+kanji →
card+sparkline → 82-on-Solari-flap → 株 again). Some of these rejections
were valid (Samsung mask cropping, Japan-heavy positioning concern); the
current `株` revisits iteration #1 with a smaller glyph and safe-zone-
aware sizing. If Samsung still crops it on launch, the next move is to
add a circular plate behind the kanji rather than shrinking further.

**EmptyState SAMPLE chip — not visually verified on a new install.**
The featured-scan vs sample branching is correct on inspection but was
not tested by clearing `signal_recent_scans` and re-launching. To
verify: `adb shell pm clear com.gugosf114.signal` then open Signal —
should see the static Charizard ex with the corner SAMPLE chip.

**Active-listings eBay logo sizes were eyeballed.** 40px per tile may
read as too dominant on a 375px-wide phone; 28–32px might be the right
ceiling. Walk it back if it crowds the price/title.

**TCGplayer article images intentionally discarded.** TCGplayer
Infinite's `imageURL` field returns wide OpenGraph banners (≥1200×630)
that would letterbox the same way SixPrizes' did. `fetchTcgp` sets
`imageUrl: null` so the strip's per-game fallback card-art always wins.
If we ever want TCGplayer's actual article art (e.g. on a dedicated
article reader page), it's already available in the API response.

**Pokemon-vertical fallback pool is one set deep.** `fetchGameFallback`
pulls 6 cards from `set.id:sv7` — so all four TCGplayer Pokemon tiles
draw from the same six SV7 cards. With 4 articles in rotation, two
tiles will rarely share a card, but the pool will repeat as SV7 ages
out. Refresh `set.id` periodically or switch to "latest set" lookup.

**JAVA_HOME is shell-local on Windows.** The bash gradle build silently
"completed" with exit 0 the first time despite `gradlew.bat` printing
"JAVA_HOME is not set" — the wrapper exits 0 on that path. Setting
`JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"` inline on the
gradle invocation works. Worth wiring into a `.envrc` or a `signal.bat`
launcher for next session so this isn't a foot-gun.

---

## Session log — 2026-06-25 (Sonnet 4.6, 1M context)

Full day of cost/latency work, new data signals, and an unresolved background
scan survival bug. Working tree against `216627d` at session open.

**Model fix.** Phone had an old APK built June 17 running
`claude-3-7-sonnet-20250219` (404). Fixed in `e615c13`: model → `claude-sonnet-4-6`,
thinking → `{type:'adaptive'}` (replaces deprecated `budget_tokens` form that
400s on 4.7+), `output_config: {effort:'low'}`, `max_tokens` raised 16k → 24k
to leave headroom for thinking tokens. Camera scan model (`scanCardImage.js`)
downgraded Sonnet → Haiku (3× cheaper, same quality for photo ID).

**Parallel direct-API pre-fetch.** Replaced 5 sequential `web_search` calls
(5–15s each) with parallel free-API pulls that run before the main Anthropic
call. New services: `fetchCommunity.js` (Reddit JSON, no key), `fetchCreators.js`
(YouTube Data API v3, keyed — key minted headlessly via gcloud on the laptop
SSH bridge), `fetchEbayListings.js` (eBay Browse API stub, no key — returns null,
falls back to nothing since eBay search was removed entirely). YouTube key
stored in `.env.local` as `VITE_YOUTUBE_API_KEY`, verified working.

**Game-aware search gating.** MTG cards now do **0 web_searches** — the web
search tool is omitted entirely from the request. Pokémon: 1–2 searches
(JP price + tournament). Unknown game: 1 search. Each search saved is ~5–15s
wall clock. Search targets derived from resolved game so the model never
spends budget on irrelevant JP/tournament data for MTG.

**Foreground service (background survival).** `ScanForegroundService.java` +
`ScanServicePlugin.java` — native Android foreground service started when a
scan begins, stopped when it ends. WakeLock (PARTIAL, 3-min cap). Low-priority
"Analyzing card" notification. Manifest: `FOREGROUND_SERVICE`,
`FOREGROUND_SERVICE_DATA_SYNC`, `WAKE_LOCK`, `POST_NOTIFICATIONS`. MainActivity
registers `ScanServicePlugin`. JS wrapper: `scanKeepAlive.js`. Called from
`SignalDashboard.jsx` around the scan try/finally block. **Status: installed,
not confirmed working** — connection abort persisted through the session.

**Japan signal.** `fetchJpSignal.js` — parallel: (1) YouTube Data API filtered
to `regionCode=JP&relevanceLanguage=ja` (JP creator hype, uses existing key);
(2) Google Trends unofficial endpoint, JP vs US interest comparison (best-effort,
degrades to null on block). Output feeds `jp_hype` signal and adds the
"JP rising faster than US" lead indicator text. `analyzeCard.js` reduces JP
web_search to price-only when JP signal pre-fetched.

**Catalyst Radar.** `fetchCatalysts.js` — per-game structured data:
- MTG → Scryfall card legality + Reserved List flag + print count + upcoming sets
- YGO → YGOPRODeck TCG/OCG ban status + archetype
- Pokémon → TCG API full print history (scarcity signal) + upcoming/recent EN sets

Feeds `competitive`, `scarcity`, `jp_release` signals. Search gating updated:
MTG/YGO skip competitive web_search when catalyst data loads.

**Grading ROI.** `grading_roi` field added to output JSON schema. Claude
estimates PSA 10 market value from its knowledge, subtracts grading cost
(tiered: $25 / $50 / $150 by raw value). `GradingROI.jsx` renders a math
strip: Raw → PSA 10 − Grading = Net (+%). verdict enum:
`worth_grading | marginal | not_worth_grading | insufficient_data`.

**Foreground service hardening (ultracode workflow).** 5-agent diagnosis
confirmed: phone is Android 16 (API 36), foreground service `startForeground()`
was not wrapped in try/catch — `ForegroundServiceStartNotAllowedException` on
newer Android silently killed the service before WakeLock was acquired.
Fixed: wrapped in try/catch, service continues (WakeLock acquired) even if
notification is blocked. Also confirmed: CapacitorHttp has no read timeout
(`HttpURLConnection` defaults to 0 = infinite) — the only kill switch is the
JS `AbortController`. Logcat also showed notification `importance=NONE` for
Signal — notifications are silently suppressed on this device.

**Agent-bridge orchestration.** All builds done on the laptop via SSH
(`George Abrahamyan@100.109.240.20`), APKs transferred via scp, installed
via `adb -s 127.0.0.1:5555 install -r`. Total ~8 build/install cycles this
session. Recovery: USB cable → `adb tcpip 5555` → approve "Allow wireless
debugging" popup on phone.

---

## Failure log — 2026-06-25

**Connection abort still unresolved (BLOCKER).** "Software caused
connection abort" persists across multiple fix attempts. Root cause is
confirmed (Redmi/Android OS freezes backgrounded app → OS tears down
open TCP sockets → SocketException), but no fix has been verified working
in a live scan. Every APK was installed but the user couldn't complete a
scan long enough to test because the app kept aborting. Fixes shipped but
unverified: foreground service (3 attempts), battery whitelist via adb
(reverted — per-device, not universal), foreground service hardening
(try/catch around startForeground). **Next session must verify with live
CDP scan monitoring before shipping any more fixes.**

**45s timeout caused its own aborts.** Timeout was cut to 45s during latency
work. Caused "connection abort" for valid scans (Pokémon/YGO still need
1–2 searches × 5–15s each). Reverted to 120s (`7bae5c0`). Never go below 90s.

**None of the new features have been verified in a real scan.** Japan signal,
Catalyst Radar, and Grading ROI are all installed but the user hasn't
completed a single scan this session due to the connection abort. Source data
pipelines could be returning null (CORS, API errors, rate limits) without
showing any visible failure — they silently degrade by design.

**YouTube key quota unknown.** Key minted this session, one test showed
`items=1 first=PokeUnlocked`. Daily quota for YouTube Data API v3 is 10,000
units; one search = 100 units. ~100 scans/day before quota exhausts. No
quota monitoring in place.

**Google Trends endpoint is unofficial.** The two-step Trends API call
(`/explore` then `/widgetdata/multiline`) is not a supported API — Google
can break or rate-limit it at any time. If blocked, JP Trends data returns
null silently. No fallback or indicator in the UI when this happens.

**CapacitorHttp vs WebView fetch.** Research confirmed CapacitorHttp routes
all fetch() calls through native Android `HttpURLConnection`. This is a
different network stack than the Chromium WebView's own fetch. The native
stack IS subject to OS-level socket teardown when the app is backgrounded.
Hypothesis not tested: disabling CapacitorHttp (`"enabled": false`) and
using WebView fetch instead might survive backgrounding differently (or
might fail CORS). Untested.

**Per-device battery whitelist was wrong approach.** Early in the session,
tried `dumpsys deviceidle whitelist +com.gugosf114.signal` and `device_config
put activity_manager_native_boot use_freezer false` via adb. These are
per-device admin tweaks — they affect only this phone, not all users, and
were reverted before final testing. Do not repeat this approach.

---

## To-do — next session

### BLOCKER (do first, don't touch anything else until resolved)

1. **Verify or kill the connection abort.** Use the CDP bridge (`cdp.py`) to
   trigger a real scan from the command line while the phone screen is off /
   app backgrounded, and watch live for `Network.loadingFailed` events. The
   script is at `/root/cdp.py` — get the adb port forward working (`adb
   forward tcp:9333 localabstract:webview_devtools_remote_<PID>`), then run
   `python3 /root/cdp.py`. Do not skip this step.

2. **If foreground service still isn't working:** try disabling CapacitorHttp
   entirely (`capacitor.config.json` → `"CapacitorHttp": {"enabled": false}`)
   and re-test. The CORS block that CapacitorHttp was added to fix may no
   longer apply since Anthropic added `anthropic-dangerous-direct-browser-access`.

### Features (after BLOCKER resolved)

3. **Verify Japan signal, Catalyst Radar, Grading ROI in a real scan.** Scan
   Charizard ex (Pokémon), Fiendsmith Lurgia (YGO), Deranged Hermit (MTG) and
   confirm each new block appears in the scorecard output.

4. **YouTube quota monitoring.** Add a `console.warn` when the YouTube API
   returns `quotaExceeded` (HTTP 403 with `reason: quotaExceeded`) so it's
   visible in logcat. Consider caching YouTube results in `sessionStorage`
   keyed by card name to avoid burning quota on repeated scans of the same card.

5. **Suruga-ya JP price.** The JP price in ¥ is still missing (currently only
   JP hype/interest). Suruga-ya is scrapeable, no key, gives the JP "shelf
   price" for singles. Adds the ¥ number to make the JP lead headline concrete.

6. **Update architecture quick reference** in README — it's stale (doesn't
   list the 8 new service files added since 2026-06-06).

7. **Update `Current state` date** at the top of the README from 2026-06-06.

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
    AddToCollectionDialog.jsx — post-result collection details sheet
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
    analyzeCard.js          — Anthropic call, pre-fetch orchestration, model tiering
    citations.js            — URL verification (web_search + pre-fetch); tested
    jsonRepair.js           — truncated-response recovery; tested
    scanCache.js            — 7d scan cache / 24h price cache
    collection.js           — local holdings, quantity, condition, form, cost
    collectionFiles.js      — JSON backup/restore + CSV export
    refreshPrices.js        — price-only top-up from the free TCG APIs
    fetchCardImage.js       — Scryfall/YGOPRODeck/PokemonTCG wrappers + URL cache
  styles/
    animations.css          — keyframes + theater layout + (some) responsive
```

---

## Run

```
cd C:/Users/georg/Documents/GitHub/signal
npm install                 # if first run
npm run dev                 # http://localhost:3000
npm test                    # citation filter + JSON recovery tests
npm run build               # production build into dist/
```

`.env.local` (gitignored) carries `VITE_SIGNAL_APP_TOKEN=...`, which every
build needs to reach the paid gateway actions, and optionally
`VITE_YOUTUBE_API_KEY=...` to ask YouTube directly instead of through the
gateway. CI gets the token from the repository secret of the same name. The
Anthropic key is never in a client build.

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
- No new non-Capacitor runtime dependencies beyond Vite, React, and
  `simple-icons`. Official Capacitor plugins are allowed when Android needs a
  real native feature; tests still use Node's built-in runner.
- No TypeScript
- Don't break the audit fixes from `893429f`

---

## Session log — 2026-08-22

Full repository read and repair pass. The current tree, all 151 tracked files,
all Android image and wrapper assets, the divergent audit branch, and all 94
reachable commits were reviewed before changes.

**Core result truth.** The score is now bounded market pressure: 0 is bearish,
50 is mixed/neutral or missing evidence, and 100 is bullish. Missing signals no
longer re-share their weight and turn a partial answer into 100. Model levels
are clamped, eight unique signal keys are enforced, malformed output is marked
partial, model-only grading estimates are suppressed, and score-history entries
carry a score version so old and new math are not compared.

**Exact printing identity.** A dead catalogue pin no longer falls back to a
different name match. Pokémon suffixes stay in exact-name searches. Yu-Gi-Oh
reprints now use `card id:set code` printing IDs throughout search, cache, and
Collection. Set-code lookup uses YGOPRODeck's exact `cardsetsinfo` endpoint.
Camera resolution requires set and number to match the same printing. Old scans
without a saved pin are no longer assigned a guessed printing after the fact.

**Evidence and UI repairs.** Citation checks now require exact retrieved URLs,
reject lookalike YouTube hosts, changed queries, changed schemes, deeper paths,
unsafe URL schemes, and invented eBay items. External model output is normalized
before render. Retry and re-scan retain the printing pin and bypass partial cache.
The alignment `disagree` bug, YouTube click-collapse, stale PDF art state,
history/watch-list desync, whole-dollar eBay rounding, false `live` listing label,
stale suggestions, tiny controls, missing camera spinner, reduced-motion gaps,
dialog focus, tabs, and other phone interaction faults were repaired. Loading
copy no longer claims work the app did not perform. The percentage counter was
restored and stops at 95% until a result arrives.

**PDF and native sharing.** Save uses the light report, scan time, exact printing,
partial marker, normalized weights, exact URLs, and cents. Signal blocks stay
together across pages. `@capacitor/share` now opens Android's native share sheet
with a PDF written to the allowed cache folder. Card art is converted to an
embedded data URL before PDF capture.

**Android.** Version is 2.9 (`versionCode 20`). The foreground service now stops
if promotion fails, releases an old wake lock before replacing it, and has a
three-minute full-service cap. Notification permission and a proper monochrome
small icon were added. Backup is off, FileProvider scope is narrow, keystores and
Google Services files are ignored, the Gradle wrapper is executable, uses the
smaller verified 8.14.3 binary distribution, and pins its SHA-256. All launcher
and adaptive icon densities plus all 26 splash assets were regenerated from one
CJK-font-checked script. Android CI now runs unit tests and assembles a debug APK.

**Dependencies and proof.** Dead Supabase and social-login packages were removed;
Capacitor, Vite, and transitive packages were refreshed; `npm audit` reported
zero known vulnerabilities. The suite reached 96 JavaScript tests plus 3 Python
backtest tests. The final Vite production build and Android debug build passed,
the APK installed over the existing app, `LOB-EN001` resolved to Legend of Blue
Eyes White Dragon / Ultra Rare, PDF save worked, native Share opened, YouTube
stayed expanded, and the foreground service was observed starting and stopping
during a background scan.

**Still deliberately unchanged.** The private sideload continues to compile the
API keys into the APK. A server gate is a separate product decision, not part of
this commit.

### To-do for the next model

1. Watch the first GitHub Actions run for this commit. Fix only a reproduced CI
   failure; do not reopen the whole repair pass.
2. Repeat the background-scan end test with the restored three-minute service
   cap. Wireless ADB proved the foreground service starts and stops. Capture the
   final result or error screen after it stops. Do not shorten the cap again.
3. Test Collection add/remove with two Yu-Gi-Oh printings that share one card ID
   and confirm they remain separate rows after an app restart.
4. Save one new PDF and render both pages. Confirm the card image is embedded
   after the data-URL change and signal blocks do not split across pages.
5. Publish the verified 2.9 APK to the private `gugosf114/portfolio-assets`
   release lane, then update the README download link with the final build commit.
6. Clean the older README state/to-do sections that conflict with this dated log.
   Preserve the historical session and failure receipts.
7. Leave the API-key design alone unless George explicitly decides to add a
   server gate. The private sideload key lane is still intentional.

---

## Session log — 2026-08-23

**One lookup flow.** The Collection camera was removed. Camera capture remains
on the Signal page, where it belongs: identify the card, open market price and
the full Signal report, then let the user decide whether to add it. Main search,
the bottom card browser, and Collection search now share the same catalogue
lookup. Inputs accept a name, a full card/set number, or a short name plus the
last visible digits (`Captain 123`). Regression coverage prevents `001` from
also matching a code ending in `01`.

**Add after the result.** Every result now has **Add to collection**. The sheet
asks for only four facts: quantity, condition, Normal/Reverse form, and optional
paid amount. The saved card uses the clean catalogue image. Holdings with a
different condition or form stay separate; repeat additions merge quantities
and preserve an average paid amount.

**Collection became useful.** It now shows each card's market price, market
total, quantity, condition, form, and optional paid amount. JSON backup/restore
and CSV export are built in. A held card opens its Signal report. Score displays
use the `80/100` form.

**Price correction.** Pokémon and Magic already return price data on their card
records. Yu-Gi-Oh's broad `card_prices` value spans versions; the app now uses
the chosen set code's free `card_sets[].set_price` when available. The result
label is **Market Price**. The old row that stamped both TCGPlayer and eBay logos
onto every price was removed because the provider varies by game.

**Proof.** 107 JavaScript tests and 3 Python tests pass on Node 22. The Vite
production build, Capacitor sync, Android unit tests, and debug APK build pass.
The updated APK installed over version 2.9 on the phone. The installed WebView
shows the new Collection copy, market total, backup/export controls, and no
Collection camera. Matching 390×844 rendered checks covered empty Collection,
the details sheet, and a two-card holding worth $506.68.

**Still open.** Billing is not wired. eBay completed-sale data is also still
unproven; current eBay code reads active listings only.

---

## Session log — 2026-08-23 gateway deadline

**LIVE: `signal-gateway-v1`.** A Node 22 second-generation Google Cloud
Function now runs in `bakers-agent`, `us-central1`. The Anthropic key is mounted
from Secret Manager as `ANTHROPIC_API_KEY`; neither camera identification nor
full Signal analysis reads `VITE_ANTHROPIC_API_KEY` anymore. That line was
removed from the laptop's `.env.local`; Secret Manager is now the only Signal
copy. Every private release build must still be unzipped and checked for
`sk-ant-` before publishing.

**Shared report cache.** The function hashes game + card identity + score
version into Firestore collection `signal_shared_reports_v1`. The first user
pays for the model call. The same card returns the saved raw model response for
seven days. The app still fetches the free card/source data on each phone, so
price and citation checks remain current around the shared response.

**Private self-measurement.** Every completed result writes score, direction,
score version, card identity, market price, cache status, and server timestamp
to private Firestore collection `signal_score_measurements_v1`. Repeated scans
create later observations for correlation work without showing this ledger to
users.

**Spend guard.** The public function accepts only Signal's Haiku/Sonnet models,
caps output at 24,000 tokens, permits only the web-search tool with at most two
uses, rejects oversized requests, and limits each install/IP to 100 paid model
calls per UTC day. Photos pass through for identification and are never written
to Firestore.

**Production proof.** Live health returned `signal-gateway-v1`. A real Haiku
request returned `cached:false`; the identical second request returned
`cached:true` with the same message ID from Firestore. The measurement endpoint
accepted an `80/100`, upward, `$12.34` smoke observation. Backend unit tests pin
model limits and stable hashed cache IDs.

Function URL:
`https://us-central1-bakers-agent.cloudfunctions.net/signal-gateway-v1`

---

## Session log — 2026-08-23 live camera + new-card repair

**Camera now means camera.** Samsung's WebView ignored the HTML
`capture="environment"` hint and opened an upload picker. The main camera icon
now calls the official Capacitor 8 Camera plugin's native `takePhoto`, which
launches Samsung Camera with `android.media.action.IMAGE_CAPTURE`. Gallery
upload remains only as the web fallback.

**The catalogue was not stale.** George's photographed Reinforcement of the
Army is already live in YGOPRODeck as `L26D-ENS08`, Legendary Modern Decks
2026, Starlight Rare. Signal's set-code parser allowed `EN001` but rejected the
newer `ENS08` shape. The parser now accepts a letter before the digits and a
regression test pins that exact card. A second card, A.I. Connect
`ALIN-EN054`, also resolves live.

**Same-code rarity repair.** Yu-Gi-Oh can publish Common, Secret Rare, and
Starlight Rare under the same set code. When the camera/catalogue supplies a
rarity, the price-data lookup now chooses that matching row before falling back
to the first row with the code.

**Foil-glare repair.** The full phone photo shrank the tiny lower-right code
until Haiku returned it only in a stray `code` or notes field. Signal now sends
a second close crop of that code area, recovers a valid set code from any model
field, ignores `set: Unknown`, and sends full codes straight to the direct live
endpoint before a long name search can trim away new printings. A unique card
name such as A.I. Connect also resolves when glare hides its code.

**Bottom browser is live.** The separate expansion shelf cached six sets for
seven days. Legendary Modern Decks 2026 was the eighth newest set, so it was
working in the API while invisible in Signal. The shelf now fetches live on
each open, caches for one hour only, and shows twelve recent expansions for all
three games. The cache key was bumped so every installed phone drops the old
six-set list immediately.

**Proof.** 118 JavaScript tests plus 3 Python tests passed on Node 22. Vite,
Capacitor sync, Android unit tests, and APK assembly passed with
`@capacitor/camera@8.2.3`. The installed APK contains the Camera plugin and no
Anthropic key. On George's phone the Signal camera button opened Samsung Camera
as an image-capture activity. Both photographed card codes return catalogue
records from the live app lookup.

---

## Session log — 2026-08-23 photo source chooser

The main photo icon now opens two explicit actions: **Scan card** and
**Upload photo**. Scan keeps the native Samsung Camera path. Upload uses a
separate file input with no `capture` hint, so a saved image remains usable
after the physical card has disappeared under a mattress. The browser-only
camera fallback keeps its own captured input.

The chooser uses two 58px touch rows, closes on outside tap or Escape, and
keeps Scan and Upload as separate words everywhere. A 390×844 rendered check
confirmed both actions and their helper text. The Android build passed and the
updated APK installed over 2.9. The real installed WebView returned both menu
actions. The in-flight Reinforcement scan then completed as `L26D-ENS08`,
Starlight Rare, `72/100`, with 8/8 signals and 73% verified-source coverage.

---

## Session log — 2026-08-23 exact official Yu-Gi-Oh artwork

**The remaining wrong-card bug was the picture.** The result carried the right
name, `L26D-ENS08`, and Starlight Rare, but `CardImage` ignored the selected
card and searched YGOPRODeck by name only. YGOPRODeck has all three L26D rarity
rows but only the original Reinforcement art, so the UI displayed a different
card face while the text described George's card.

**Official live resolver.** `signal-gateway-v1` now resolves the exact row
through Konami's Yu-Gi-Oh Neuron database: exact name → official card ID →
set-code/rarity row → set page → that row's official artwork ID. For
`L26D-ENS08` Starlight Rare, the official row maps to `cid=5328`, `ciid=3`, the
same Sky Striker artwork in George's photograph. The mapping is cached privately
in Firestore for 30 days.

**Result and Collection keep the exact art.** `CardImage` now keys its cache by
card identity and rarity, asks the gateway for official art when a Yu-Gi-Oh
set code is present, and falls back to YGOPRODeck only when the official route
has no answer. The selected pin now reaches the result image, and that clean
URL travels into Collection when the user adds the card.

**Proof.** The live gateway returned the `ciid=3` official image on the first
request and `cached:true` on the second. The installed phone result then rendered
that exact official `cid=5328&ciid=3` URL. Three backend tests and 119 JavaScript
tests passed; the full JSX graph compiled cleanly, and the Android build passed.

---

## Session log — 2026-08-23 framed live scanner

The Scan action now stays inside Signal instead of handing framing to Samsung
Camera. A full-screen rear-camera preview draws a real trading-card outline,
four red corner marks, a large lower **CARD NUMBER / SET CODE** guide, plain
framing instructions, Cancel, and a one-handed shutter. Upload remains a
separate saved-image path.

Capture math maps the visible object-fit-cover frame back to the camera's source
pixels, crops only the card inside the outline, then sends the full card plus
its lower number strip to identification. Empty or invalid frames are refused.
The old external Camera plugin was removed; Capacitor's WebView permission
bridge handles the declared Android CAMERA permission and `getUserMedia` rear
camera stream directly.

Two crop regression tests and the full 121-test JavaScript suite passed. Mobile
390×844 and wide 800×900 rendered checks passed. On George's phone the installed
scanner opened a live 1080×1920 rear-camera stream with no error; the measured
card frame was 300×418, the correct 0.716 card ratio, with the number guide and
shutter visible in the real Android screenshot.

**Badgermole Cub cross-game proof.** Scryfall already had three live versions:
promo `167s`, alternate `326`, and standard `167`. An unframed scan that missed
the tiny number left three valid matches, so Signal correctly refused to guess
but could not help the user. The frame and number strip now supply that missing
identifier. Once selected, Magic and Pokémon artwork fetches now use the exact
catalogue ID instead of searching by name. Scryfall's required Signal-specific
User-Agent was also added; the former generic Node request returned HTTP 400.
All three Badgermole IDs now return distinct live Scryfall images. The suite is
now 123 JavaScript tests plus 3 Python tests.

---

## Session log — 2026-08-24 Dossier tab

Signal now has a third top-level page beside **Signal** and **Collection**:
**Dossier**. This first version is a premium research-service page, not an
instant automated order flow. It stays inside Signal's supported Pokémon,
Yu-Gi-Oh!, and Magic lanes.

The page explains five parts of the work: exact-print identification, source
research, full context, a retain/reallocate pressure test, and human review.
Grading-population evidence belongs in ordinary research when it can be tied to
the exact printing. Manual collector-ownership concentration research is
deliberately outside this version.

One real three-page sample ships with the app and can be previewed or downloaded
as a PDF: Reinforcement of the Army, `L26D-ENS08`, Starlight Rare. It uses
official Konami product and card records, separates verified facts from
inference and unknowns, and leaves the exact market price blank instead of
substituting the ordinary card's broad price. The PDF generator lives at
`scripts/generate_dossier_sample.py`; the app copy lives under
`public/samples/`.

---

## Session log — 2026-08-24 Signal + Collection finalization

The first two tabs were closed out before further Dossier work. Signal cache
hits now scrub stale broad card-level dollar figures from exact-print prose, so
the old `$0.13` Reinforcement number cannot return inside a summary after the
headline price is correctly blanked. Long recent-scan names also stay inside
their row without widening the phone page.

Collection no longer converts a missing price into `$0.00`. Exact-price gaps
show `—`; mixed collections show a known subtotal with `+` and the number of
unpriced copies. Finish choices now follow the game: Pokémon uses
Normal/Reverse, Magic uses Non-foil/Foil, and Yu-Gi-Oh! exact printings do not
receive a synthetic finish switch. Yu-Gi-Oh! rows show their actual rarity.

The empty shelf is now a complete state with a clear route back to Signal.
Removing every copy from the full card viewer requires a second confirmation.
Two Yu-Gi-Oh! printings sharing one card ID remain separate after reload. The
Dossier tab was left unchanged during this pass.

---

## Session log — 2026-08-24 final phone closure

The first two tabs are now closed on the real phone. Dossier stayed untouched.

**Signal.** The progress line moves at one constant rate, learns from real
uncached scan times, and reaches 100 only when the answer exists. A foreground
service kept a 78-second scan alive after Signal left the screen. The completed
answer survived Android activity changes and reopened at the top; it remains
saved until the owner deliberately leaves it. Search/history furniture is no
longer left above a loading or result page.

The live rear camera opened at 1080×1920. George's real Reinforcement of the
Army photo completed the full vision → catalogue → exact-report path as
`32807846:L26D-ENS08`, Starlight Rare. Konami's public image endpoint was the
source of the visible `SAMPLE` watermark. Signal no longer displays those
images: standard Yu-Gi-Oh! cards use clean YGOPRODeck art, and an exact
alternate-art scan keeps a small private copy of the owner's own card inside
Signal. The ROTA image remained clean after an app restart and after reopening
the cached result.

The final end-to-end test started the foreground service before the first
vision request, with Signal already hidden. Photo identification took 71
seconds; the service stayed alive through identification, exact-print lookup,
local-art save, and cached report retrieval. After a forced activity restart,
Signal reopened directly on the completed exact ROTA answer.

**Live focus repair.** Samsung had been free to select an auxiliary rear lens,
and Signal never requested a focus mode. The scanner now requires a rear
camera, prefers the main lens over ultra-wide/tele/macro devices, fixes logical
camera zoom at 1×, requests continuous autofocus, supports tap-to-focus, and
runs one final center focus before capture. The shutter resets on every open
and carries a camera icon instead of an empty video-like control. While the
scanner is open, Android hides third-party floating bubbles so no round overlay
can be mistaken for the shutter or cover the card. On the phone, the camera
reported Auto focus on, a frame tap reported Focused, the photo button was
enabled, the WiM bubble disappeared inside the scanner, and it returned after
Cancel.

**Exact loading art.** The loading theater used to throw away the selected
catalogue row and search by name again. A full-art card could therefore show a
cheaper or older image while its exact report was correctly running. Pending
scan state now keeps the same printing pin chosen in search or resolved from a
camera/upload. The loading card slate uses that exact image and prints the set,
collector number, and rarity beneath the name. A Captain America full-art
check resolved suggestion ID `7ffdca9d-3ee4-4572-b1ad-4f03523968fd` in both
the loading image path and the final result instead of the generic-name image
`33631d6c-c584-42ff-afe5-2647b5fb321f`.

**Collection.** The exact ROTA copy added with a blank price, Starlight rarity,
near-mint condition, and its local clean image. Card count, unpriced subtotal,
JSON backup, CSV export, app-restart persistence, card viewer, two-step Remove
All, and return to the empty state all passed on-device. The test holding and
its temporary export files were removed afterward.

**Proof.** 165 JavaScript tests plus 3 Python tests pass. GitHub's web and
Android jobs passed for `e17d7ea`. The APK was checked for embedded Anthropic
keys (zero), signed with the existing phone key, installed over 2.9, and
published privately as `signal-v2.9`.

---

## Session log — 2026-09-03 homepage attention pass

George chose four code-native motion ideas for the existing home screen: the
logo signal travels through the search border and game tiles; the game marks
wake in their own way; the current quick-pick tiles deal into place; and the
existing news cards throw a slow foil light above their strip. The quick-pick
and recent-scan entrances replay once whenever Signal is entered. The news foil
returns slowly. No panel was added and no section moved. Reduced-motion users
receive the same layout with every new effect disabled.

**Pinned for later, deliberately not built:** the giant ghost-card image behind
the top half of the home screen.

---

## Session log — 2026-09-04 recent-scan slab entrance

The first three visible rows in **Your Last Scans** now arrive after the
trending-card deal. Each row drops like a heavy slab, compresses on impact,
throws one short warm-gray dust puff across its lower edge, and settles. The
rows land one at a time. Older rows below the scroll stay still. The effect
runs once whenever Signal is entered and is fully disabled by reduced-motion
preference. George then raised only the peak dust density by exactly 20%
(`0.64` → `0.768`); spread and timing stayed fixed.

---

## Session log — 2026-09-04 Collection top-three value strip

The empty space below the active binder's card count now shows its three
highest unit-price cards, ranked from left to right. Each entry uses the saved
catalogue image, a visible rank, and the USD unit price. Quantity does not
inflate rank, unpriced cards stay out, and duplicate condition rows for the
same printing/form appear once. The strip recomputes whenever Collection data
or the selected binder changes.

---

## Session log — 2026-09-04 unified page-light cascade

The orbiting light around the Signal logo remains continuous at a nine-second
lap. On the first visit to each page in one app session, a thin streak of that
same light hands itself to the active page tab. There is no falling object or
teardrop shape. Each lower border finishes one calm lap before a short light
streak carries the shine to the next border. Returning to a page does not
replay the sequence.

The logo and every lower border use the same shared conic gradient, mask,
width, colors, and glow. Only each lap's duration changes. A separate
motion-path pill was tried, looked wrong on the phone, and was removed.

The lap rhythm after the logo is `6s → 8s → 4s → 9s`, then repeats where a
page has another border. Signal runs around the active tab, search, trending
panel, recent scans, and news. Collection uses the tab, search, binder group,
summary, then splits into six-second laps around the three highest-value card
images. Dossier uses the tab, opening research panel, method block, and sample
panel. The existing deal, game-mark, slab/dust, and foil effects remain.
Reduced-motion mode shows every item immediately and suppresses every handoff
and border lap.

---

## Session log — 2026-09-04 Collection binder entrances

The four binder tiles now run one entrance each time Collection is entered;
they do not loop while the page stays open. The entrances are staggered by
roughly 120ms and settle within 1.4 seconds. All cards rises while Gollum peeks
up and catches a gold glint. Pokémon rolls and bounces its Poké Ball with one
center flash. Yu-Gi-Oh! flips in and receives one red slash. MTG rises from
shadow while its mark catches an ember glow. The slow shared border-beam
cascade remains a separate first-visit-per-session effect.

---

## Session log — 2026-09-04 micro-detail pass

The layout stayed fixed. Small parts now answer the hand: page tabs settle,
the camera and lookup switch press, search takes a soft focus glow, card rows
and news cards give under a tap, result actions move in the direction of their
icons, and saved-card quantity changes tick into place.

Collection totals, exchange rows, and the three highest-value cards now finish
the binder entrance in a short stagger. Card-browser filters lock when chosen.
Dossier rules draw in, method numbers arrive in order, and the sample mark
stamps into place. Watch stars, source dots, jump buttons, scanner controls,
dialogs, and the card viewer use the same restrained tap language.

Every effect is short and tied to a page entry, state change, or touch. Nothing
loops. Reduced-motion mode shows the final state at once and removes every new
press transform.

---

## Session log — 2026-09-04 logo-only traveling light

The page-light cascade was retired after phone review. The bright handoff below
the logo, the trip to the page tabs, every lower-border lap, and all related
36-second timing state were removed. The Signal logo keeps its original thin
red frame and its continuous nine-second traveling border light.

This removal does not touch the trending-card deal, recent-scan slab and dust,
Collection binder entrances, news foil, Dossier detail entrances, or the small
tap responses. Those effects remain independent.

---

## Session log — 2026-09-04 visible news foil repair

The original news foil existed in CSS but failed on the phone. Its first sweep
finished while the news row was below the screen. Later sweeps followed the
card leaving through the left edge fade, and the narrow band was too faint to
read against article art.

The foil now waits until at least 35% of the news-card row is visible. It tracks
the card nearest the middle of the row, crosses that full card with one clear
gold-white band, and throws one short color-matched glow upward. A dot tap
centers its article. Each sweep lasts about 1.15 seconds and repeats only when
a new card becomes active or the row comes back into view. Reduced-motion mode
renders no foil elements or foil animation.

---

## Session log — 2026-09-04 neutral main search edge

The red one-pixel border around the large search box on the Signal home page
was removed. The field now uses the same quiet dark edge as the Collection
search. Its size, camera, Price/Full switch, focus glow, and behavior stay the
same. The separate Browse Cards search style was not changed.

---

## Session log — 2026-09-04 compact Latest Signal panel

The home page's three sparse preview boxes were replaced by one labeled
**Latest Signal** panel. It keeps the game, card name and image, score, market
price, 30-day trend, Creator Attention headline, evidence note, strength dots,
and direction. The sample state uses the same shape with a clear Sample Signal
label.

The market facts now share one short row. Creator Attention is a compact footer
with its detail clamped to two lines. The panel starts 22px below the news strip,
and the home-page Browse Cards section now begins 18px after the panel. The
Collection browser keeps its original 40px spacing. Phone widths of 360px and
390px and the 800px layout render with zero horizontal overflow.

---

## Session log — 2026-09-05 outdoor-visible ambient orbs

George's phone showed the moving red, gold, and blue background fields indoors,
but outdoor shade flattened them into the black page even at high brightness.
The fields were using a 44px blur with core alpha values as low as `0.22`.

The six orb cores and the page-length color wash are now brighter, and the orb
blur is tightened to `36px` with mild saturation. Panels, text, borders, motion,
and orb positions are unchanged. A matched gray-glare comparison keeps all
three colors distinct after the change, while normal Signal, Collection, and
Dossier renders remain dark with zero horizontal overflow.

---

## Session log — 2026-09-05 page-wide scroll reveals

Signal, Collection, Dossier, and the full on-screen scan result now reveal
their lower sections as those sections enter the viewport. One shared observer
starts each reveal slightly early, at a 14% lower-viewport margin. A section
fades in and rises 14px over 0.56 seconds, then stays visible for the rest of
that page visit. Only neighboring blocks use short 70ms steps; far sections do
not wait after a fast scroll.

The logo, page tabs, main search, result actions, errors, and loading theater
remain immediate. The reveal uses the independent CSS `translate` property, so
the existing card deals, slab dust, binder entrances, news foil, and inner
signal animations keep their own transforms. Reduced-motion mode shows every
section at once. The separate PDF report tree is never wrapped or hidden.

---

## Session log — 2026-09-06 direct-sun glow and slower reveal

Phone review found the ambient fields visible in outdoor shade but still hard
to see in direct sunlight. Every orb core, outer color, and the page-length
wash is now exactly 20% more opaque. Blur, saturation, positions, motion,
panels, and text are unchanged.

The page reveal also moves from `0.56s` to `0.75s`. Its 14px rise, early
viewport trigger, short neighbor steps, one-play rule, and reduced-motion exit
are unchanged. This makes the motion easier to see without delaying the page.

---

## Session log — 2026-09-06 selective text contrast

A real Signal home screenshot showed the main cream text clearly, while useful
small copy was using the same near-black greys as decoration. Two shared text
steps now separate those jobs: `#A8A498` for small copy on tiles and `#92897C`
for muted copy on the dark page or panels.

Only useful words moved up: inactive tabs, search hints, card names, printing
details, section labels, Collection counts and currency notes, Dossier method
copy, result metadata, and verified-source notes. Background art, watermarks,
lines, borders, glows, and other decoration keep their old low contrast. Font
families, sizes, weights, spacing, layout, and motion are unchanged.

---

## Session log — 2026-09-06 three-page swipe navigation

Signal, Collection, and Dossier can now be changed with one horizontal page
swipe as well as the existing top tabs. A left swipe moves forward and a right
swipe moves back. Signal and Dossier stop at their outside edges; they do not
wrap around.

The gesture requires at least 72px of horizontal travel and must be clearly
more horizontal than vertical, so normal page scrolling stays vertical. The
news track, expansion strip, search fields, card viewer, scanner, and add-card
sheet keep their own touch gestures. A completed swipe also blocks the button
click that could otherwise fire under the lifted finger.

The incoming page moves 24px from the swipe direction over 0.34 seconds. The
new page opens at its top. The transition does not change page layout, saved
state, or tab behavior. Reduced motion switches pages immediately.

---

## Session log — 2026-09-06 green light through clear gaps

The open space between Top Trending, Your Last Scans, and TCG Intelligence was
already transparent. The two cards themselves remain fully opaque. No panel,
tile, border, or text opacity changed.

The old blue ambient family is now the same muted green as the Price toggle:
`#608870`. A broad, shallow green field sits in the ambient background behind
the first-page gaps. The solid cards block it where they sit, while their clear
gaps expose it. Red and gold remain unchanged, and green replaces blue rather
than adding a fourth ambient color.

---

## Session log — 2026-09-06 middle green removed

Phone review rejected the green light across the middle of the first page. The
broad gap bridge, upper green orb, and mid-page green wash are removed together.
The transparent gaps and solid cards are unchanged.

Red and gold remain at the top. The separate lower green orb remains near the
bottom of the long page, using the Price toggle's `#608870`. Page swipes, text
contrast, news foil, and every other approved effect are unchanged.

---

## Session log — 2026-09-06 exact card data contract

Every card entry now becomes one exact card record before it can run Full
Signal or enter Collection. Typed names, card numbers, camera scans, uploads,
batch scans, Top Trending, the card browser, Recent, Watched, Collection,
retry, and restored sessions all meet the same gate. The record keeps the game,
catalogue printing ID, set, printed number, rarity, physical finish, exact
image, current exact-print price, price source, and check time together.

Scan cache keys now use only game plus exact printing/finish identity. Report
data, `_pin`, and printing metadata are synchronized to the same record on
save, cache hit, price refresh, and reopen. Old broad scans cannot run, return
from cache, affect score history, or silently enter Collection. Safe old exact
records are normalized in place.

Every relevant surface now consumes the same exact record. Full facts appear
in search choices, scanner confirmation, price results, card viewers, loading,
the full result, Latest Signal, the add sheet, CSV, and PDF. Compact Trending,
Recent, Watched, Browser, and Collection layouts keep their existing shape and
carry the full record into those detail views. Collection, Recent, and Watched
refresh their exact prices after 24 hours.

The unsupported fixed 30-day price field and the invented first-run sample
card were removed. Direction remains in the verified Signal scorecard and its
source implications.

The route contract is pinned by tests for all three games and every entry and
display surface. The complete local suite is 303 JavaScript tests plus 3 Python
backtest tests; the Vite production build passes.

**Layout restoration and real-phone closure.** The exact-card work first made
compact cards larger. That change was rejected and removed. On the Fold's
384px viewport, Browse Cards is three 112px columns, Trending is two compact
columns with 32px rows, Recent rows are 44px high, and Watched is a 25px chip.
Collection, scanner, loading, and price-result shapes match their old layout.
Page width and scroll width both remain 384px.

Phone checks then exposed four data faults that code-only checks had missed.
Saved Pokémon and Yu-Gi-Oh! prices were asking the weaker catalogue instead of
the exact TCGplayer product. `L26D-ENS08` was cutting the product list before
filtering by set code and silently returning the $0.15 Common. The same
Starlight card could be saved under both a catalogue ID and a TCGplayer product
ID. Reopen also kept an old marketplace title beside the printed card name.

The saved-price route now returns all seven held Pokémon/Yu-Gi-Oh! prices from
their exact TCGplayer products. Pokémon's two-card summary is $51.82; the five
Yu-Gi-Oh! cards are $406.73 at the final check. Typed `L26D-ENS08` shows Common
$0.15, Secret $0.59, and Starlight $262.45 before any choice. Yu-Gi-Oh! product
IDs are canonical, old aliases collapse without raising quantity, and reopen
rewrites the full saved session to the same printed name.

The saved `20260823_060636.jpg` upload resolved all three `L26D-ENS08` choices.
Choosing Starlight ran a complete 8-signal report at $262.45 from TCGplayer
with the exact product image and no 30-day field. Watched carried that same
record in its old compact chip and reopened the cached result. Collection
stayed at nine cards with one Starlight copy. The final clean laptop APK passed
303 JavaScript tests, 3 Python tests, Vite, Capacitor sync, and Gradle; its
SHA-256 is `42f1a75a99cf0ba19f095076a014c00a07b237b0e0a5bc545367ef9505e234a3`.

---

## Session log — 2026-09-06 live pipeline test and repair (Claude)

The pipe was driven end to end from outside the app: catalogue lookups, the
exact-print price route, every gateway action, three real Full Signal reports,
the shared cache across devices, the lease race, vision, trending, news, rates,
the backtest, and the build installed on the phone. What worked, worked: a
fresh Haiku report in 17–18 s with all 8 signals and zero dropped citations;
the phone's own 21:12 Reinforcement report served to a laptop in one second;
two identical requests spending one model call; `L26D-ENS08` → Common $0.15,
Secret $0.59, Starlight $262.45. What did not:

**Creator lane was dead twice.** The APK on the phone carried no YouTube key
(built from a Termux `dist/` where no `.env.local` exists), so `fetchCreators`
returned before asking. With the key, the exact-print filter rejected 6 of 6
real videos for Umbreon ex 161/131 because creators write "Umbreon SIR", never
"Umbreon ex Special Illustration Rare". Fix: the gateway now holds the YouTube
key (`youtubeSearch`, cached a day, capped at 95 searches a day for the whole
service and 60 per install), every build gets the lane, and
`sourceRelevance.js` accepts a creator's shorthand as long as the video still
pins the printing — base name, the set, and the number or a premium rarity.
A second search in that shorthand runs only when the catalogue wording finds
nothing. Measured on the six live titles: 3 kept, 3 dropped (the ambiguous
"Umbreon Pull REACTION" stays out). Model-found videos that pass the same
check now survive the creator gate instead of being erased for not appearing
in the pre-fetch.

**Japan lane** used the same missing key and the same filter; both fixes
apply. Google Trends answers 429 from the phone and stays best-effort.

**Reddit** answers 403 to every `search.json` call from a phone. The RSS
search feed still answers a browser agent, so `fetchCommunity` falls back to
it; those posts carry no score, and the block says so.

**One Pokémon card, two identities.** pokemontcg.io fails about half its
calls on a bad day; when it does, TCGdex answers and the same card arrives as
`sv08.5-161` instead of `sv8pt5-161` — two cache keys, two shared reports paid
twice, two Collection rows. `printingIdentity` now canonicalises Pokémon ids
(`pokemonIds.js`), and every TCGdex fallback translates the id first, which is
also why those fallbacks used to 404. Set-code lookup, Top Trending, and
catalysts gained TCGdex fallbacks for the same outage.

**Yu-Gi-Oh camera resolver.** A misread code (`OP02-EN010` for `L26D-ENS08`)
used to erase a correctly read passcode and rarity and return zero options.
The passcode rows, narrowed by rarity, are now offered as the choice.

**Money.** The per-install daily cap keys on a header the caller chooses. The
gateway now also enforces whole-service ceilings (600 model calls, 95 video
searches a day) and, once `SIGNAL_APP_TOKEN` is set on the service, requires
the token compiled into Signal builds for every paid action.

**Backtest** had zero rows with an exact printing id, so it could never score
anything and blamed the lookups. It now prints why rows were skipped, carries
exact ids for the four rows that could be pinned, and reads TCGdex when
pokemontcg.io is down.

**Re-scan never re-ran the model.** The button cleared the phone's local
cache and then received the same shared report from the gateway for seven
days. Re-scan now sends `force`, the gateway replaces the stored report (still
waiting behind a live lease), and the shared cache key carries a pre-fetch
version so reports written before this repair refresh once on their next open.

Version is 3.1 (`versionCode 22`); every build since 8/22 had shipped as 2.9
/ 20. 323 JavaScript tests and 4 Python tests pass.

**On-device proof (3.1 on the phone, 22:59 PT).** Tapping the Rayquaza VMAX
trending chip ran a full report inside the installed app in 25 seconds:
Evolving Skies 218/203 Rare Rainbow Holo, 57/100, 8 of 8 signals, **58% with
verified sources**, $1,255.34 from TCGplayer, foreground service started and
stopped, one ledger row, the day's model counter at 1. The three reports run
on this phone before the repair carried 10–36% verified sources.

**Headless testing.** The WebView debug socket was silent in every build so
far, so on-device checks needed the screen. `capacitor.config.json` now sets
`android.webContentsDebuggingEnabled`, so from the next build the app's
JavaScript can be driven over `adb forward … localabstract:webview_devtools_remote_<pid>`
with no taps. Samsung still freezes a backgrounded app, so the app must be
on screen or mid-scan.

---

## Session log — 2026-09-06 price history and the first measurement of the score

**The app has a memory of price now.** TCGplayer's per-product history answers
without a key: one row per SKU (variant, condition, language) with 90 days of
market price and copies sold. `src/services/priceHistory.js` picks English
Near Mint in the chosen finish, caches it six hours, and refuses to borrow a
neighbour's line: no TCGplayer product id, no history. The result page's price
strip shows 30-day and 90-day change with a sparkline; the PDF and the Latest
Signal panel carry the move; the 24-hour price top-up refreshes it; and
`signal_vs_market` is now computed from the score against the real 30-day
move instead of guessed by the model. The gateway relays the history host.

**First measurement.** 68 exact printings from TCGplayer's weekly movers
articles were scanned through the live pipeline; 55 had exact history. The
score did not describe the past month (AUC 0.42, the wrong side of a coin
flip), the flat 50s were the cards that had jumped, and evidence rose as
moves shrank because attention follows price. Nothing learnable in 55 rows.
Full numbers, caveats, and the three things to do about it:
`docs/SCORE_FIT_2026-09-06.md`. Those 68 rows now seed
`scripts/backtest-baseline.json` with exact ids, TCGplayer product ids, and
today's exact price, and `backtest.py` prices from TCGplayer history first, so
the forward test reads on 2026-10-06 with one command.

**Model refusal.** One scan failed because Haiku declined to output JSON and
asked a question instead. The prompt now says missing evidence is expressed
inside the JSON, never as a question.

Version 3.2 (`versionCode 23`). 329 JavaScript tests and 4 Python tests pass.

---

## Session log — 2026-09-06 the real move first, and the score is called Attention

George's call after the measurement. The result page now opens with the
price strip (market price, 30-day, 90-day, alignment) and the score panel
follows it. The score is labelled **ATTENTION** on the result page and in the
PDF, and its tier blurbs speak of attention, not pressure. Tier names,
weights, and math are unchanged; the forward test on 2026-10-06 decides
whether the label earns anything more. Version 3.3 (`versionCode 24`).

---

## Session log — 2026-09-07 sources belong to retrieval, never the model

A real Shedinja 144/132 phone scan exposed the remaining truth failure. The
screen said `8/8 SIGNALS` even though six areas had no source and the other two
reused one page. The model was also allowed to write the visible publisher,
title, date, summary, reach, audience, listing details, and report summary. The
old URL allow-list proved only that a URL appeared in retrieval; it did not
prove those model-written fields.

The model may now return only a selected URL and its `up`, `down`, or `neutral`
reading. Signal rebuilds every visible source from the actual web-search result
or pre-fetch API record. A URL absent from that locked registry is rejected. An
area with no locked evidence becomes neutral, loses all model prose, and says
that no verified evidence was retrieved. eBay rows come straight from the eBay
response. The report summary is built from exact price history and locked
source counts.

The header now says sourced areas and unique sources. The exact Shedinja raw
response reads `2/8 AREAS SOURCED · 1 UNIQUE SOURCE`; its six unsupported claims
are erased. Old reports cannot return: local scan cache and active-session keys
both moved to v2, and the shared report key moved to pre-fetch version 3.

Regression coverage pins the Shedinja failure, invented metadata, invented
URLs, changed paths, YouTube ID substitution, eBay field changes, and both old
cache doors. Version 3.4 (`versionCode 25`).

---

## Session log — 2026-09-07 use the whole search result page

The first 3.4 phone report was honest but still thin: Anthropic returned ten
real search-result records for one paid search, Haiku selected one, and the app
discarded the other nine. One paid search had been mistaken for one source.

Full Signal still makes exactly one paid web search. The search now asks for a
mixed page covering decks, tournaments, reviews, communities, creators, and
Japan while excluding stores and generic price listings. After Haiku's answer,
Signal independently sorts every useful, card-matching retrieval record into
an empty research area. Exact YouTube, Reddit, and JP pre-fetch records enter
the same sorter. Store listings remain in the price/listing parts of the app;
they cannot pose as research.

One URL may fill only one area. App-sorted evidence is neutral because its
existence is proven but no bullish or bearish reading is invented. Haiku can
still judge a source it selected, but its selected source must match both the
card and the research area. The test fixture feeds ten records from one search
page and proves eight different real sources can fill all eight areas while the
eBay and TCGplayer listings stay out.

The web-search fee remains one call per fresh report. Old thin reports cannot
return: local scan cache and active-session keys moved to v3, and the shared
report key moved to pre-fetch version 4. Version 3.5 (`versionCode 26`).

---

## Session log — 2026-09-07 measured card reader

Twelve card images from the phone were run through Haiku 4.5, Sonnet 4.6,
Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 3.5 Flash-Lite, and Gemini 3.7 Flash.
With Signal's real catalog, Haiku put the correct printing in the choices for
7/12 images, Sonnet for 8/12, and both Gemini 3.5 and 3.7 for 10/12. Gemini 3.5
plus a safe exact-name fallback reached 12/12. It cost $0.00106 per image and
finished in a median 1.9 seconds. Full results are in
`docs/CARD_ID_BENCHMARK_2026-09-07.md`.

Gemini 3.5 Flash-Lite now reads the photo through the existing Google Cloud
gateway. The card catalogs remain the authority. If a tiny code conflicts but
the name is exact, Signal shows exact-name printing choices and never auto-picks.
Sonnet runs only when Gemini plus the catalogs produce no choices. Haiku remains
the Full Signal analyst after the exact printing is locked. Version 3.6
(`versionCode 27`).

---

## Session log — 2026-09-08 native card camera and Collection start

**The camera is native now.** Signal's Android app uses CameraX 1.6.2 through
its own Capacitor plugin and full-screen activity. The old WebView camera drew
about 15 preview frames per second and sent a roughly 747×1043 crop on this
phone. The new camera returned a 4080×1748 JPEG with portrait EXIF rotation —
7.1 megapixels before Signal's safe upload resize. CameraX owns focus, exposure,
torch, tap-to-focus, pinch zoom, and the high-quality still.

**The scanner is quiet and manual.** One fixed white card frame, one line of
help, Photos, Flash, Close, and one red shutter are visible. The false `AUTO`
label and the dark set/number box are gone. Android hides third-party floating
bubbles while Signal owns the camera window. A Google document-scanner trial
was rejected because its camera lived in a Google Play services activity where
Signal could not hide the WiM bubble. There is no live edge detection or
automatic capture in this version.

**Three clear photo paths.** The camera icon opens Scan card, Batch scan, and
Upload photo. The Price/Full toggle remains inside the search box on both
card-search pages and selects the scan path before the camera opens.
Price mode shows the exact price and Add to Collection. Full mode confirms the
exact printing before the paid report starts. `Batch scan` keeps the multi-card
path reachable. The retired React camera shell does not render under
the native launch, but it stays mounted invisibly so the returned camera photo
always reaches Gemini. The scanner activity uses no page-slide animation.

**Collection opens first.** The page order remains Signal, Collection,
Dossier. A normal app launch starts on the middle Collection tab. From there,
a rightward swipe goes to Signal and a leftward swipe goes to Dossier; all
three tab buttons remain direct controls.

**Proof.** George completed two native price scans and added both cards to the
Collection. He then confirmed the scanner opens as one screen. A clean app
start selected Collection on the installed Fold with all 12 cards and the
$428.95 total intact. The native handoff, focused page-order checks, production
web build, Android debug build, Android unit tests, and Android lint passed.

---

## Session log — 2026-09-28 automatic card crop

Both search pages now prepare each camera or uploaded photo before reading it.
A small local worker finds four supported card edges, keeps a border around
the printed text, and straightens the photo. Unclear edges, multiple competing
cards, an unsupported browser, cancellation, or a processing failure keep the
original photo or cancel the scan. No new runtime dependency or paid call is
needed for the crop.

The resulting photo stays visible above the reading status. There is no crop
approval screen or extra tap. The reader receives that same photo, with a
full-width lower detail crop so both lower corners remain available. Single
and batch scans share the preparation step.

Four saved native camera photos (Pokémon and Yu-Gi-Oh) retained
their full card borders and numbers in the off-screen image checks. A black
photo kept the original. A background line initially distorted one crop;
tighter parallel-edge and continuous-support checks fixed it, with regression
coverage. Both rendered page flows returned the expected catalog printings.
All 345 JavaScript tests and 4 Python tests pass; the production build passes.

The phone received the web-only change through Capacitor's existing persistent
web-bundle path; its signed 3.6 Android shell and Collection data stayed intact.
A cold start loaded the new bundle. A saved-photo handoff in the installed app
matched Pidgeot 217. The browser's Signal flow also returned both BLZD-EN024
foil choices. The physical camera was
not used. Browser screenshots verified the preview layout; Android's hidden
display returned a black screenshot, so native verification used the live DOM,
cropped image dimensions, and catalog result. The normal APK build is 3.7
(`versionCode 28`), so its eventual installation clears the temporary web path.

## Session log — 2026-09-28 scanner results fit the phone

Long printing details forced the scanner's choice rows wider than the phone.
The selected name was also cut off. Results now use constrained columns and
wrapped names/details, with the summary price below the text. Choice prices
stay inside each row. The sheet scrolls vertically. Typed price-result names
use the same wrapping behavior. The real scanner component at 393px measured
393px content width, zero overflowing children, and fully fitting text/prices.
All 14 existing style tests and the production build passed. The new web
bundle was copied into the installed app and its CSS checksum verified.

## Session log — 2026-09-28 enlarge the selected scanner image

Tapping the scanner's small card image now opens the existing large viewer.
The thumbnail and viewer use the same selected image URL; switching the
printing switches that image. Drag-to-tilt, pinch, and double-tap zoom remain.
The viewer's artificial gloss and foil layers were removed so it shows the
supplied image without simulated shine. Closing the viewer preserves the
scanner and selection; Escape closes only the viewer. The nested viewer uses
the scanner's existing scroll lock.

The off-screen interaction check verified both variant image URLs, enlarged
image size, drag rotation, double-tap zoom, close and Escape behavior, and zero
artificial shine layers. The production build passed. The installed web
bundle was updated and its index checksum verified.

## Session log — 2026-09-28 use full-size scanner art

The scanner viewer incorrectly enlarged `imageUrl`, which is Scryfall's
146×204 thumbnail. The display record now retains `imageLarge`, and the viewer
uses that selected printing's full-size image. For The Lonely Mountain HOB 207,
the supplied PNG is 744×1040. The thumbnail still uses the small source.

The earlier interaction check verified URL switching but did not represent a
catalog with separate small and full-size images. Regression coverage now
passes an MTG catalog record through finish expansion and scanner display,
and checks that large art stays tied to the selected printing. All 8 scanner
match tests and the production build pass; the phone bundle was updated.

The live Scryfall record for HOB 207 supplies one image set for both nonfoil
and foil prices. Its stock picture does not show a separate foil appearance.
Showing the physical finish requires an actual photo of that finish; the
viewer preserves the supplied image and does not fabricate that detail.

## Session log — 2026-09-28 MTG treatments and exact-product pictures

MTG records now preserve Scryfall's treatment tags. Surge, Galaxy, Textured,
and other tagged foils keep their names through matching, the full report,
the add dialog, and Collection save/load. Normal/foil/etched remain the price
keys and part of the exact printing identity. The selected finish is kept
when adding a card, including single-finish cards.

The image lookup checks TCGplayer using the product ID supplied for the exact
Scryfall printing. Etched products use their separate ID where supplied. A
successful full-size image replaces the catalog picture without changing the
card or price; an unavailable image keeps the catalog fallback. Checks have a
three-second ceiling and a bounded per-session cache. A shared product's
headline price cannot fill a missing price for one particular finish.

Sources that share one picture across finishes are labeled in the scanner
and viewer. The live check covered all seven finish choices across The Lonely
Mountain's four printings. HOB 284 showed Surge Foil and product image 707062;
HOB 207 retained its separate non-foil/foil prices and explicitly shared photo
707061. No finish appearance was generated. This does not create missing
physical foil photos where both catalogs supply the same stock image.

All 354 JavaScript tests, 4 Python tests, and the production build passed.
Coverage includes labels surviving save/load and reports, etched image IDs,
missing-image fallback, and missing finish prices. The browser image probes
and rendered result/viewer used real catalog records and TCGplayer images.
The stale three-column layout assertions were updated for the previously
requested wrapped two-column layout. The phone web bundle was updated and
its index checksum verified.

## Session log — 2026-09-29 Pokémon foil variants

Pokémon matches now read TCGdex's detailed variants, including Poké Ball,
Master Ball, Cosmos, named foil patterns, and stamps. Matches from the primary
Pokémon catalog are enriched with the same detailed data. Typed searches open
the full version list before selection; scan/upload matches retain all
versions of the matching card. Both pages use the shared scanner.

Each special version keeps a stable identity, label, exact marketplace ID,
price, and image through Price Only, Full Signal, Collection save/load, and
price refresh. Existing ordinary Normal/Holo/Reverse identities stay intact.
TCGplayer's price bucket can differ from the physical finish: Master Ball is
a reverse holo sold in its dedicated product's Holofoil bucket. Versions
without USD pricing remain unpriced. A broad name search cannot replace them
with the ordinary card's price or history.

Exact-product photos use the catalog's verified TCGplayer links. Shared or
missing variant photos retain the catalog fallback and a shared-photo note.
The offscreen browser check used the real Eevee PRE 074 catalog response:
five choices survived selection; Poké Ball and Master Ball switched to their
own photos and prices; Cosmos retained an unavailable USD price. The enlarged
Master Ball image loaded at 734×1024, and the 393px screen had no horizontal
overflow. Typed search selected the same version once, without reopening its
picker. This checked matching and rendering with recorded catalog input,
not a new physical camera scan.

All 362 JavaScript tests, 4 Python tests, and the production build pass.
Eight new tests cover detailed prices, identities, collection/report survival,
refresh/history selection, image fallbacks, primary-catalog enrichment, and
more than eight variants. The phone's persistent web bundle was updated and
its index checksum matched the build.

## Session log — 2026-09-29 foil shine previews

George authorized a visual shine effect where a distinct foil photo is
missing. A shared display rule now adds a light sweep to foil/reverse-holo
catalog fallbacks, with a silver sweep for etched finishes. Non-foil choices
and resolved distinct product photos keep their original appearance. The
large viewer labels the effect "Shine preview" and moves the light with the
existing drag gesture. Reduced-motion mode disables automatic movement.

Both scanner entry points, Price Only results, Collection cards, and the
full-report card use the selected record. Price Only thumbnails now open the
same large viewer. The effect does not alter card identity, finish, price,
or stored image data. Missing prices remain unavailable. The image cache
also distinguishes Pokémon patterns and changed exact-photo URLs, and MTG
reports retain supplied full-size product pictures.

All 367 JavaScript tests, 4 Python tests, and the production build pass.
Offscreen checks used recorded live Eevee and The Lonely Mountain catalog
data plus actual product images. Normal cards stayed plain; shared foil
photos received the preview; Poké Ball/Master Ball and the resolved Surge
Foil photo stayed unmodified. Prices followed each selection. Scanner,
typed Price Only enlargement, Collection save/load, drag-controlled shine,
reduced motion, and 393px/1280px widths were checked. A stale layout assertion
was updated to accept the added image-container class while retaining its
collection-button check.

## Session log — 2026-09-29 printed-number lookup repair

George's Eevee photo was read correctly at 11:44:13: the actual Gemini reply
said Eevee, Scarlet & Violet Black Star Promos, and `SVPEN 173`. The lookup
compared that whole string with catalog number `173`, searched only a capped
name list, then returned unrelated Eevee printings. The exact catalog card
already existed as `svp-173`. This was a matching failure, not an OCR failure.

Pokémon and Magic scans now query the printed number before display limits.
Printed set/language badges are separated from the number; zero padding and
promo-set aliases are normalized while meaningful TG/GG/SWSH number prefixes
remain distinct. Pokémon reads TCGdex's detailed versions first, validates
the set (including official abbreviations) and printed total, then falls back
to a number-filtered Pokémon TCG API query. Magic searches Scryfall by set and
collector number and validates the read name, including either face of a
double-faced card. A numbered miss now returns no unrelated-number choices,
allowing the existing second reader to retry. Numberless manual choices still
work. Yu-Gi-Oh!'s existing exact-code and passcode paths were verified.

The recorded reader reply was replayed against live catalogs and the real
scanner component, using George's saved native photo without another paid
OCR call. It now returns only `svp-173` Holo and Pokémon Center Holo. The
catalog lookup took 0.96 seconds; the offscreen result including real product
image checks took 1.53 seconds. Both photos and numbers matched. This catalog
currently supplies no USD prices for those two promo variants; they remain
explicitly unpriced. A live Magic replay returned only HOB 207 and its two
finish prices. The name/number regression cases failed before the repair.

All 375 JavaScript tests, 4 Python tests, and the production build pass.

## Session log — 2026-09-29 verified Pokémon product prices and photos

The correct Eevee SVP 173 choices were unpriced because detailed Pokémon
records skipped the entire price fallback. Live TCGplayer records exposed
another problem: TCGdex linked the standard and Pokémon Center variants to
each other's product IDs. Their real product descriptions and photos proved
the reversal. Simply removing the price guard would have swapped their prices.

A shared resolver now checks the known product candidates against the game,
name, set, collector number, physical treatment/stamp, and English finish
SKUs. It chooses a unique verified product and binds its photo and price to
that version. No card-specific ID swap or broad name-price guess is used.
Dedicated products can supply their market price; products that combine
Normal and Reverse keep the selected catalog finish price. Unknown or
conflicting links stay unpriced and use catalog art.

The verified fields survive scans, typed choices, reports, Collection, and
price history. Old saved entries recover their candidates from the exact
catalog record. Refresh applies corrected price, image, and product ID
together. A change to the selected version invalidates the earlier binding.
Product requests share a bounded five-minute cache.

The live scanner replay showed standard Eevee at $9.44 with unstamped image
610758 and Pokémon Center Eevee at $82.70 with stamped image 610757. Selecting
each changed its small picture and price together; the large stamped image
loaded at 734×1024. The lookup made two product-detail requests for both
choices. Offscreen browser reads used a local mirror of Android's enabled
native HTTP transport to reach the same live product endpoint.

All 124 focused service checks and the production build pass, including
reversed links, existing wrong prices/photos, mixed-finish prices, rejected
product metadata, saved entries, report conversion, refresh, and history.
GitHub checks were not run, per George's instruction.

## Session log — 2026-09-29 complete printed card numbers

Adventurer's Discovery displayed only TG23 because the scanner's text helper
dropped numeric set totals. The shared Pokémon label also needed the gallery
prefix on the denominator. It now displays TG23/TG30 and GG33/GG70, accepts
already-complete numbers without repeating the denominator, and preserves the
full denominator supplied by a verified product record. Variant records keep
their set totals through refresh and report conversion.

The actual card was replayed offscreen against live catalogs. Lookup choices
and the large viewer showed TG23/TG30 beside the same $3.71 price; Collection
save/load retained the full label and the existing card identity. All 42
focused checks and the production build pass. No GitHub checks were run.

## Session log — 2026-09-29 Collection name and printed number

Collection cards now show their printed identifier beside the name, using
the same formatter as lookup and the large viewer: Pokémon TG23/TG30,
Yu-Gi-Oh! L26D-ENS08, and Magic HOB 207. Button labels and titles include the
identifier too. Long names and numbers wrap instead of being truncated.
Rendered Collection checks covered all three games at 320px and 393px with
no horizontal overflow. All 57 focused checks and the production build pass.

## Session log — 2026-09-29 shared matching and foil-price regressions

George's failed scans exposed gaps in the shared rules. MTG alternate printed
names were rejected against the underlying rules name; an inferred main-set
name excluded Commander cards; and a rarity badge attached to a number
(`M0005`) was treated as part of the collector number. The matching rules now
handle catalog-provided aliases, full set-name guesses, and rarity prefixes
while retaining exact collector-number checks. Explicit set codes remain
strict. These are general rules, with no card-specific production overrides.

Some named foils have separate marketplace products, while Scryfall links
both finishes to the normal-only product and leaves the foil price blank.
The shared price fallback now validates game, names/aliases, set, number,
named treatment, and English finish SKUs before using a dedicated product's
price and picture. It preserves available catalog prices and never substitutes
a combined Normal/Foil headline for an unknown foil price. Corrected links
survive reports, Collection refresh, and price history. Recovering a price
keeps the labeled shine preview for catalog art already known to be shared.

Provider names and shared-photo implementation notes were removed from card
results, suggestions, add dialogs, and viewers. Source records remain in the
data. The five recent cards were replayed through the real scanner component
using their saved photos and recorded reader output, with live catalog and
marketplace requests. All matched and displayed both finish prices, with no
provider names or horizontal overflow. Enlarged views kept the selected price.
The live Surge Foil checks returned Hulk $5.34, Black Widow $29.56, Repulsor
Shields $7.56, and Plaza of Heroes $7.66; Captain America matched both reader
outputs and kept its $3.42 non-foil/$0.68 foil quotes. Focused regression checks
also cover another named foil, wrong-number/normal-product rejection, renamed
printings, saved-card refresh, and preservation of the Pokémon and Yu-Gi-Oh!
paths. GitHub checks remain manual.

## Session log — 2026-10-02 batch scanner prices and pictures

Native batch Done used to send only the first photo into the single-card
confirmation screen. Each next photo required Keep, and finishing the queue
opened the camera again. Done now reads and prices every returned photo in
order, then leaves the batch picture-and-price list open. Photo uploads and
the web camera use the same batch reader. Progress shows the current card.

Unreadable photos stay in the list with Retry; ambiguous printings stay with
a choice of exact printing/finish. Neither stops the remaining cards. Results
show enlarged card pictures on tap, individual prices, and the near-mint total.
Changing a finish updates both its displayed price and the total. Scan more
appends to the batch; cancelling that camera returns to the existing results.
Saving to Collection is optional and requires every remaining card to have an
exact printing. The old Keep loop and extra condition/quantity fields are gone.

Proof: 18 focused local tests passed, including native multi-photo delivery,
a failed middle photo, cancellation, and finish-sensitive prices/totals. A
390px browser check rendered the real scanner with controlled identification
results: four photos, printing selection, failed-photo retry, image enlargement,
finish changes, and Collection handoff passed. Production build passed. The
web update was copied into the installed app's existing persistent bundle;
its index and entry assets match the local build by SHA-256. Physical card
scanning is left to George's requested phone check. No GitHub checks started.

## Session log — 2026-10-02 four Top Trending cards

Top Trending now shows four cards in a two-column, two-row grid. Removed the
panel's internal scrolling and fade, and made each card a 44px touch target.
The feed now fills four verified printing slots across the available games
instead of stopping at each game's quota. This fixes the two-card result when
only Magic resolves. The cache version changed so the installed app refreshes
the old two-card list; partial results retry after five minutes.

Proof: seven focused feed tests pass. The live feed returned four exact Magic
cards. A rendered check with those live records confirmed two rows and two
columns without clipping or scrolling at 320, 390, and 800px. Production build
passed. The phone's persistent web bundle was updated and all build files
matched by SHA-256. GitHub checks remain manual and were not started.

## Session log — 2026-10-03 visible batch version prices

Batch results now show printing and finish choices as buttons directly below
each card. Each button shows its version label and price; the chosen button
has a check mark and green background. A tap updates the card price and total,
and Collection receives the chosen printing and finish. This replaces both
batch dropdowns. Single-card scanning is unchanged.

Proof: production build passed. A rendered scanner check verified that both
Yu-Gi-Oh rarity prices stay visible, selection updates the total, a selected
Magic foil is passed to Collection, retry and image enlargement still work,
and the layout fits 320px and 390px screens. The installed phone web bundle
matches all local build files by SHA-256. No GitHub checks were started.

## Session log — 2026-10-03 Collection card management and value clarity

Implemented the approved Collection changes 2, 3, and 4. Card faces now show
clear catalogue art, readable full names and printed numbers, finish badges,
quantity, unit price, and the total for multiple copies. Tapping any part of a
card opens a management sheet with the picture, exact version, per-copy and
holding estimates, price-check date, and edits for quantity, condition, and
paid cost. Change finish loads verified variants of the same printed card
from the live catalogues with their prices and product pictures. Enlarging
the picture, opening the exact card's Signal, and confirmed removal remain.

Edits preserve added dates and unknown purchase costs. When an edit joins an
existing condition/finish holding, quantities and known paid costs merge;
the migration rule that takes the larger quantity is not used for this edit.
Invalid quantities, unrelated printings, over-cap merges, and storage errors
are reported. A finish with no price never inherits the old finish price.

The collection total is labeled Market estimate. It shows priced/missing
copies, stale quotes, price-date coverage, and active refresh status. Both
the total and card details explain that prices do not adjust for wear.

Proof: 62 focused local tests pass, including edit persistence, merge math,
finish product identity, missing prices, unknown costs, and storage failures.
The rendered app was tested with a separate saved collection copy: quantity,
condition and paid edits survived reload; image enlargement and removal
confirmation worked; the sheet fit 320/390/800px widths. A live Badgermole Cub
catalogue lookup supplied both finishes and the foil selection saved with its
matching price. Before/after screenshots were inspected. Production build
passed and every installed phone bundle file matches by SHA-256. No GitHub
checks were started. The existing page order is unchanged.

## Session log — 2026-10-04 remove stretched card-tile gaps

The Collection card buttons used height:100% in equal-height grid rows.
The browser centered the shorter button contents, leaving empty bands above
the pictures and below the prices. Long names in neighboring cards exposed it.
Card tiles now size to their own contents and use an explicit vertical flex
layout; grid items align at the top.

Proof: reproduced with the Yu-Gi-Oh binder sorted by price. Before the fix,
shorter contents had up to 20px of empty space on each end. After the fix,
all tested tiles at 320/390/800px have only their 1px border above the art and
below the content. The matching screenshot was inspected and the production
build passed. All installed phone build files match by SHA-256. GitHub checks
were not started.

## Session log — 2026-10-04 balanced Collection summary

Replaced the summary's two tall columns with a shared count/value heading,
a full-width row of the three highest unit-price cards, and a compact footer.
The larger card previews show their names and prices; each opens its exact
saved-card management sheet. Currency conversions, rate date, quote coverage,
price dates and wear note now share the full-width footer.

Proof: the actual rendered Collection was checked at 320/390/800px with the
Yu-Gi-Oh binder. The sections stack without overflow; all three card buttons
open their matching records; the empty collection has no empty card row.
The screenshot was inspected. All 60 focused collection, currency and layout
checks pass, including the updated assertion for the quantity badge. The
production build passed. Installed phone files match every local build file
by SHA-256. No GitHub checks were started.

## Session log — 2026-10-04 remove Collection summary notes

Removed the ECB reference line and the summary's priced-count, price-date,
refresh, stale-price and wear text at George's request. The footer now contains
only the currency values. Removed the unused UI state and date formatter.
The price-refresh and currency-conversion behavior remains in place.

Proof: production build passed. The rendered summary has none of the removed
text at 320/390/800px; all currency values and three working card links remain.
The empty collection also has no notes. Installed phone files match the build
by SHA-256. Font, color and effects changes await George's scope choice.

## Session log — 2026-10-04 equal Collection tiles and printing details

Collection tiles now use matching text rows so names, finishes, and quantities
do not produce different card heights. Art remains anchored to the top.
Double-faced Magic cards use the front-face name in the grid; the complete
name stays in saved data, accessibility labels, and card details. Magic tile
identifiers show a four-digit display number, rarity letter and set code
(e.g. 0231 M · FIN), with the expansion name on its own line. Existing Pokemon
fractions and Yu-Gi-Oh set codes are unchanged. Full text is kept in titles
and card details when a two-line tile field runs out of room. Multi-copy
totals remain in the detail screen; the grid keeps quantity and unit price.

Also removed the remaining green price-check/date/wear box from card details
that George flagged after the summary notes had been removed.

Proof: 74 focused tests pass. The real Genji Glove and Kefka, Court Mage
catalogue records were rendered at 320/390/800px. Tile heights match to the
pixel, art starts at the top, identifiers and expansion labels are present,
and opening Kefka shows the full two-face name. The screenshot was inspected;
the price-note box is absent. Production build passed, and installed phone
files match all local build files by SHA-256. No GitHub checks were started.

## Session log — 2026-10-04 floating bottom navigation

Added a matte charcoal bottom bar with warm accents, line icons and clear
Signal, Collection, Scan and Dossier controls. It appears after the top tabs
leave the viewport and highlights the current page. Visited pages stay
mounted while hidden, retaining Collection binder/sort choices and each
page's scroll position. A result finishing on a hidden Signal page does not
scroll the currently viewed page. Page swipes share the same position restore.

Scan opens a focused three-choice menu: Single card, Batch scan and Saved
photo. All three reuse the existing Collection SearchBar scanner handlers;
the scanner now renders through a body portal so it can launch while that
page is hidden. Manual-match fallback reveals Collection's search. The bar
hides for scanner/card/add dialogs and keyboard use. Content has enough bottom
space to clear the bar, and the save message sits above it. Motion respects
reduced-motion preferences; scan choices support Escape and keyboard focus.

Proof: 35 focused navigation, scanner, session and layout checks pass. The
actual rendered app retained three independent scroll positions and the
selected Yu-Gi-Oh binder/price sort. All three scan choices launched the
correct scanner mode/source from Dossier with Collection hidden; browser
camera access was stubbed for this navigation check. Card dialogs and a
simulated keyboard hid the bar. Menu focus/Escape, bottom content clearance,
and 320/390/800px layouts passed. Screenshots of the bar and scan menu were
inspected. Production build passed. Installed phone files match the local
build by SHA-256. No GitHub checks were started.

## Session log — 2026-10-04 slimmer transparent bottom bar

Reduced the bottom bar from 72px to 52px, narrowed its maximum width, and
lowered its bottom offset. The background now uses a translucent 36% tint
with a light blur, a finer border and less shadow. Removed the solid active
and Scan button blocks; icons and labels have a smaller visual footprint.
Tap targets remain 44px high. Reduced the page's reserved bottom space and
lowered the save-message position to match the smaller bar.

Proof: computed browser height is 52px and background alpha is 0.36. The
rendered check used fixed quote dates to keep live price refreshes from
moving the fixture layout. It passed page/binder/scroll memory, all scan
routes, keyboard/dialog hiding, Escape/focus, 320/390/800px fit and bottom
content clearance. Screenshot inspected; production build passed. Installed
phone files match the local build by SHA-256. No GitHub checks started.

## Session log — 2026-10-04 card-first Signal report

Rebuilt the report header around card art, name, exact printing, market price,
and the attention finding. Add to Collection is the main action; Watch stays
beside it. PDF, Share and Re-scan moved into a keyboard-accessible Tools menu.
Back stays above the report. The five existing action-handler bodies are
unchanged, including PDF export and sharing. The report uses a compact brand
header, quieter colors, one reading typeface, and no ambient glow or card-art
reveal motion. Fixed the reveal wrapper's default opacity when disabling its
animation so the picture remains visible. Removed the old small-print footer.

Price history now shows only periods with actual numeric values; zero remains
a valid move. Missing price/history leaves no empty columns. Removed the
standalone alignment confirmation that could display a saved model "agree"
label without market history. With no sourced areas, the attention headline
says unavailable instead of presenting the neutral default as a finding.
Source counts and the user's score-history comparison remain under Sources.

Proof: 72 focused display, history, scan-session, collection and layout tests
pass. Controlled copies of the screenshot's missing-data state and a priced
state were rendered at 320/390/800px. Checked image visibility, heading size,
no overflow, Tools/Escape, Add, Watch, enlarged image and Back. Numeric history
including zero renders; missing history/alignment does not. All five original
action handlers were compared byte-for-byte after moving them; PDF/share were
not sent during this layout check. Screenshots inspected. Production build
passed and contains no review fixtures. Installed phone files match every
build file by SHA-256. No GitHub checks were started.

## Session log — 2026-10-04 Japanese evidence repair

A fresh Meowth 144/128 report reproduced the fault: an English-titled YouTube
clip retrieved in both regions was relabeled jp_hype, then rejected from
Creator Attention for being in the wrong area. Source diagnostics now retain
the actual rejection reason and any reassignment. Valid retrieved links can
move to the correct section without inventing a directional signal.

Japanese lookup now uses source-backed Japanese names, preserves Japanese
characters, and checks printing identifiers. JP region/language search hints
alone cannot qualify an English clip as Japanese evidence. Japanese identity
lookups use TCGdex/PokeAPI, Scryfall Japanese printings, and Konami's Japanese
card page for Yu-Gi-Oh. Card-name-only mappings are distinguished from verified
Japanese printing mappings. The gateway can retrieve Japanese catalog data
and audio-language metadata, and supplies verified Yu-Gi-Oh Japanese names
and OCG release dates. MTG now participates in Japanese prefetching too.

George approved two bounded web searches per fresh Full Signal report: one
English and one Japanese. The gateway accepts both legacy one-search calls
and the new two-search calls. Existing per-install/global model and YouTube
caps remain. Shared/local research cache versions advance so old mislabeled
reports do not mask the repair. Saved active reports filter and relocate
false-Japan clips. Empty research areas collapse into one list; internal
rejection messages are removed from the report.

The baseline trace and implementation work are under the local Japan audit
folder. Before George's instruction to stop checks, the focused evidence run
passed 52 tests and the gateway passed 16. A full suite exposed four old
source-layout assertions; those were updated but not rerun. Further checks
and a fresh post-repair Japanese report were stopped at his request. The final
web build completed and the gateway deployment returned ACTIVE. The phone's
web bundle was updated. No GitHub checks were started.

## Session log — 2026-10-04 missing areas inside Sources

Moved Areas without sources into the main Sources panel, directly below its
counts. It has its own collapsed disclosure. Removed the separate list at
the bottom of the report. Built and updated the phone; no test runs requested.

## Session log — 2026-10-04 match sources to each research area

The saved Meowth search had retrieved Japanese expansion lottery/restock
articles. The shared citation filter rejected them because they lacked the
exact card name/number. Source locking and unused-result recovery now share
an area-aware subject rule: expansion news supports release/supply and set
coverage, while franchise news can match the character or game. Japanese
reservation, lottery, restock and arrival terms route to release news.
Exact-card creator matching and market price fetching remain strict.

Broader context carries app-owned evidenceScope and stays neutral rather than
inflating the card score. Japanese searches no longer require a card number
for all research areas; counterpart identities still require source proof.
Shared and local research cache versions advance for fresh scans. Regression
cases cover the actual missing Japanese articles, wrong expansions, franchise
matching and expansion-only videos. The production build completed and the
phone web bundle was updated. Tests and GitHub checks were not run, per
George's instruction.

## Session log — 2026-10-04 clear source counts and separate strength

Replaced unlabeled strength rectangles in Jump to and category headings with
a shared plain source count (1 source / 2 sources). Expanded categories show
labeled Strength and Direction separately. The previous citation change had
incorrectly cleared assessed strength when every accepted source was neutral;
accepted ratings now survive regardless of direction. Sources recovered or
reassigned without a rating explicitly remain unassessed, shown as Not rated.
Older neutral zero ratings are also shown as unrated rather than guessed.

The existing overall score already treats neutral direction separately from
strength. The prompt now states this distinction, and cache versions advance
for fresh research. Added a regression case covering equal strength across
up/down/neutral and unrated recovered evidence. Production build completed,
and the phone bundle was updated. No test runs, visual checks, or GitHub
checks were performed, per George's instruction.

## Session log — 2026-10-04 research integrity repair

Implemented the nine findings from the full Signal-run review. Price history
now requires an explicit English Near Mint SKU and matching finish/edition;
it never selects a neighbouring price, another language, or another condition.
History rejects stale endpoints and out-of-window comparison dates. Saved
price fallbacks retain their original checked time and are labelled saved.

Research expiry uses the original shared-report timestamp rather than a new
phone-save clock. Re-scan bypasses model, YouTube, history and Japanese-name
lookup caches. YouTube queries include a seven-day window, and citation
filtering also enforces it. The server preserves YouTube cache timestamps.
The app shows research dates and per-lane checked, empty, partial, unavailable
and not-checked states. Community is labelled Discussion, and source counts
are explicitly a research sample rather than total activity.

All relevant retrieved links can survive even in populated areas. Duplicate
URLs and identical/near-identical article titles are removed. AI assessments
require a matching excerpt from the retrieved title/snippet and a current
source. This verifies the quoted text exists; it is not independent proof
of the AI interpretation. Structured catalogue facts are citable neutral
context, not evidence of purchase demand or print quantity. English launch
news alone cannot qualify as Japanese release news. JP leading-indicator
claims were removed. Card/set/franchise scope is visible with each source.

Score version 3 has an explicit AI strength rubric, includes neutral context
in directional weighting, and returns no score when nothing is assessed.
It is labelled experimental with its rated-area count and no proven price
prediction. Research version 8 and fresh local/session cache namespaces
separate the new rules from prior reports. The measurement ledger accepts
unrated scans and stores research version/date and assessment/source counts.
The old September basket does not establish this version's predictive value.

Price top-ups rebuild the summary and price-history alignment together.
Alignment is unknown without measured history. The PDF uses the same rebuilt
report and displays experimental ratings, source scope, supporting excerpts,
research status and original timestamps. Recovered sources without a rating
remain visibly unrated.

Added researchIntegrity.test.js to the test command with regressions for exact
SKU matching, neutral weighting, unrated results, excerpt/date requirements,
multiple sources, duplicate stories, JP classification, citable facts, research
age, lookup status and refreshed summaries. Updated the old nearest-price and
neutral-weighting expectations. Test runs and live card scans are deferred
until after shipping, as George requested. Production builds completed; the
gateway deployment returned ACTIVE at 2026-10-04T20:50:04.891952528Z.
The final production web bundle was installed on the phone. No test suites,
GitHub checks, browser checks, or new paid scans were run during this repair.

## Session log — 2026-10-04 collection card panel scrolling

George's screenshot showed Your card opening halfway down the phone, with
the lower form unreachable. The fixed overlay was rendered inside the page
swipe animation, whose retained transform establishes a containing block.
Moved the details panel and its image viewer to a document.body portal. The
backdrop now follows the visible viewport (including keyboard resize), the
panel is bounded to that space, and the form has an explicit flex scroll area.
The header remains outside the scrolling form. Focus restoration no longer
moves the collection page. Production build completed and the phone bundle
was installed. Test runs and device gestures remain deferred as requested.

## Session log — 2026-10-04 shared card-version images

Browse Cards showed three Yu-Gi-Oh! rarity rows with one YGOPRODeck image.
The general fault was using card-name artwork for physical versions and
requiring a market price before looking up a product photo. Added a shared
Yu-Gi-Oh! product-image resolver keyed by name, expansion, number and rarity.
It uses the existing TCGplayer search route and works without a price.
Ambiguous/missing matches remain image-unavailable rather than borrowing
another rarity's picture. No card names or product IDs are hardcoded.

Set browse, passcode results, name-search fallback, scan choices, full reports,
and saved-card refresh now use the shared path. Exact product rows stamp
an image identity; the canonical card record preserves it and invalidates
it when version identity changes. The image cache advances, and CardImage
now responds to rarity changes. Browser photo enrichment uses the existing
finish-aware product resolver for Pokémon and Magic too. Saved collections
upgrade their catalogue photos where an exact product photo is available.

Browse tiles keep separate versions and show rarity/finish plus printed
number under a two-line card name. Existing detailed views and scanner
choices retain their version labels. An open collection editor keeps its
identity while its image is enriched. Failed image lookups are bounded and
do not prevent later saved cards from being processed.

Read-only catalogue inspection found three distinct product records for the
screenshot's card. Their actual product photos were retrieved and inspected;
they show the corresponding Ultra Rare, Starlight Rare and Secret Rare
versions. Added generalized regression definitions for exact matching,
no-price images, ambiguous matches, distinct rarities and invalidation when
rarity changes. Test runs and phone interaction checks remain deferred.
The final production build completed and its web bundle was installed on
the phone. No test suites or GitHub checks were run.

## Session log — 2026-10-04 shared card viewer viewport

George's Browse Cards screenshot showed the viewer header below the Signal
page header, followed by a black area. CardLightbox was still rendered inline
inside page/reveal transforms. Its fixed backdrop used the long page as its
containing block, placing the centred card outside the phone viewport; normal
focus also moved the underlying page. The earlier collection-dialog repair
had missed this separate shared viewer.

CardLightbox now portals to document.body for every caller, follows the visual
viewport, and uses bounded rows for its heading, image, hint and actions.
Focus and focus restoration prevent scrolling the underlying page. Explicit
loading and failed-image states replace silent image failures. The collection
editor's nested viewer uses this same path. Production build completed. A
read-only attempt to inspect the background WebView did not return and was
stopped; no live gesture or visual verification is claimed.
The production web bundle was installed on the phone. No test suites or
GitHub checks were run; the phone visual check remains next.

## Session log — 2026-10-04 missing product photos regression

George's 15:50 screenshot showed missing images across two browse rows.
The previous matcher assumed name + set + number + rarity identifies one
product. Real source data disproved that: standard and extended Ultra Rare
art share those fields. YGOPRODeck also supplied a placeholder rarity, New,
which was incorrectly displayed as a real version. The strict matcher then
blanked the ambiguous and placeholder rows.

Browse reconciliation now groups catalogue records by card/set/number, reads
the actual product versions, and keeps each real product once. Rarity and
artwork labels come from those records, including standard, extended and
alternate art. New/unknown placeholders do not become physical versions.
Single-card resolution prefers its known product ID, retains a previously
verified image if a recheck fails, and never guesses between artwork variants.
Artwork identity is preserved in normalized records, saved cards, printing
labels and the viewer. Price sorting uses the resolved product prices.

Seven focused regression cases passed, including the actual failure pattern:
placeholder rows plus multiple products sharing a rarity, zero-price photos,
identity invalidation, and preserving a verified image during failed recheck.
A live replay of 21 catalogue rows from the screenshot's expansion resolved
21 product versions without a missing image mapping. All 21 image URLs then
returned valid JPEG data. Receipts are in tmp/signal-image-repair-proof.json
outside the repo. No full test suite or GitHub workflow was run.
The production build completed and the updated web bundle was installed
on the phone. The in-app visual check remains with George.

## Session log — 2026-10-04 browse tile prices

Browse Cards had price-sort controls but omitted prices from its tiles.
Every game now shows the existing card price directly below its name, using
the same price field as the browse results. Missing prices read Price
unavailable. Rarity, artwork and card number remain below the price.
Accessible card labels include the price. No new data request or test suite
was added for this display change.
Production build completed and the phone web bundle was updated.

## Session log — 2026-10-04 Pokémon browse price loading

The latest TCGdex Pokémon expansion supplied generated Normal variants with
no pricing or marketplace IDs. Product verification stopped when those IDs
were absent, so the browser could not reach prices that TCGplayer actually
held. Added bounded marketplace discovery with name, set and printed-number
validation followed by full product/finish validation. Generated placeholders
are replaced by source-proven English finishes; confirmed user-selected
finishes are never silently exchanged. Normal/Reverse products use their
separate English Near Mint SKU history when a finish price is missing, never
a combined headline price. Existing valid older catalogue prices are kept.

The browser expands discovered finishes, re-sorts by the resolved prices,
updates an open viewer when its single placeholder finish is resolved, and
shows Loading price while enrichment runs. Legacy records can reload missing
variant context. TCGplayer set prefixes are learned from retrieved records
for subsequent scoped searches. Server search records now preserve game
metadata and the catalogue allow-list supports exact product-details URLs.

Validation: the current 21-card Pokémon browse batch went from zero priced
rows to 21 matched, priced rows. Meowth 144/128 resolved to product 714358,
Holo, $9.806 at lookup time. Common Exeggcute and Ultra Ball also resolved to
their actual Holo products and prices. Fifteen focused old/new Pokémon tests
passed, protecting stamps, special patterns, finish prices, wrong-set/number
rejection, discovery without IDs and the product-details relay contract.

A browser-access hypothesis was corrected: the Android shell already has
CapacitorHttp enabled and uses native requests. A forced relay-only live probe
failed because TCGplayer rejected the cloud-server origin; this is not proof
of phone failure. Direct native-equivalent source calls succeeded. The relay
is optional fallback, not the confirmed fix for this incident. The gateway
deployment returned ACTIVE at 2026-10-04T23:27:23.807125258Z. No full suite or
GitHub workflow was run.
The final production build completed and its web bundle was installed on
the phone. The in-app visual check remains with George.

## Session log — 2026-10-04 clear collection selection

The four collection tiles had almost identical borders and backgrounds, so
the selected binder was hard to identify. The selected tile now has a solid
light-gold fill, dark title/count text, and a persistent checkmark. Unselected
tiles keep a quieter border. The existing aria-selected state drives both
the style and marker for All cards, Pokémon, Yu-Gi-Oh! and MTG. Production
build completed; no test suite was run for this display-only change.
The new web bundle was installed on the phone.

## Session log — 2026-10-04 collection highlight refinement

Removed the corner checkmark and its reserved title space at George's
request. The gold fill and dark text remain the selected-state cues.
Production build completed and the phone bundle was updated.

## Session log — 2026-10-04 card viewer corner clipping

The Salamence screenshot showed white JPEG corners and black space inside
a taller rounded frame. The viewer previously fixed its height to the stage
while limiting width, so object-fit placed the photo inside that larger box
and the rounded mask did not reach the actual photo corners. The card frame
now uses the loaded image's natural aspect ratio and fits both stage axes.
A proportional rounded mask clips the photo itself while keeping the full
card face. This applies to every CardLightbox caller and resizes with the
viewport. Production build completed; no test suite was run for this visual
layout change.
The new web bundle was installed on the phone.
