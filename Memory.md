# Current State

Current phase: Phase 1 — complete + real-world hardened

Current milestone: A user-invoked main-frame session can romanize eligible
Japanese text on a static page locally, preserve mixed and excluded content,
and restore still-owned text exactly. Phase 2 is ready but has not started.

Last verified working state: The packaged MV3 extension runs offline in
Chromium 151, receives an action-granted `activeTab`, injects one isolated-world
controller, processes the static article fixture through Lindera/IPADIC, leaves
unsafe regions untouched, preserves node identity and handlers, restores exact
source strings, and releases the processor after the final tracked session.

# Completed

- Completed the Phase 0 TypeScript/Vite/Vitest/Playwright/ESLint foundation,
  accepted Lindera 5.3.0, IPADIC 5.3.0, and WanaKana 5.3.1, and retained the
  evidence-backed at-most-180 MiB loaded-processor exception.
- Added typed page/content start, stop, and status commands with validation at
  both runtime boundaries.
- Added programmatic main-frame injection of a self-contained content IIFE;
  reinjection reuses one controller and listener.
- Implemented the Original, Inspecting, Starting, Active, Degraded, and
  Stopping frame states with session-epoch invalidation.
- Added conservative Kana/Han evidence, inherited `lang` handling, structural
  and semantic exclusions, native visibility checks, and a yielding
  `TreeWalker` scanner.
- Added a version-namespaced 256-entry frame LRU, in-flight coalescing, and
  protocol-aware 100-item/20,000-UTF-16 request partitioning.
- Added WeakMap node state plus an iterable active set. Replace mode assigns
  only `Text.data`, never parent elements or HTML.
- Added exact ownership-aware restoration: a newer page-authored value is never
  overwritten, and stopping during an in-flight request prevents late writes.
- Added session storage bookkeeping so tab stop, closure, or navigation removes
  the active-session reference and releases the processor when none remain.
- Fixed a discovered mixed-input stall by passing only supported Japanese runs
  to Lindera and emitting source-aligned passthrough segments for Latin text,
  numbers, whitespace, punctuation, emoji, and other unsupported content.
- Hardened analyzer runs to include only adjacent numeric context, preserving
  Arabic digits while restoring counter readings such as `1928 nen`, `2 gatsu`,
  and `490 nin`.
- Added a source-based extended-Katakana policy (`fa`, `fi`, `fo`, `wi`, `di`),
  contiguous unknown-Han compound protection, and reversible inline-boundary
  spaces for adjacent BTB-owned fragments.
- Replaced the Phase 0 diagnostic popup with minimal Romanize/Show original
  controls and user-facing original, loading, active, partial, unsupported,
  restricted, and retryable states.

# Architecture Decisions

- Static Phase 1 targets the current tab's main frame only after an explicit
  extension action. There is no persistent `<all_urls>` access or static
  manifest content script.
- Han-only text requires inherited Japanese `lang` evidence; Kana is direct
  Japanese evidence. Script detection does not claim that every Han string is
  Japanese.
- Lindera receives only Japanese script runs and adjacent Japanese punctuation.
  Adjacent numeric context is additionally allowed for morphology; unsupported
  spans stay byte-for-byte equivalent at the JavaScript string level and remain
  source aligned.
- Unknown Han compounds are protected as a contiguous lexical boundary when any
  segment is unresolved. Named-entity observations remain a separate quality
  corpus rather than deterministic production rules.
- Replace-mode boundary spacing is added only between adjacent BTB-owned text
  nodes with ASCII word edges inside an inline layout boundary; it is stored in
  node ownership state and disappears on restore.
- The frame cache key namespace includes language, Lindera, IPADIC,
  romanization-policy, and spacing-policy versions. Page-derived entries remain
  in memory and clear on stop.
- Page ownership is optimistic and reversible: a result applies only to the
  same connected node, source, revision, and session epoch. Current page data
  wins every conflict.
- Phase 1 does not install a `MutationObserver`; dynamic updates are Phase 2.

# Final Measurements

Reference: Linux x64, packaged Chromium 151.0.7922.34, offline.

Phase 1 static 5,000-node fixture, with the Japanese processor pre-warmed and
diagnostic garbage collection at both renderer baselines:

