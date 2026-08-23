# Breaking the Barrier — Engineering Rules

- **Document status:** Planning baseline 1.0
- **Last updated:** 2026-08-24
- **Applies to:** Human contributors and AI coding agents

These rules protect the product thesis, page safety, privacy, and the implementation boundaries in `Architecture.md`. “Must” and “must not” are release requirements. Exceptions require an explicit written decision with evidence and corresponding documentation changes.

## 1. Read before editing

Before making an implementation change, read the relevant parts of:

1. `PRD.md` for product scope and acceptance intent.
2. `Architecture.md` for context ownership, data flow, contracts, and decisions.
3. `Phases.md` for the current milestone and out-of-scope work.
4. `Design.md` for user-visible behavior.
5. `Memory.md` after it exists for the last verified working state.

Then inspect the current implementation and tests that are actually affected. Do not assume the plan is already implemented.

If these documents disagree:

- stop before making a broad architectural change;
- identify the exact contradiction;
- prefer the more specific, newer decision only when its status is clear;
- update all affected source-of-truth documents in the same change.

`Memory.md` never overrides `Architecture.md` or `PRD.md`.

## 2. Scope discipline

- Implement only the active phase or an explicitly requested fix.
- Do not silently add translation, accounts, cloud services, telemetry, analytics, subscriptions, AI/LLM features, or social features.
- Do not pull Lens, Spotlight, additional renderers, a second language, or Firefox work into the Live Mode MVP unless the phase plan is deliberately changed.
- Do not create site-specific scrapers while a generic DOM solution is viable.
- Do not treat Spotify, YouTube, or another site's private DOM as a stable API.
- Do not rename Breaking the Barrier.
- Do not delete the historical prototype. Phase 0 may move it with Git history into `legacy/prototype-2024/` and document it.
- If a requested change expands permissions, sends data off-device, changes the default renderer, or changes language correctness policy, update the decision records and obtain product approval.

## 3. General engineering

- Use strict TypeScript for product code.
- Prefer explicit domain types and discriminated unions over `any`, type assertions, stringly typed states, or boolean combinations.
- Do not use `any` without a narrow documented boundary and a follow-up validation step.
- Keep modules small and cohesive. Split a module when it owns unrelated lifecycle, browser, DOM, and language responsibilities.
- Keep browser API calls behind the platform/context module that owns them.
- Keep Lindera, WanaKana, Tesseract.js, and raw dictionary schemas behind adapters.
- Use pure functions for script analysis, evidence resolution, cache keys, preference migrations, geometry, and formatting wherever practical.
- Name configuration values. No unexplained timeouts, batch sizes, cache capacities, thresholds, pixel sizes, or retry counts.
- Comments must explain why, a browser quirk, an invariant, or a non-obvious trade-off. Do not narrate obvious syntax.
- Document externally observable behavior and non-obvious contracts.
- Preserve source offsets and exact strings; never use display normalization as a replacement source.
- Avoid clever metaprogramming, global mutable state, and hidden side effects.
- Do not leave dead code, commented-out implementations, or vague TODOs. A necessary TODO names the phase/issue, required evidence, and blocking condition.
- Do not perform a huge refactor during an unrelated feature or bug fix.

## 4. Browser extension rules

- Respect Manifest V3 and the selected minimum Chromium version.
- Required permissions must remain limited to capabilities used by the active implementation.
- Do not add persistent `<all_urls>` host permission.
- Declare broad HTTP(S) patterns only under `optional_host_permissions`, then request the concrete current origin in a user gesture.
- Do not add `tabs` simply to call methods that do not require the `tabs` permission.
- Do not add cookies, history, webRequest, debugger, nativeMessaging, clipboard, camera, microphone, or other permissions without a reviewed product requirement and decision record.
- Bundle all executable JavaScript and WASM. Never load executable code from a CDN or remote URL.
- Bundle required dictionaries and OCR models for release. No silent runtime model download or remote fallback.
- Keep the extension page CSP at the minimum needed. `wasm-unsafe-eval` is allowed only because the selected local engine requires WASM; ordinary `eval`, `new Function`, and inline scripts remain forbidden.
- Register service-worker event listeners synchronously at module evaluation.
- Never rely on a service-worker global surviving suspension.
- Make content injection and processor creation idempotent.
- Run content scripts in the isolated world. Main-world injection requires a new, reviewed decision.
- Do not monkey-patch page DOM APIs, framework internals, history APIs, or `attachShadow` in the MVP.
- Extension-owned page UI must have a stable host marker and must be excluded by the scanner.
- Do not expose extension assets as web-accessible resources unless the page genuinely needs them. Document every exposed resource.
- Handle restricted URLs, missing permissions, tab closure, frame navigation, and extension reload as ordinary states.

