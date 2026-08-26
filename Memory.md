# Current State

Current phase: Phase 2 — dynamic DOM observation complete

Current milestone: A user-invoked main-frame session can romanize eligible
Japanese text on a static page locally, preserve mixed and excluded content,
and restore still-owned text exactly while incrementally tracking dynamic DOM
changes. Phase 3 has not started.

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
  direct Hiragana romanization for phonetic continuity, contiguous unknown-Han
  compound protection, and reversible inline-boundary spaces for adjacent
  BTB-owned fragments or untouched Latin text within one owned node.
- Replaced the Phase 0 diagnostic popup with minimal Romanize/Show original
  controls and user-facing original, loading, active, partial, unsupported,
  restricted, and retryable states.
- Completed Phase 2 with a document-root `MutationObserver` installed before
  the initial scan. Character-data changes and added/removed roots feed a
  deduplicated scheduled drain; no periodic full-document rescan is used.
- Added node-specific expected-render filtering, revision updates for page
  overwrites, replacement/subtree discovery, detached-node cleanup, and latest
  page-authored source restoration.

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
- Kana-only Hiragana runs bypass morphology so `たかせがわ`, `にじょうえん`,
  `げんりゅうていえん`, and `なって` remain phonetic units rather than
  analyzer-token fragments. Katakana and Kanji retain their contextual paths.
- Render-only boundary spacing is added at safe ASCII/Japanese joins, including
  a preserved Latin prefix in the same BTB-owned text node; source text and
  ownership state remain exact and the spaces disappear on restore.
- The frame cache key namespace includes language, Lindera, IPADIC,
  romanization-policy, and spacing-policy versions. Page-derived entries remain
  in memory and clear on stop.
- Page ownership is optimistic and reversible: a result applies only to the
  same connected node, source, revision, and session epoch. Current page data
  wins every conflict.
- The observer watches only `childList`, `characterData`, and `subtree` on the
  main document. Class/style attributes, frames, and shadow roots remain out of
  scope.
- Dynamic drains reuse the Phase 1 scanner, engine client/cache/coalescing, and
  bounded write slices. Mutation records are discarded after classification;
  only current node/root identity sets remain queued.

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

Latest combined Phase 1/2 integration rerun measured 4.1 MiB retained renderer
growth, 22.2 MiB aggregate Chromium PSS movement, and zero long tasks; the
20 MiB page-side retained budget remains the applicable limit.

Phase 2 dynamic fixture:

- 1,000 added Japanese text nodes converged in 207 ms in the latest run;
- zero observed page long tasks over 50 ms;
- same-node, added-text, added-subtree, replacement, exclusion, rapid-source,
  self-write, stop-during-request, and detached-node cleanup gates passed.

Phase 0 retained processor reference remains:

- steady incremental PSS: 158.5–160.4 MiB;
- peak incremental PSS: 159.7–171.7 MiB;
- post-unload incremental PSS: 14.9–16.5 MiB;
- reclaimed by unload: 143.5–143.9 MiB;
- compressed package: 11,204,207 bytes at the Phase 0 gate.

# Important Files

- `src/content/bootstrap.ts`: idempotent isolated-world entry and command
  listener.
- `src/content/controller.ts`: session states, observer lifecycle, dynamic
  queue/drain, stale guards, writes, and restoration.
- `src/content/scanner.ts`, `scheduler.ts`: shared eligibility and bounded
  document/subtree collection.
- `src/content/engine-client.ts`: cache, coalescing, and bounded local batches.
- `src/content/node-state.ts`: source/revision/renderer ownership.
- `src/detector/`: script and language evidence.
- `src/renderers/replace.ts`: `Text.data`-only renderer and conservative inline
  boundary-spacing pass.
- `src/engines/japanese/lindera-adapter.ts`: safe Japanese-run tokenization and
  mixed-span stitching.
- `src/background/service-worker.ts`: injection, page commands, session
  bookkeeping, and processor lifecycle.
- `tests/integration/static-dom.spec.ts`: packaged static/dynamic articles,
  offline restoration, mutation stress, and 5,000-node performance gates.
- `tests/fixtures/pages/hardening-article.html`,
  `tests/fixtures/pages/dynamic-article.html`: realistic counters, loanwords,
  phonetic Kana examples, Latin boundaries, inline links, punctuation, and
  dynamic lyric/subtree/replacement fixtures.

# Known Issues

- Dynamic sessions do not observe class/style visibility changes; text and
  subtree mutations are observed incrementally.
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

- Keep Phase 2 live behavior bounded while gathering broader real-site evidence.
- Do not add Phase 3 remembered-site permissions or new popup UX in this phase.

# Tests

Final release gates:

- `npm run test` — 14 Vitest files with 93 passing tests, including dynamic
  same-node, subtree, replacement, self-write, stop, and cleanup regressions.
- `npm run verify` — dictionary provenance, TypeScript, ESLint, the 93 unit
  tests, both production bundles, and the distribution
  inventory all passed.
- `npm run test:integration` — all six packaged Chromium tests passed: the
  staged and five-run processor lifecycle, offline engine and mixed-text path,
  exact static DOM replacement/restoration, the realistic hardening fixture,
  the Phase 2 dynamic/stress fixture, and the 5,000-node page-side gate.
- Ad hoc real-page Chromium smoke: `https://ja.wikipedia.org/wiki/メインページ`
  reached `active` with 403 eligible/processed nodes, restored successfully,
  and made zero extension/background uploads after activation; only metadata
  and bounded sample-hit counts were logged.
- The packaged popup was visually inspected in Chromium at its production
  width with active-session status and restore controls.

# Environment / Commands

Install: `npm install`

Dev build: `npm run dev`

Build: `npm run build`

Test: `npm run verify && npm run test:integration`

# Notes for Next Agent

Phase 2 is complete. Do not add periodic rescans, attribute observation, site
selectors, or Phase 3 persistence. The next phase is Phase 3 — Controls,
remembered sites, and MVP completion.