- eligible and processed text nodes: 5,000 / 5,000;
- retained renderer growth: 3.4 MiB against the 20 MiB page-side budget;
- total Chromium PSS movement: 20.6 MiB (aggregate process movement, not the
  page-side retained budget);
- observed page long tasks over 50 ms: zero;
- exact first-node restoration after stop: passed.

Phase 0 retained processor reference remains:

- steady incremental PSS: 158.5–160.4 MiB;
- peak incremental PSS: 159.7–171.7 MiB;
- post-unload incremental PSS: 14.9–16.5 MiB;
- reclaimed by unload: 143.5–143.9 MiB;
- compressed package: 11,204,207 bytes at the Phase 0 gate.

# Important Files

- `src/content/bootstrap.ts`: idempotent isolated-world entry and command
  listener.
- `src/content/controller.ts`: static session states, stale guards, writes, and
  restoration.
- `src/content/scanner.ts`, `scheduler.ts`: eligibility and bounded collection.
- `src/content/engine-client.ts`: cache, coalescing, and bounded local batches.
- `src/content/node-state.ts`: source/revision/renderer ownership.
- `src/detector/`: script and language evidence.
- `src/renderers/replace.ts`: `Text.data`-only renderer.
- `src/renderers/replace.ts`: `Text.data`-only renderer and conservative inline
  boundary-spacing pass.
- `src/engines/japanese/lindera-adapter.ts`: safe Japanese-run tokenization and
  mixed-span stitching.
- `src/background/service-worker.ts`: injection, page commands, session
  bookkeeping, and processor lifecycle.
- `tests/integration/static-dom.spec.ts`: packaged static article, offline,
  restoration, and 5,000-node performance gates.
- `tests/fixtures/pages/hardening-article.html`: realistic counters, loanwords,
  inline links, punctuation, and unknown-compound fixture.

# Known Issues

- Static sessions do not observe text changes or added nodes. A page write after
  rendering wins and remains untouched until Phase 2 can classify and process
  it as a new revision.
- Main-frame document text only is supported. Iframes and open Shadow DOM remain
  later work; closed roots and unauthorized cross-origin frames remain out of
  scope.
- Initial visibility checks do not observe later class/style changes. Phase 2
  will evaluate only a narrow attribute strategy from measurements.
- IPADIC can misread names, slang, and creative orthography. Unknown Han remains
  original rather than receiving a fabricated reading.
- Headless Chromium's action trigger grants `activeTab` but does not expose the
  toolbar popup as a Playwright page. The packaged popup layout is therefore
  inspected separately while browser integration drives the same compiled
  content command route from an extension control page.

# Current TODO

- Begin Phase 2 only when explicitly requested: install mutation observation
  before the initial scan and process only added subtrees and changed text
  nodes through bounded deduplicated drains.
- Add expected-render mutation ownership, same-node framework overwrite,
  replacement-node, removal cleanup, and mutation-stress gates.
- Preserve the Phase 1 static fixtures as regression gates; do not turn dynamic
  support into periodic full-page rescanning.

# Tests

Final release gates:

- `npm run test` — 14 Vitest files with 75 passing tests, including numeric
  context, Katakana, unknown-compound, and renderer-boundary regressions.
- `npm run verify` — dictionary provenance, TypeScript, ESLint, the 75 unit
  tests, both production bundles, and the distribution
  inventory all passed.
- `npm run test:integration` — all five packaged Chromium tests passed: the
  staged and five-run processor lifecycle, offline engine and mixed-text path,
  exact static DOM replacement/restoration, the realistic hardening fixture,
  and the 5,000-node page-side gate.
- Ad hoc real-page Chromium smoke: `https://ja.wikipedia.org/wiki/メインページ`
  reached `active` with 415 eligible/processed nodes and restored successfully;
  only metadata was logged.
- The packaged popup was visually inspected in Chromium at its production
  width with active-session status and restore controls.

# Environment / Commands

Install: `npm install`

Dev build: `npm run dev`

Build: `npm run build`

Test: `npm run verify && npm run test:integration`

# Notes for Next Agent

Phase 1 is complete. Do not add mutation handling to the static controller by
periodically rescanning the document. The next phase is Phase 2 — Dynamic DOM
Observation. Install the observer before the initial scan, preserve expected
renderer-write ownership, and process only affected nodes or added subtrees.