## 5. DOM safety rules

These rules are non-negotiable.

- The webpage is the source of truth.
- Never assign page-derived content through `innerHTML`, `outerHTML`, or HTML parsing.
- Never replace a parent element merely to change visible text.
- The MVP Replace renderer may assign only eligible `Text.data` values.
- Every transformation must record the latest page-authored source, the rendered value, a revision, and session ownership before writing.
- Every asynchronous apply must revalidate session epoch, node revision, connectivity, and current value.
- Restoration may write the stored source only when the current value is still the extension-owned rendered value.
- If the page has written a newer value, leave it untouched and clear extension ownership.
- Install observation before the initial scan so mutations during scanning are not lost.
- Do not disconnect the observer around every extension write.
- Prevent self-triggered loops with expected rendered values and revision checks.
- Never rescan the entire document for each mutation.
- Batch and deduplicate affected nodes and added subtrees.
- A mutation callback collects and schedules; it does not tokenize, call OCR, or perform large scans synchronously.
- Keep DOM reads and writes in separate bounded stages.
- Do not perform a layout read for every text node.
- Skip whitespace-only and unsupported-script nodes before expensive checks.
- Do not intentionally modify `SCRIPT`, `STYLE`, `NOSCRIPT`, `TEMPLATE`, `CODE`, `PRE`, `KBD`, `SAMP`, form controls, contenteditable, SVG, MathML, extension UI, or marked ignore regions in the MVP.
- Do not rewrite ARIA labels or author attributes in the MVP.
- Do not assume static HTML or stable node identity.
- Clean removed/disconnected nodes out of iterable ownership sets so WeakMap use is not defeated by a strong-reference leak.
- A frame or Shadow root owns its own scanner, observer, and restoration state.
- Closed Shadow DOM and unauthorized cross-origin frames remain untouched.

## 6. Language and transliteration rules

- Never call core behavior translation in code, UI, tests, or documentation.
- Script detection and language selection are separate concerns.
- Never infer that all Han text is Japanese.
- Respect explicit language settings and `lang` evidence before document heuristics.
- Preserve unsupported runs exactly.
- Japanese Kanji readings require contextual tokenization. Do not add per-character Kanji substitution as a fallback.
- An unknown Han-bearing token without a reliable reading stays original and produces a structured internal warning.
- Do not expose an invented numeric language or reading confidence.
- OCR confidence refers only to OCR recognition quality.
- Treat `ascii-hepburn-v1` and Japanese spacing as product behavior defined by golden tests, not whatever a dependency happens to emit.
- Keep dictionary, engine, romanization-policy, and spacing-policy versions in cache keys and results.
- Do not hard-code raw IPADIC detail indices outside the audited adapter/schema module.
- Test byte-offset to JavaScript-offset conversion with emoji and supplementary characters.
- A new language engine must implement generic contracts without importing content-controller or renderer modules.
- A new renderer must consume generic results without importing Lindera or Japanese token internals.

## 7. Processor and message rules

- Heavy language and OCR work runs in the processor worker plane, not in mutation callbacks or popup code.
- Keep the Japanese worker lazy and reusable.
- Do not initialize OCR until a Lens or Spotlight user action.
- The offscreen host and workers must be safe to create, release, and recreate.
- Runtime messages use the versioned discriminated union in `shared/messages`.
- Validate every message at its receiving context before use.
- Verify sender context, tab, and frame where the API exposes them.
- Enforce named limits for message size, batch length, text length, image dimensions, and retry count.
- Use opaque item IDs; never send DOM nodes, HTML, selectors, or whole-page `textContent`.
- Never log an invalid raw payload.
- Every request must resolve to a typed response or typed safe error.
- Reject stale responses silently as expected lifecycle behavior.
- At most one bounded automatic worker restart is allowed per failure episode before the session degrades to original text.

## 8. Privacy rules

- Local processing is the default and current release architecture.
- Never upload webpage text, screenshots, OCR regions, URLs with paths, private messages, emails, dashboard data, or browsing content.
- Never add remote fallback processing without explicit product approval, consent UX, retention rules, and architecture/security review.
- Do not add telemetry or analytics in the MVP.
- Do not persist page text, OCR output, screenshot data, or transliteration cache entries.
- Use `chrome.storage.local` only for versioned settings and origin policy metadata; use `storage.session` for ephemeral recovery state.
- Do not use page `localStorage` from content scripts.
- Do not use `storage.sync` without an explicit opt-in product decision.
- Release logs may include error codes, counts, coarse timings, versions, and permission state. They may not include raw content.
- A local debug build may expose content only through a deliberately enabled, visibly documented mechanism; debug content must never be part of normal logs or bug reports.
- Release screenshots/ImageBitmaps/canvases/object URLs promptly after OCR/overlay work.
- Do not retain a visited-origin list beyond the origins for which the user explicitly saved policy.
- Update privacy disclosures whenever a new permission or data flow is introduced.

