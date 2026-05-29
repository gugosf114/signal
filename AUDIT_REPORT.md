# Signal — Comprehensive Code Audit

_Date: 2026-05-29 · Scope: full codebase (~6,500 LOC, src/ + android/) · Read-only, no changes applied._

Five-layer audit: correctness bug-hunt, security/secrets, README-constraint compliance,
UX-pass verification, build/runtime health. Findings are prioritized by severity with
`file:line → issue → fix sketch`. **Nothing was committed or modified.**

---

## BLOCKERS — fix before any real-device / public test

### B1 · Anthropic API key ships to the browser (and into the APK)
`src/services/analyzeCard.js:99,154,156`
The key is read from `VITE_ANTHROPIC_API_KEY` and sent client-side with the
`anthropic-dangerous-direct-browser-access: true` header. Vite inlines every `VITE_*`
value into the production bundle, so the **full secret key is extractable** from devtools
or the Android APK. At ~$0.30–0.90/scan with web_search, abuse bills directly to the
account; the per-user "10 scans" limit is bypassed entirely.
**Fix:** move the call behind a server proxy (the app already references `VITE_PROXY_URL`
in `UserAuth.jsx:50`). Client calls `POST {proxy}/api/analyze`; key lives only server-side.
**Rotate the current key now** — assume it's burned if any build/APK shipped.

---

## HIGH

### H1 · All paid TCG / RSS API keys also inlined client-side
`src/services/fetchTCGPrice.js:193-196` (`VITE_TCGAPI_DEV_KEY`, `VITE_TCGPL_KEY`,
`VITE_TCGAPIS_KEY`, `VITE_JUSTTCG_KEY`), `src/services/fetchTCGNews.js:48` (`VITE_RSS2JSON_KEY`).
Same exposure mechanism as B1; several are commercial-tier keys. The rss2json key in a
query string also leaks via referrer/proxy logs.
**Fix:** proxy these server-side too; never expose paid keys as `VITE_*`.

### H2 · Unvalidated `href` scheme → javascript:/data: injection
`src/components/SourceCitation.jsx:292` (`href={source.url}` from LLM output),
`src/components/NewsStrip.jsx:48` (`href={article.link}` from third-party RSS).
No protocol allowlist. A `javascript:`/`data:` URL renders as a one-click link; in the
Capacitor WebView it can reach native bridges. The hallucination filter checks host/path,
not scheme, and doesn't cover article links.
**Fix:** parse with `new URL()` and render only if protocol is `http:`/`https:`.

### H3 · Partial/truncated scans inflate the 0–100 score (and pollute history)
`src/config/signals.js:153-170` (`calculateOverallScore`)
Score = weightedSum ÷ **present-weight only**. When the `_truncated` path returns < 9
signals, missing signals don't count as 0 — they vanish from the denominator, so a card
returning only its 3 strongest signals scores near-perfect. These inflated scores are then
written to `signal_score_history` and drive the percentile feature.
**Fix:** divide by the full `WEIGHTS[game]` sum (absent signals → 0), or refuse/caveat the
score when `signals.length < 9`.

### H4 · CardBrowser search has no stale-response guard (race)
`src/components/CardBrowser.jsx:86-103`
Debounced `load()` and the `activeGame` effect fire requests with no sequence token /
AbortController. A slow earlier request can resolve last and paint stale results for the
wrong query/tab.
**Fix:** per-call request id or AbortController; ignore non-latest resolutions.

---

## MEDIUM

### M1 · New dependencies contradict the README's stated constraints
`package.json:13-17` — `@supabase/supabase-js`, `@capacitor/*`, `@capgo/capacitor-social-login`
all added, but the README "Constraints" block still says *"No new dependencies beyond Vite,
React, simple-icons."* Sanctioned by the 2026-05-23 session log, but the constraint was never
reconciled — the README contradicts itself.
**Fix:** update the Constraints section to whitelist these (or back them out).

### M2 · Monetization/quota scaffolding vs "No monetization scaffolding"
`src/components/UserProfileModal.jsx:76-93`, `src/components/UserAuth.jsx:20,148`
"Current Plan / Free Beta", "Scans Remaining N/10" progress bar, "N SCANS LEFT" chip, and a
`/api/user/scans` monthly-quota decrement. This is exactly the monetization runway the
constraint forbids.
**Fix:** drop the plan/quota framing or explicitly sanction it in the README.

### M3 · Hardcoded private-LAN proxy default left in source
`src/components/UserAuth.jsx:50` — `VITE_PROXY_URL || 'http://192.168.1.65:3001'`.
If unset at build, prod calls a private IP over plaintext HTTP with `?userId=`. Dev artifact;
leaks internal topology, spoofable on hostile networks.
**Fix:** remove the LAN default; fail closed and require HTTPS.

