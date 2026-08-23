# Current State

Current phase: Phase 0 — in progress

Current milestone: Browser-native TypeScript foundation with a packaged local
processor handshake.

Last verified working state: The built MV3 extension loads in Playwright's
Chromium 151, opens its popup, creates one offscreen document, starts a module
worker while offline, initializes packaged Lindera WASM 5.3.0, runs the
WanaKana 5.3.1 Kana self-test, and reports ready without reading or changing a
webpage.

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

# Architecture Decisions

- Vite uses `base: "./"` so extension worker/WASM assets resolve relative to
  `chrome-extension://` contexts.
- Vite workers use ES module output because Lindera's bundler WASM uses
  top-level `await`.
- Heavy Lindera initialization is lazy inside the reusable Japanese worker.
- Message-envelope creators copy payload fields explicitly so nested worker
  discriminants cannot overwrite outer runtime-message discriminants.

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

- No IPADIC dictionary is acquired or packaged yet; Lindera tokenization is not
  implemented.
- Dictionary checksum/provenance and redistribution notices are still open.
- Dictionary-backed corpus cases, byte-to-UTF-16 mapping, IPADIC schema tests,
  spacing policy, and unknown-token behavior are not implemented.
- Kuroshiro/Kuromoji comparison is not run.
- Cold readiness, warm throughput, peak/steady memory, and final compressed
  dictionary/package measurements are not recorded on an agreed reference
  device.
- The full Phase 0 go/no-go decision is not made.

# Current TODO

- Pin and checksum the matching official IPADIC artifact using JavaScript-only
  tooling, package its required files, and load it from extension URLs.
- Implement the Lindera token adapter and execute the dictionary-required
  golden corpus.
- Add offset/schema/license tests and measure the Phase 0 budgets.

# Tests

Passing:

- `npm run verify` — typecheck, lint, 16 Vitest tests, production build, and
  distribution verifier.
- `npm run test:integration` — one offline unpacked-extension Chromium test for
  the popup/offscreen/Lindera worker flow.
- `npm install` audit — 0 vulnerabilities reported for 178 installed packages.

Failing/not run:

- Dictionary-backed Japanese quality tests — not runnable until IPADIC lands.
- Phase 0 package/latency/memory benchmarks — not run.
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