## 9. Performance rules

- Disabled and unauthorized means no scan and no heavy module load.
- Never perform periodic full-page scans as normal operation.
- Use fast script prechecks before computed style or engine work.
- Batch mutation collection, engine requests, cache lookups, and renderer writes.
- Deduplicate nodes and identical in-flight text requests.
- Bound every cache and worker queue.
- Keep page-derived caches in memory only.
- Lazy-load the Japanese engine after activation and OCR only after Lens/Spotlight invocation.
- Reuse workers and dictionary state while sessions need them.
- Avoid per-node layout geometry reads in normal Live Mode.
- Yield between initial-scan and large-mutation work slices.
- Measure against the budgets in `PRD.md`; do not declare performance acceptable based on subjective browsing alone.
- Do not optimize by weakening restoration, language correctness, privacy, or message validation.
- A performance optimization that changes output or lifecycle semantics needs regression tests and a documented rationale.

## 10. Error handling rules

- Fail closed to original page content.
- One malformed node or mutation record must not stop later work.
- One failed batch item must not fail successful items.
- OCR failure must not stop Live Mode.
- Unsupported or ambiguous language remains unchanged.
- Wrap DOM, storage, permission, worker, engine, render, capture, and OCR boundaries in the typed error model.
- Safe errors contain codes and metadata, never raw page content.
- Do not swallow errors silently. Convert expected conditions to explicit result states and unexpected conditions to safe structured reports.
- Do not show stack traces or internal payloads in user UI.
- Retry only operations marked retryable, with a named bounded policy.
- A retry must be idempotent and must not duplicate observers, content controllers, registrations, overlays, or writes.

## 11. Accessibility and design rules

- Follow `Design.md` tokens and interaction patterns for all extension-owned UI.
- Use semantic elements and native controls before custom widgets.
- Every control needs an accessible name and visible focus.
- All popup, page prompt, tooltip, Lens, and Spotlight actions must be keyboard operable.
- Escape dismisses transient extension UI and exits Lens/Spotlight.
- Injected prompts are non-modal and do not steal focus.
- Honor `prefers-reduced-motion`.
- Do not rely on color alone.
- Verify text and control contrast; do not assume a token pair passes because it looks acceptable.
- Do not load a large web font. Use the system stack and available Japanese fallbacks.
- Do not add decorative animation, gradients, or dashboard-like chrome.
- Test Replace Mode's effect on copy/paste, selection, zoom, wrapping, high contrast, and screen-reader behavior.
- Do not ship ruby/Learning Mode until duplicate reading and layout behavior pass dedicated tests.

## 12. Testing rules

- Every major behavior needs automated tests in the lowest appropriate layer.
- Every bug fix needs a regression test when practical. If not practical, document why and add a named manual verification.
- Architecture-critical behavior may not rely only on manual tests.
- Script detection, language evidence, token mapping, romanization, spacing, cache keys, migrations, message validation, and geometry require unit tests.
- Static scanning, mutation handling, stale-result rejection, self-loop prevention, restoration, React-like rerenders, and removed-node cleanup require DOM tests.
- The Spotify-like dynamic lyric fixture is a mandatory Phase 2 acceptance test.
- The YouTube-like SPA fixture, large-page fixture, and permission flow require Chromium integration coverage before MVP release.
- Japanese output changes require intentional golden-corpus review. Do not casually rewrite expected outputs to make a test pass.
- Tests involving timing must use controlled schedulers/fakes where possible and generous browser-level assertions where exact timing is not deterministic.
- Verify the built extension offline and inspect its manifest, CSP, permissions, remote-code absence, and packaged assets.
- Run typecheck, lint, unit/DOM tests, build verification, and relevant integration tests before claiming a milestone complete.
- Report exactly what was run and what was not run.
- Never say a feature works because code compiles.

## 13. Dependency policy

### 13.1 General policy

Before adding a production dependency:

- show that native browser/platform code is insufficient;
- verify official maintenance status and latest compatible release;
- inspect license and transitive licenses;
- measure minified/compressed size and runtime memory impact where relevant;
- confirm Manifest V3 CSP and worker compatibility;
- confirm it does not load remote executable assets or models;
- isolate it behind an adapter if it is domain- or platform-specific;
- pin it through the lockfile;
- add provenance/notices where required;
- add a removal/replacement boundary for high-risk dependencies.

