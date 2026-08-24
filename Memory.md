# Current State

Current phase: Phase 0 — in progress

Current milestone: Checksum-pinned IPADIC tokenizer spike with real package,
latency, corpus, and memory measurements.

Last verified working state: The built MV3 extension loads in Playwright's
Chromium 151, opens its popup, creates one offscreen document, starts a module
worker while offline, loads all nine packaged Lindera IPADIC 5.3.0 files,
executes the dictionary-backed golden smoke cases, benchmarks a warm batch, and
reports ready without reading or changing a webpage.

# Completed

- Pinned npm/TypeScript/Vite/Vitest/Playwright/ESLint foundation and lockfile.
- Added the Phase 0 manifest with reviewed permissions and no persistent host
  access or content script.
- Added typed runtime/worker messages, boundary validation, safe errors, and a
  narrow offscreen browser adapter.
- Added popup → service worker → offscreen document → Japanese worker flow.
- Packaged Lindera WASM and WanaKana behind a versioned ASCII-Hepburn adapter.
- Added the initial golden corpus and executed its Kana-supported control.
- Added third-party MIT notices and a distribution boundary verifier.
- Added automated offline Chromium coverage for the real worker handshake.
- Added the official IPADIC 5.3.0 archive, published checksum, per-file
  verification, exact format/schema checks, and required redistribution notice.
- Added the production Japanese adapter with source-aligned segments,
  byte-to-UTF-16 mapping, unknown-Han preservation, particle pronunciation, and
  versioned spacing.
- Executed all dictionary-backed corpus entries against real Lindera WASM.
- Recorded package, cold/warm latency, and Linux PSS measurements.

# Architecture Decisions

- Vite uses `base: "./"` so extension worker/WASM assets resolve relative to
  `chrome-extension://` contexts.
- Vite workers use ES module output because Lindera's bundler WASM uses
  top-level `await`.
- Heavy Lindera initialization is lazy inside the reusable Japanese worker.
- Message-envelope creators copy payload fields explicitly so nested worker
  discriminants cannot overwrite outer runtime-message discriminants.
- Lexical tokens prefer IPADIC's orthographic reading; grammatical particles
  prefer pronunciation. This preserves `toukyou` while producing `wa`, `e`,
  and `o` where IPADIC supplies reliable particle context.

# Important Files

- `manifest.json`: active Phase 0 MV3 manifest.
- `src/background/service-worker.ts`: validated coordinator boundary.
- `src/processor/`: offscreen host and Japanese worker.
- `src/shared/`: protocol, validation, safe errors, and named limits.
- `src/engines/japanese/ascii-hepburn.ts`: WanaKana policy adapter.
- `scripts/verify-dist.mjs`: permissions, CSP, packaging, remote-code, and
  zero-Python checks.
- `tests/corpus/japanese/golden.json`: authoritative Japanese output cases.

# Known Issues

- Kuroshiro/Kuromoji comparison is not run.
- The final measured 162.6 MiB incremental Linux PSS exceeds the 150 MiB
  Japanese processing target by 12.6 MiB. Repeated runs observed
  159.2–162.6 MiB. No exception is approved, so Lindera is not yet
  a Phase 0 go.
- The worker currently exposes the readiness/self-test path; the bounded public
  batch message path remains for the next implementation slice.

# Current TODO

- Compare Kuroshiro/Kuromoji against the same corpus and measure its browser
  package/memory behavior without making it a production dependency.
- Profile Lindera's 159.2–162.6 MiB PSS and test whether buffer-lifetime or loading
  changes can bring it below 150 MiB.
- Add the bounded processor batch message path and crash/retry coverage.

# Tests

Passing:

- `npm run verify` — asset verification, typecheck, lint, 22 Vitest tests,
  production build, and
  distribution verifier.
- `npm run test:integration` — one offline unpacked-extension Chromium test for
  the popup/offscreen/Lindera worker flow, golden self-test, latency budgets,
  and Linux PSS measurement.
- `npm install` audit — 0 vulnerabilities reported for 178 installed packages.

Failing/not run:

- Phase 0 memory budget — measured but failing at 162.6 MiB versus 150 MiB in
  the final run.
- Kuroshiro/Kuromoji comparison — not run.
- Manual Chrome UI check — not run; automated Chromium integration passed.

# Environment / Commands

Install: `npm install`

Dev: `npm run dev`

Build: `npm run build`

Test: `npm run verify && npm run test:integration`

# Notes for Next Agent

Stay in Phase 0. Do not add DOM scanning, content injection, OCR, Python, a
server, native messaging, or runtime downloads. The next risk is the official
IPADIC artifact and its exact v5.3.0 file schema, checksum, license, browser
loading behavior, and memory cost.
