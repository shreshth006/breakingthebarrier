# Current State

Current phase: Phase 0 — in progress

Current milestone: A checksum-pinned IPADIC tokenizer and bounded production
batch pipeline with real package, latency, corpus, fallback, and memory
measurements.

Last verified working state: The built MV3 extension loads in Playwright's
Chromium 151, opens its popup, creates one offscreen document, starts a module
worker while offline, loads all nine packaged Lindera IPADIC 5.3.0 files,
executes all seven dictionary-backed golden cases through the public batch
route, rejects oversized input, benchmarks a warm batch, and reports ready
without reading or changing a webpage.

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
- Added a deeply validated public batch route with named size ceilings,
  request/result correlation, a 15-second timeout, and exactly one retry after
  worker failure.
- Explicitly release temporary Lindera token, metadata, and schema WASM handles.
- Benchmarked Kuroshiro 1.2.0 with its Kuromoji analyzer in an isolated Node and
  offline-browser spike without changing production dependencies.

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
- Kuroshiro/Kuromoji is rejected as the fallback because its two output modes
  matched only 2/7 and 1/7 dictionary-backed cases and its steady browser PSS
  was 190.8 MiB.

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

- Lindera's repeated 158.4–173.6 MiB incremental Linux PSS measurements exceed
  the 150 MiB Japanese processing target. Releasing temporary WASM wrappers did
  not remove the retained dictionary/WASM memory floor. No exception is
  approved, so Lindera is not yet a Phase 0 go.
- The measured Kuroshiro/Kuromoji fallback is worse: 190.8 MiB steady browser
  PSS and materially incorrect output under both built-in spacing modes.

# Current TODO

- Decide whether to approve a documented Lindera memory-budget exception or
  reopen the engine choice around another fully local implementation.
- If retaining Lindera, investigate deeper dictionary representation or WASM
  loading changes; temporary JavaScript/WASM wrapper cleanup was insufficient.

# Tests

Passing:

- `npm run verify` — asset verification, typecheck, lint, 38 Vitest tests,
  production build, and
  distribution verifier.
- `npm run test:integration` — one offline unpacked-extension Chromium test for
  the popup/offscreen/Lindera worker flow, seven-case public batch, invalid
  batch rejection, golden self-test, latency budgets, and Linux PSS measurement.
- `npm install` audit — 0 vulnerabilities reported for 178 installed packages.

Failing/not run:

- Phase 0 memory budget — measured but failing at 165.0 MiB versus 150 MiB in
  the latest passing run; retained runs ranged from 158.4 to 173.6 MiB.
- Manual Chrome UI check — not run; automated Chromium integration passed.

# Environment / Commands

Install: `npm install`

Dev: `npm run dev`

Build: `npm run build`

Test: `npm run verify && npm run test:integration`

# Notes for Next Agent

Stay in Phase 0. Do not add DOM scanning, content injection, OCR, Python, a
server, native messaging, or runtime downloads. The engine quality, packaging,
offline execution, and bounded batch path are proven; the remaining blocker is
an explicit memory-budget/engine decision.