Do not add a package for a trivial helper that can be expressed safely in a small tested module.

### 13.2 Selected or conditionally approved

- TypeScript: approved language/tooling foundation.
- Vite: approved build candidate for multiple extension pages, workers, WASM, and assets.
- Vitest and jsdom: approved unit/DOM test candidates.
- Playwright: approved Chromium extension integration candidate.
- ESLint and typescript-eslint: approved static-analysis candidates.
- Lindera WASM bundler build plus matching IPADIC: conditionally approved only after the Phase 0 gate.
- WanaKana: conditionally approved behind `ascii-hepburn-v1` after Phase 0 output and bundle review.
- Tesseract.js: not approved for installation until the Phase 5 OCR gate.

“Approved candidate” does not mean any version is acceptable. The exact tested version is pinned in the first implementation lockfile and recorded in `Memory.md`.

### 13.3 Avoid unless a new decision justifies them

- React, Vue, Svelte, Angular, or another popup UI framework.
- Plasmo, WXT, CRXJS, or another extension framework/plugin that hides manifest or context behavior.
- jQuery or DOM manipulation libraries.
- Kuroshiro/Kuromoji as the production engine without reopening the Phase 0 evidence comparison.
- Python, Flask, native Tesseract, native messaging, or a local daemon in the product path.
- Cloud OCR, translation, LLM, analytics, or telemetry SDKs.
- General-purpose language-detection models for the MVP when script and page evidence are sufficient.
- Persistent database/cache libraries for page-derived content.
- WebExtension polyfills before the Firefox phase proves a need.
- Remote icon, font, WASM, script, dictionary, or trained-data CDNs.
- Site automation/scraping packages.

## 14. Git and change hygiene

- Preserve unrelated user changes in a dirty worktree.
- Keep commits reviewable and aligned with phase deliverables.
- Do not combine generated dictionary blobs, a broad refactor, and behavioral code in one unexplained change.
- Use Git moves when relocating the prototype so history remains traceable.
- Do not rewrite or squash historical prototype commits merely to modernize the tree.
- Generated assets must have reproducible source/checksum metadata and a clear ignore/commit policy.
- Update `Phases.md` status only after acceptance criteria pass.
- Update architecture decision records when a decision changes; do not bury the change only in code or `Memory.md`.
- Update `Design.md` for new visible states/interactions and `PRD.md` for scope or requirement changes.

## 15. Rules for AI coding agents

Future AI agents must:

- inspect the repository, relevant docs, current diff, and tests before editing;
- state the active phase and the specific acceptance criterion being advanced;
- distinguish observed browser behavior from inference;
- verify current browser or dependency behavior from primary sources when it may have changed;
- make the smallest coherent change that advances the requested outcome;
- preserve working systems during unrelated changes;
- avoid architecture rewrites unless explicitly requested and evidenced;
- never invent API support, package behavior, benchmark numbers, test results, or browser-store policy;
- never claim a feature is complete without running appropriate verification;
- mention uncertainty and remaining unverified conditions;
- record architectural changes in `Architecture.md` and phase progress in `Phases.md`;
- update `Memory.md` after meaningful implementation work begins;
- keep raw page content out of tool output and logs whenever practical;
- leave the repository in a state another agent can understand and test.

If blocked by an unknown that can be answered with a safe local experiment, run or propose the experiment. If the answer requires product authority, expanded permissions, external coordination, or a changed privacy promise, stop and ask rather than assuming.

## 16. `Memory.md` policy for implementation

Do not create `Memory.md` during planning. Create it in the first implementation task, after Phase 0 work actually starts.

`Memory.md` is compressed persistent handoff context. It must contain:

```text
# Current State
Current phase:
Current milestone:
Last verified working state:

# Completed
- ...

# Architecture Decisions
- ...

# Important Files
- ...

# Known Issues
- ...

# Current TODO
- ...

# Tests
Passing:
Failing/not run:

# Environment / Commands
Install:
Dev:
Build:
Test:

# Notes for Next Agent
...
```

Rules for maintaining it:

- Keep it concise and factual.
- Update it after meaningful milestones, verified bug fixes, dependency decisions, or a changed handoff state.
- Record decisions and current facts, not entire conversations or plans copied from other documents.
- Never use it as a replacement for `Architecture.md`, `PRD.md`, or test evidence.
- Never mark something complete unless it was verified; record the exact command or manual check.
- List failing and unrun checks explicitly.
- Remove obsolete information instead of appending contradictory history.
- Keep known broken, partial, or experimental work visible.
- Include enough paths and commands for another agent to continue without rereading the whole repository.
- Do not store secrets, tokens, private page content, screenshots, or user data in it.