### M4 · NewsStrip fetch effect has no cleanup (state-after-unmount)
`src/components/NewsStrip.jsx:160-169`
`fetchTCGNews().then(...)` and the async fallback loop have no cancelled guard. NewsStrip
unmounts the moment a scan starts, so setters can fire after unmount.
**Fix:** add a `cancelled` flag checked before each setState.

### M5 · Supabase anon key relies on unverifiable RLS
`src/components/UserAuth.jsx:7-9,91`
Anon key in the bundle is fine **only if** Row-Level Security is enforced on every table.
No SQL/policy in the repo to confirm. If RLS is off/permissive, the public key grants direct
read/write to user data.
**Fix:** confirm owner-scoped RLS on all tables (backend, out of repo scope). Never ship the
service_role key as `VITE_*`.

### M6 · L4 (header logo tighten) claimed DONE in UX report but NOT in code
`src/components/SignalDashboard.jsx:64-88`
`UX_PASS_REPORT.md` claims a single horizontal flex header with reduced padding/fonts. Code
still has the old centered stacked column, badge padding `9px 22px 9px 16px`, 株 26px /
Signal 22px. The restructure never landed — report is ahead of the code.
**Fix:** either implement L4 or correct the report.

### M7 · Solari flip animation freezes on repeated loop phases
`src/components/LoadingTheater.jsx:387`
`t0 = useMemo(..., [text])`. Once phases loop (`[4,5,7]`), repeated identical titles don't
change `text`, so `t0` never recomputes and letters stay "locked" with no re-flip.
**Fix:** key the animation on `phase.id` + phase-instance counter (e.g. `rawIdx`), not title text.

---

## LOW

- **L-a · ⛩ emoji in UI text** — `signals.js:7` (Japan section label), `LoadingTheater.jsx:182`
  (ticker). Technically violates "no emoji" aesthetic rule; borderline (reads as JP decoration).
  Decide if sanctioned.
- **L-b · enhanced-price merge drops `gradedLines`** — `analyzeCard.js:113-120`. PSA-10 data
  returned by the price lookup is never merged or rendered (dead data); jp/trend overlay is
  asymmetric vs priceLines fallback.
- **L-c · YouTube hallucination filter can over-drop real videos** — `analyzeCard.js:301-308`.
  Conservative-by-design; only act if source counts come back suspiciously empty.
- **L-d · `change_30d` formatting** — `fetchTCGPrice.js:109`. Non-numeric string throws (silently
  nukes enhanced result via `.catch`); `change_30d === 0` (flat) renders no trend. Coerce with
  `Number()` / `Number.isFinite`.
- **L-e · Mock seed identity** — `UserAuth.jsx:69-71` ships demo `alex.investor@signal.app` PII-shaped data.
- **L-f · Percentile coarse for ties/small samples** — `OverallScore.jsx:36-41`. Vanity metric.
- **L-g · News dedupe by title only** — `fetchTCGNews.js:80`. Distinct articles sharing a title drop the second.
- **L-h · RSS image URL unvalidated** — resource-load/tracking-pixel concern only (not XSS; React builds the `<img>`).

---

## Verified CLEAN / intact (no action)
- **No secrets in tree or git history**; `.env*` correctly gitignored; `android/` has no
  manifest/gradle/google-services.json/keystore committed. OAuth *client ID* (not a secret)
  comes from env with a placeholder default.
- **No analytics/telemetry, no TypeScript, no `dangerouslySetInnerHTML`/`eval`/`innerHTML`** anywhere.
- **All 8 audit fixes from `893429f` intact** (hallucination filter, CardImage cancelled-flag race,
  fetchCardImage 404-vs-5xx, PARTIAL chip, PhasePips clamp, brandFromUrl null, SignalSection auto-fit,
  JP clock Asia/Tokyo).
- **Aesthetic lock holds**: typography (Instrument Serif / Syne / JetBrains Mono / Noto Sans JP),
  palette (#08090A / #C44040 / muted graduation), 株 logomark, "Not financial advice" disclaimer.
- **UX pass largely landed**: clusters C, H, M implemented and consistent with the report;
  exceptions are M6/L4 above; L6 (ComparisonView) and L7 (score-contribution tap) correctly
  disclosed as not shipped.

---

## Top recommendation
The single highest-value fix is **standing up the referenced proxy backend** and moving the
Anthropic + paid-TCG keys behind it (resolves B1, H1, and de-risks M3/M5), then **rotating the
Anthropic key**. That, plus H3 (score inflation) and H2 (URL scheme validation), is the
must-do list before letting real users — or a real-device build — loose.

_Build/runtime-health layer: pending (agent still running); findings will be appended._
