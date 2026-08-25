# Current State

Current phase: Phase 0 — complete

Current milestone: The local Japanese engine, package, bounded batch route,
memory exception, and lazy lifecycle are accepted. Phase 1 is ready but has not
started.

Last verified working state: The packaged MV3 extension runs offline in
Chromium 151, lazily creates one offscreen document and Japanese worker, loads
Lindera/IPADIC, returns all seven dictionary-backed golden results through the
public batch route, rejects oversized input, releases the processor, reclaims
the majority of its PSS, and recreates it cleanly.

# Completed

- Built the strict TypeScript/Vite/Vitest/Playwright/ESLint MV3 foundation with
  reviewed permissions, no active Python, and an inert V1 archive.
- Packaged checksum-pinned Lindera WASM 5.3.0, IPADIC 5.3.0, and WanaKana 5.3.1
  with complete provenance and notices.
- Added the versioned Japanese adapter, ASCII Hepburn and spacing policies,
  source-aligned segments, UTF-8-to-UTF-16 offset handling, particle
  pronunciation, and unknown-Han preservation.
- Added deeply validated public/internal batch messages, named size ceilings, a
  15-second timeout, safe errors, request/result correlation, and exactly one
  retry after worker failure.
- Rejected Kuroshiro/Kuromoji after an isolated comparison: its normal/spaced
  modes matched only 2/7 and 1/7 dictionary cases and used 190.8 MiB steady PSS.
- Added staged PSS diagnostics and an explicit `processor.release` lifecycle
  that closes the offscreen document, terminates the worker, and supports clean
  recreation.
- Completed five final retained lifecycle runs and accepted the documented
  loaded-processor memory exception.

# Architecture Decisions

- Lindera 5.3.0 plus IPADIC 5.3.0 is the accepted contextual Japanese engine;
  WanaKana 5.3.1 remains isolated behind `ascii-hepburn-v1`.
- The original less-than-150 MiB loaded-memory target failed. Phase 0 accepts
  at most 180 MiB incremental Linux PSS for the loaded processor on the
  Chromium 151/Linux x64 reference environment.
- The Japanese processor remains lazy and releasable. Its allowance is separate
  from Phase 1's at-most-20 MiB persistent page-side budget for DOM state,
  caches, and queues on the representative fixture.
- Vite uses relative extension asset URLs and ES-module workers because the
  Lindera bundler WASM uses top-level `await`.
- Message creators copy fields explicitly so inner envelopes cannot overwrite
  outer protocol discriminants.

# Final Measurements

Reference: Linux x64, packaged Chromium 151.0.7922.34, offline. Memory is the
sum of active Chromium process Linux PSS from `/proc/<pid>/smaps_rollup`, with
each run compared to its own stabilized pre-processor baseline.

Five retained runs:

- baseline PSS: 337.9–340.5 MiB;
- cold readiness: 375.9–465.5 ms, median 393.5 ms;
- warm 100 strings: 11.1–53.7 ms, median 14.5 ms;
- peak incremental PSS: 159.7–171.7 MiB, median 160.1 MiB;
- steady incremental PSS: 158.5–160.4 MiB, median 159.7 MiB;
- post-unload incremental PSS: 14.9–16.5 MiB, median 16.2 MiB;
- PSS reclaimed by unload: 143.5–143.9 MiB.

Staged diagnostic increments:

- worker created 6.9 MiB; WASM initialized 17.3 MiB;
- dictionary files fetched 64.8 MiB; dictionary constructed 157.6 MiB;
- tokenizer constructed 159.7 MiB; JS file references cleared 160.5 MiB;
- batch completed 163.0 MiB; stabilized loaded 163.1 MiB;
- stabilized after worker/offscreen destruction 19.8 MiB.

The generated Lindera glue copies all 47.5 MiB of input `Uint8Array` data into
WASM memory, producing a temporary duplication window. The bounded experiment
clears all nine JavaScript file references immediately after tokenizer
construction. Active PSS does not fall, so this does not change the retained
WASM dictionary floor. Total PSS cannot identify the exact V8 collection point.

Package: 49,492,819 bytes unpacked and 11,204,207 bytes with `zip -9`, below
the 25 MiB compressed target.

# Important Files

- `src/background/service-worker.ts`: validated coordinator, diagnostic, and
  release boundary.
- `src/processor/`: offscreen host, lifecycle, and staged Japanese worker.
- `src/shared/`: protocol, validation, safe errors, and named limits.
- `src/engines/japanese/`: accepted Japanese adapter and output policies.
- `tests/integration/memory-lifecycle.spec.ts`: staged and five-run PSS gate.
- `tests/integration/processor.spec.ts`: offline batch and popup acceptance.
- `scripts/verify-dist.mjs`: permission, CSP, packaging, remote-code, and
  zero-Python boundary verifier.

# Known Issues

- The original less-than-150 MiB target remains a recorded failure; the accepted
  initial budget is at most 180 MiB while loaded.
- Total Chromium PSS cannot distinguish V8 heap collection from reserved WASM
  pages; stage interpretation is limited to observed process-level changes.
- IPADIC can misread names, slang, and creative orthography. Names remain a
  separate quality category and unknown Han stays original.
- A production idle timeout/refcount policy belongs to Phase 1 session
  lifecycle; Phase 0 proves the safe release/recreate capability only.

# Current TODO

- Begin Phase 1 only when explicitly requested: static Japanese DOM
  transliteration with bounded scanning and exact restoration.
- Enforce the separate 20 MiB persistent page-side regression budget on the
  agreed Phase 1 fixture.

# Tests

Passing:

- `npm run verify` — asset verification, typecheck, lint, 41 Vitest tests,
  production build, and distribution verifier.
- `npm run test:integration` — two offline Chromium tests covering staged
  memory, five fresh retained runs, unload/recreate, golden public batches,
  oversized rejection, popup readiness, and latency budgets.
- Package measurement — `verify:dist` plus a fresh `zip -9` archive.
- Rendered Chromium popup inspection — ready state, local-only explanation,
  primary control, typography, contrast, and intended 320 px content width
  visually checked from `/tmp/btb-phase0-popup.png`.

Not run:

- Interactive headful toolbar-popup check; the environment was verified through
  the packaged headless Chromium extension, semantic assertions, and manual
  inspection of its rendered screenshot instead.

# Environment / Commands

Install: `npm install`

Dev: `npm run dev`

Build: `npm run build`

Test: `npm run verify && npm run test:integration`

# Notes for Next Agent

Phase 0 is complete. Do not redo the engine spike or alter the accepted budget
without new evidence. The next phase is Phase 1 — Static Japanese DOM
Transliteration. Do not pull MutationObserver, site persistence, OCR, Lens, or
Spotlight forward.
