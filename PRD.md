# Breaking the Barrier — Product Requirements Document

- **Document status:** Planning baseline 1.1
- **Last updated:** 2026-08-26
- **Implementation status:** Phase 0 complete; Phase 1 ready to start

## 1. Product overview

Breaking the Barrier is a local-first browser extension that helps a person consume a language they can understand but whose native writing system they cannot yet read comfortably. It changes the representation of the writing, not the language itself.

For example:

```text
星座になれたら → seiza ni naretara
愛してる → aishiteru
```

It does not turn Japanese into English. It preserves Japanese words and pronunciation while making them readable in the Roman alphabet.

The initial product is a Japanese-to-romaji experience for Chromium browsers. Its primary path works directly on webpage text, including text that changes after a page loads. A separate, later Lens pipeline handles text that exists only in pixels.

## 2. Product thesis

Many people have useful listening or speaking ability before they can read a language's native script fluently. Translation removes the language they are trying to consume. Transliteration can instead act as a temporary bridge: it preserves pronunciation, vocabulary, rhythm, and cultural context while removing the immediate script barrier.

Breaking the Barrier succeeds if it feels like a lightweight browser capability that can stay active on a modern site without making the site feel slower, damaging its layout, or sending private content away from the device.

## 3. Problem statement

Users who understand spoken Japanese may still be blocked by Kanji and Kana in song titles, lyrics, video metadata, comments, and articles. Existing workarounds require copying text into another tool, translating it, installing site-specific scripts, or using screenshot OCR even when the text is already available in the DOM.

The problem has three parts:

1. The representation problem: users need the original language expressed in a script they can read.
2. The dynamic-page problem: Spotify, YouTube, and other single-page applications replace or insert text without reloading.
3. The pixel-text problem: some text is rendered inside images, canvas, PDFs, or video and cannot be read as DOM text.

The product must solve the first two reliably before expanding into the third.

## 4. Transliteration, not translation

Translation answers “what does this mean in another language?” Transliteration or romanization answers “how is this written or pronounced in a script I can read?”

Breaking the Barrier must use product language such as **romanize**, **transliterate**, **reading**, and **original**. It must not label core behavior as translation. Translation may become an explicitly separate optional feature in the distant future, but it is not part of the current architecture or roadmap.

Automatic Japanese readings are not infallible. Kanji readings depend on word boundaries and context, and names, slang, invented spellings, and new proper nouns are difficult. The product must prefer a recoverable original or a clearly uncertain result over presenting a fabricated reading as fact.

## 5. Target users

### 5.1 Primary persona

The initial persona is a Japanese media consumer and early-to-intermediate learner who recognizes spoken words but reads Japanese script slowly. They regularly use dynamic sites such as Spotify and YouTube and want to pronounce titles, artist names, lyrics, and comments without replacing Japanese with English.

This persona is the best initial wedge because:

- the script barrier is frequent and obvious;
- dynamic media sites exercise the product's core technical advantage;
- short labels, titles, and lyric lines create a tractable Japanese quality corpus;
- the value of preserving the original language is immediately visible.

### 5.2 Secondary personas

- Heritage speakers who understand a family language but cannot comfortably read its script.
- Learners who want romanization as temporary scaffolding before relying on native script.
- Travellers who need to pronounce place names, signs, and menus; Lens Mode matters more for this group.
- Fans of Korean, Hindi, Arabic, and other media; these users become relevant after the language-module architecture is proven.
- Accessibility users who benefit from an alternative written representation, while recognizing that this extension is not a replacement for assistive technology.

## 6. Highest-value use cases

1. Keep Japanese song titles, artist names, and changing lyric lines readable on a music site.
2. Romanize video titles and dynamically loaded comments during single-page navigation.
3. Read Japanese paragraphs in a normal article without copying text elsewhere.
4. Preserve English and punctuation while romanizing Japanese spans in mixed text.
5. Toggle back to the exact current original content without reloading.
6. Manually select a visible image region and place romanized OCR results over the corresponding pixels. This is later-product scope.

## 7. User stories

### Live Mode

- As a learner, I want to enable romanization for the current page so I can keep browsing in Japanese.
- As a music listener, I want newly displayed lyrics to be romanized automatically without reloading.
- As a video viewer, I want titles and comments loaded during in-app navigation to be processed.
- As a reader, I want English, numbers, emoji, and punctuation to remain intact on a mixed-language page.
- As a user, I want to turn the extension off and recover the site's latest original text exactly.
- As a privacy-conscious user, I want page text to stay on my device.
- As a user, I want a failure on one piece of text to leave that text unchanged without breaking the page or other conversions.

### Preferences and prompts

- As a first-time user, I want the extension to ask before changing a page.
- As a repeat user, I want to remember my choice for a specific site without granting access to every site.
- As a learner, I want a consistent romanization convention.
- As a user, I want a clear indication of whether the current page is original, starting, romanized, partially processed, or unavailable.

### Lens and Spotlight

- As a traveller or media viewer, I want to select text inside an image and see romanized text near its original location.
- As a user, I want OCR to run locally and only when I invoke it.
- As an experimental Spotlight user, I want to pause over a small pixel region and receive a nearby reading without starting continuous full-page OCR.

## 8. Product modes and scope classification

### 8.1 Live DOM Mode

**Classification: MVP**

Live Mode reads eligible DOM text nodes, detects relevant scripts and language evidence, produces local Japanese readings, renders romanized output, and observes incremental DOM mutations. It is the default and performance-critical mode.

It must not use OCR when text is already available as DOM text.

### 8.2 Replace Mode

**Classification: MVP**

Replace Mode changes the data of eligible text nodes without inserting wrappers. It is the default renderer because it minimizes layout and framework interference. Every change must be tracked and reversible.

### 8.3 Learning / Annotation Mode

**Classification: Later**

Learning Mode shows original text and its reading together, potentially using semantic ruby annotations where they do not damage layout. It is more educational but carries substantial line-height, wrapping, accessibility, and framework-reconciliation risk.

### 8.4 Hover Mode

**Classification: Later**

Hover Mode leaves page text unchanged and displays romanization in an accessible tooltip on hover or keyboard focus. It is lower-risk for layout but less useful for continuous lyrics and reading.

### 8.5 Lens / OCR Overlay Mode

**Classification: Later**

Lens Mode captures a user-selected part of the visible tab, performs local OCR, and returns text with bounding boxes. It renders romanized labels approximately over the captured locations. It is intentionally separate from Live Mode.

### 8.6 Spotlight / Point-and-Read Mode

**Classification: Experimental**

Spotlight captures a small region around a stationary pointer after a deliberate pause. It is constrained by browser screenshot cost, capture-rate limits, page motion, protected media, and OCR latency. It must never become a continuous default scanner.

## 9. Functional requirements

### 9.1 Activation and permissions

- **FR-ACT-01:** The MVP must be user-invoked on the current tab through the extension action or popup.
- **FR-ACT-02:** Initial installation must not require persistent access to every website.
- **FR-ACT-03:** The user may explicitly grant a single origin persistent access when choosing “remember for this site.”
- **FR-ACT-04:** Restricted browser pages and unsupported URLs must show a clear unavailable state without repeated errors.
- **FR-ACT-05:** A page-level “Japanese detected” prompt may appear automatically only on sites for which the user has already granted persistent access. On a new site, detection begins after the user invokes the extension.

### 9.2 DOM discovery and filtering

- **FR-DOM-01:** The system must traverse text nodes without rebuilding or serializing the page DOM.
- **FR-DOM-02:** It must exclude extension-owned UI and must not intentionally modify script, style, template, code, preformatted code, form-control, contenteditable, SVG, or MathML content in the MVP.
- **FR-DOM-03:** It must ignore whitespace-only and unsupported-script text.
- **FR-DOM-04:** It must use script analysis and language evidence separately; Han characters alone must not automatically be declared Japanese.
- **FR-DOM-05:** It must preserve unsupported spans, Latin text, numbers, emoji, punctuation, and meaningful whitespace.
- **FR-DOM-06:** Visibility checks must avoid repeated forced layout. Known limitations around CSS-hidden content must be documented and measured.

### 9.3 Japanese processing

- **FR-JA-01:** The initial V2 Japanese engine must use contextual morphological analysis for Kanji readings rather than character substitution.
- **FR-JA-02:** The default output must use the product's ASCII Hepburn policy: familiar Hepburn spellings, vowel sequences such as `toukyou`, and grammatical particle pronunciation where the analyzer supplies reliable part-of-speech context.
- **FR-JA-03:** The engine must preserve source and token offsets so future renderers can align readings with original text.
- **FR-JA-04:** Unknown Kanji tokens without a reliable reading must remain original and carry an internal warning; they must not receive a guessed per-character reading.
- **FR-JA-05:** The engine must be replaceable behind a stable language-engine contract.
- **FR-JA-06:** Japanese code, dictionary data, and romanization rules must run entirely inside the packaged extension without a network request, native-messaging bridge, companion process, or separately installed runtime.

### 9.4 Rendering and restoration

- **FR-REN-01:** The MVP renderer must directly update eligible text-node data and must not replace parent elements or event handlers.
- **FR-REN-02:** Before a write, the system must track the latest page-authored source, rendered value, and revision for that text node.
- **FR-REN-03:** An asynchronous result may be applied only if the node is still connected, the mode is still active, and the source revision still matches.
- **FR-REN-04:** Turning Live Mode off must restore the latest known page-authored text for every still-owned node.
- **FR-REN-05:** Restoration must not overwrite a newer value written by the page.
- **FR-REN-06:** Removed nodes must not be retained indefinitely by restoration bookkeeping.

### 9.5 Dynamic pages

- **FR-DYN-01:** A `MutationObserver` must watch added subtrees and changed text nodes while Live Mode is active.
- **FR-DYN-02:** Mutation records must be deduplicated and processed in bounded batches.
- **FR-DYN-03:** The system must process affected nodes or subtrees only; it must not rescan the entire document for each mutation.
- **FR-DYN-04:** Writes made by Breaking the Barrier must not create observer loops.
- **FR-DYN-05:** If a framework overwrites or replaces a processed node, the new page-authored text must become the source and be processed again.
- **FR-DYN-06:** Same-origin and authorized frames may run independent content controllers. Cross-origin frames without permission must remain untouched.
- **FR-DYN-07:** Open Shadow DOM support is best-effort post-MVP hardening; closed Shadow DOM and page-context monkey-patching are not required.

### 9.6 Caching and work scheduling

- **FR-PERF-01:** Identical engine requests with the same engine version and options must share a bounded in-memory cache.
- **FR-PERF-02:** Concurrent identical requests must be coalesced.
- **FR-PERF-03:** Heavy language assets must load lazily after user activation.
- **FR-PERF-04:** DOM collection, language work, and DOM writes must run in bounded slices so the page's main thread can respond between slices.
- **FR-PERF-05:** OCR code and language data must not load until Lens or Spotlight is invoked.

### 9.7 Preferences

- **FR-PREF-01:** MVP preferences include global enabled state, current-page state, per-site allow/ask/disabled policy, Japanese enablement, renderer selection fixed to Replace, and ASCII Hepburn as the initial standard.
- **FR-PREF-02:** Preferences must use extension storage with a versioned schema and migrations.
- **FR-PREF-03:** Page content, screenshots, OCR output, and transliteration cache entries must not be persisted as preferences.
- **FR-PREF-04:** Later settings may expose renderer choice, additional languages, romanization standards, Lens behavior, Spotlight, and learning options.

### 9.8 Lens Mode

- **FR-LENS-01:** Lens must require a user gesture and capture only the visible tab or a selected visible region.
- **FR-LENS-02:** OCR must run locally in a reusable worker and return normalized bounding boxes, original text, confidence, and reading output.
- **FR-LENS-03:** Overlays must be extension-owned, visually distinct, keyboard dismissible, and excluded from Live Mode.
- **FR-LENS-04:** A scroll, zoom, resize, navigation, or material layout change must invalidate or dismiss viewport-bound results rather than leave misleading boxes.
- **FR-LENS-05:** OCR failure must not stop Live Mode.
- **FR-LENS-06:** Protected or blank media captures must produce an honest unavailable result.

### 9.9 Spotlight Mode

- **FR-SPOT-01:** Spotlight must be explicitly entered and visibly active.
- **FR-SPOT-02:** Capture must be debounced until the pointer is stationary and remain below browser capture-rate limits.
- **FR-SPOT-03:** Only a small cropped region is sent to OCR even if the browser API first captures the viewport.
- **FR-SPOT-04:** Pointer movement, scrolling, or mode exit must cancel stale work and remove the overlay.

## 10. Non-functional requirements

### 10.1 Privacy

- Page text, screenshots, and OCR regions stay on the device by default.
- No account, login, cloud backend, analytics pipeline, or telemetry is required.
- No remote executable code, WASM, dictionary, or OCR model may be loaded at runtime.
- Debug logs must avoid webpage text and URLs beyond the minimum origin information needed for permission state.
- In-memory text and image buffers must be released when no longer needed.
- Any future cloud feature requires a separate product decision, explicit consent, a visible data-flow explanation, retention rules, and a local alternative where feasible.

### 10.2 Performance targets

Targets are validated on an agreed mid-tier reference laptop and representative fixtures; they are budgets, not unmeasured claims.

- When disabled and not authorized for a site, the extension performs no page scan and has near-zero page runtime cost.
- The observer callback performs only collection and scheduling, with a target p95 synchronous duration below 8 ms during the Spotify-like mutation fixture.
- A warm update of up to 50 short text nodes should appear within 250 ms p95 of the final relevant mutation.
- Initial scanning must yield between bounded work slices and must not create a single long task over 50 ms in the 5,000-node fixture.
- Japanese engine assets should remain at or below 25 MiB compressed in the packaged extension unless measurements and user value justify an explicit exception.
- Japanese cold readiness should target 2 seconds or less and warm transliteration of 100 short strings should target 100 ms or less on the reference device.
- The original loaded-Japanese planning target was less than 150 MiB
  incremental memory. Phase 0 measured Lindera/IPADIC above that target and
  accepted an evidence-backed initial implementation exception of at most
  180 MiB incremental Linux PSS while the processor is loaded on the reference
  Chromium/Linux environment. The processor remains lazy and must be releasable
  when no active session needs it.
- Phase 1 page-side DOM bookkeeping, bounded caches, and queues must add no more
  than 20 MiB persistent extension-side memory on the agreed representative
  fixture, measured separately from the loaded Japanese processor baseline,
  unless a new documented exception is approved.
- All caches are bounded and cleared when their owning worker or tab session ends.

### 10.3 Reliability

- A malformed node or failed engine item cannot stop the observer.
- A worker crash may degrade Live Mode to original text and a retryable status, never a broken page.
- Messages are versioned, validated, bounded, and correlated with request identifiers.
- Navigation, tab closure, extension update, and service-worker restart must not leave persistent page modifications beyond the lifetime of the current document.
- No feature is called complete without automated acceptance coverage and a documented manual browser check where APIs cannot be fully simulated.

### 10.4 Accessibility

- Extension UI meets WCAG 2.2 AA contrast, focus visibility, name/role/value, and keyboard-operation expectations.
- Page prompts are non-modal, do not steal focus, and are announced politely when appropriate.
- Escape closes transient prompts, Lens overlays, and Spotlight.
- Reduced-motion preferences remove nonessential animation.
- Replace Mode's effect on screen-reader pronunciation must be documented. The extension must not rewrite author-provided ARIA labels in the MVP.
- Annotation and hover renderers require explicit screen-reader testing before release to prevent duplicate reading.
- Color is never the only indication of state or confidence.

### 10.5 Security

- Run content logic in the extension's isolated world; do not inject into the page's main JavaScript world without a reviewed requirement.
- Minimize required permissions and request optional origin access only in response to a user gesture.
- Treat every message and OCR/text payload as untrusted, including messages from compromised pages attempting to influence DOM state.
- Apply length, batch, and resource limits before worker processing.
- Bundle and audit every production dependency and third-party license.

## 11. Browser strategy

The MVP targets current Chromium-family desktop browsers: Chrome first, with Edge and Brave expected to work from the same Manifest V3 build where their APIs match. The minimum Chromium version is 109 because the selected reusable processor host depends on `chrome.offscreen`; Phase 0 confirmed the chosen WASM build and packaged worker path under that manifest target.

Portable WebExtension concepts and a small browser API adapter should be used where the cost is low. Firefox packaging and QA are later scope because Firefox still differs in background execution and does not provide Chrome's offscreen API. Cross-browser support must not weaken the Chromium MVP.

Mobile browser support is not in scope.

## 12. MVP definition

The MVP is complete at the end of Phase 3 in `Phases.md`. It contains:

- a modern TypeScript Manifest V3 extension scaffold;
- local Japanese contextual romanization behind a language-engine contract;
- user-invoked activation for the current tab;
- script detection with conservative Japanese language evidence;
- direct, reversible Replace Mode;
- incremental mutation handling for dynamic pages;
- stale-result and self-mutation protection;
- popup state, page prompt after detection, toggle, and exact restoration;
- per-site ask/allow/disabled settings through optional origin permissions;
- bounded caches and lazy language-engine loading;
- automated unit, DOM, and Chromium integration fixtures, including Spotify-like and YouTube-like pages;
- documented limitations for frames, Shadow DOM, hidden content, names, and ambiguous Han-only strings.

## 13. Later-product scope

- Hover renderer.
- Learning/ruby annotation renderer after layout and accessibility experiments.
- Manual Lens capture with local Japanese OCR and positional overlays.
- Spotlight as an opt-in experiment.
- A second language engine to prove modularity.
- Firefox packaging and compatibility work.
- Open Shadow DOM hardening and broader iframe coverage.
- Site-specific adapters only when generic DOM behavior cannot provide an acceptable experience and the maintenance cost is justified.
- User dictionaries or correction mechanisms for names and media-specific vocabulary.
- Optional per-language romanization standards.

## 14. Experimental scope

- Continuous or near-continuous OCR on video.
- OCR on protected/DRM media.
- Full-page stitched capture and tracking overlays through arbitrary scroll and reflow.
- Canvas-specific tracking or video-frame extraction.
- Confidence-aware display of alternative Japanese readings.
- Native browser on-device OCR APIs, if they become stable, portable, local, and position-aware.

## 15. Explicit non-goals

The current product does not include:

- translation as a core behavior;
- accounts, login, cloud sync, subscriptions, or a server backend;
- Python or any other separately installed companion runtime, native-messaging bridge, local service, or native daemon;
- LLM or generative-AI text processing;
- an AI chatbot;
- telemetry or analytics dashboards;
- ten languages in the first release;
- OCR as a fallback for accessible DOM text;
- automatic continuous full-page or video OCR;
- perfect readings for all names, slang, and invented terms;
- support for input fields or editing content inside contenteditable regions;
- modification of page scripts, styles, code samples, SVG, or MathML in the MVP;
- guaranteed operation on privileged browser pages, extension stores, closed Shadow DOM, inaccessible cross-origin frames, or protected media;
- a site-specific Spotify scraper or dependence on private site APIs.

## 16. Success metrics

### Product validation

- At least 80% of structured pilot sessions with the primary persona complete “enable, read changing Japanese content, restore original” without assistance.
- At least 70% of pilot users report that romanization preserves more of the desired experience than translation for the tested media tasks.
- Fewer than 5% of pilot sessions report a page-layout or interaction regression attributable to Replace Mode, with every reproducible regression triaged before wider release.

### Functional quality

- Deterministic kana cases pass 100% of the versioned golden corpus.
- The Phase 0 Japanese corpus establishes token-reading accuracy by category: general prose, song/video metadata, names, mixed text, and unknown terms. The MVP release threshold is at least 95% exact expected output overall, with names reported separately and no invented reading for explicitly unknown Kanji tokens.
- All automated restoration fixtures return the exact current page-authored source after toggle-off.
- The Spotify-like fixture updates its romanized lyric after a dynamic mutation without reload.
- The YouTube-like fixture continues working across simulated single-page navigation and comment insertion.
- Unsupported scripts and excluded elements remain byte-for-byte untouched in regression fixtures.

### Privacy and performance

- Automated network inspection finds zero requests containing webpage text, screenshots, OCR output, dictionaries, or executable assets after installation.
- The budgets in section 10.2 pass on the reference fixture set or an exception is explicitly approved and documented before release.
- No unbounded cache or detached-node retention is observed in repeated-navigation and mutation stress tests.

## 17. Risks and mitigations

### Japanese reading quality

IPADIC may misread names, new media terms, and creative spellings. Mitigate with a category-specific golden corpus, unknown-token preservation, engine-versioned caches, and a future user dictionary rather than silent guessing.

### Dictionary size and startup

Contextual readings require a substantial dictionary. The current Lindera IPADIC release is roughly 15 MiB compressed before WASM and glue code. Phase 0 is a hard packaging, startup, memory, CSP, license, and offline gate. Keep the engine lazy and replaceable.

### Framework reconciliation and mutation loops

React and similar frameworks may overwrite extension writes. Direct text-node mutation avoids parent replacement; per-node revisions, expected-render checks, and observer batching prevent stale writes and loops. Integration fixtures must simulate both same-node updates and node replacement.

### Large and mutation-heavy pages

An initial `TreeWalker` scan and frequent observer records can monopolize the main thread. Structural filters, script prechecks, bounded batches, idle scheduling, deduplication, and performance fixtures are release requirements.

### Layout and accessibility

Romanized strings can be wider than Japanese text, and annotation can increase line height. Replace is the only MVP renderer; overflow and screen-reader behavior must be tested. Ruby and overlay renderers remain later scope.

### Browser permissions and store review

Persistent site access can alarm users and remote code is forbidden in Manifest V3. Use `activeTab`, optional per-origin permissions, bundled assets, and plain-language permission explanations.

### OCR expectations

Viewport capture is expensive, limited in rate, and may omit protected content. Position mapping is sensitive to zoom, device scale, scroll, and reflow. Lens is manual and later; Spotlight is experimental.

## 18. Architecture challenge scenarios

The selected architecture must pass these scenarios before the corresponding phase is complete:

### A. Static article

A bounded `TreeWalker` scan finds eligible Japanese text nodes, the detector selects Japanese, the local engine returns contextual readings, and Replace Mode writes only text-node data.

### B. Spotify-like dynamic content

The observer collects a changed lyric node, deduplicates it, increments its revision, requests a cached or batched result, and applies it only if still current. No reload or periodic full-page rescan occurs.

### C. YouTube-like navigation

Added title and comment subtrees are scanned incrementally. Existing nodes are not repeatedly transliterated, and page navigation that replaces nodes naturally releases old weak state.

### D. Mixed-language page

Script runs segment the input; Japanese spans are romanized while Latin text, numbers, punctuation, emoji, and unsupported scripts pass through unchanged.

### E. React rerender

If React overwrites the same text node, the value no longer matches the extension's expected rendered value and becomes the new source. If React replaces the node, the old node is cleaned up and the new subtree is processed.

### F. Large webpage

Candidate collection and processing yield between bounded slices, prioritize supported-script nodes, use cache hits, and never rescan the document for a single mutation.

### G. Image-only text

Live Mode leaves it alone. Later Lens Mode captures a selected visible region, performs local OCR, and renders position-aware overlay labels.

### H. Pixel-rendered video subtitles

Live Mode cannot access them. Manual Lens may process a captured frame if the browser supplies pixels. Continuous tracking and protected media remain experimental or unavailable.

### I. Toggle off

The observer stops accepting work, outstanding requests are invalidated, and owned nodes restore their latest page-authored sources unless the page has already written a newer value.

### J. Engine failure

The failed item stays original, other items continue, the UI reports partial or retryable failure without exposing content, and Live Mode remains isolated from OCR failures.

No scenario above requires changing the core language engine, DOM controller, or renderer contract; that is the central architectural test.

## 19. Open questions

Questions marked **Experiment** do not block Phase 0. Questions marked **Product input** should be confirmed before the MVP acceptance criteria are frozen.

- **Product input:** Are Spotify and YouTube named launch acceptance targets on their real production sites, or representative dynamic-site validation targets backed primarily by stable local fixtures? Real-site acceptance implies account/test-environment maintenance and site-change risk.
- **Product input:** The brief's examples imply ASCII output such as `toukyou`; confirm that this should remain the default over macrons such as `Tōkyō`. The architecture currently chooses ASCII Hepburn.
- **Resolved 2026-08-26:** Lindera WASM plus bundled IPADIC passed package,
  cold-start, warm-latency, offline, and Manifest V3 CSP gates. It failed the
  original memory target and was accepted under the documented at-most-180 MiB
  loaded-processor exception. Store submission itself remains a release-stage
  operational check.
- **Experiment:** What reading accuracy does IPADIC achieve on a curated corpus of current artist names, song titles, and lyrics, and does a small product dictionary materially improve it?
- **Experiment:** Which CSS visibility policy gives the best balance between avoiding hidden text and avoiding layout work or missed class-driven reveals?
- **Experiment:** How often do target sites expose lyrics/subtitles as DOM text versus canvas or protected pixels?
- **Experiment:** Where does ruby annotation create unacceptable wrapping, clipping, duplicate screen-reader output, or framework conflict?
- **Experiment:** Is local Tesseract.js Japanese OCR accurate and responsive enough for selected-region Lens on mid-tier hardware, and what packaged trained-data size is acceptable?
- **Experiment:** How aggressively should open Shadow DOM be scanned without patching page APIs or retaining large root graphs?
- **Later product input:** Which second language best proves the architecture while serving the next strongest persona? Korean is the current research candidate, not a commitment.

## 20. Release principle

The MVP should prove one difficult thing well: reliable, reversible, performant, real-time Japanese romanization across ordinary and dynamically changing DOM text. OCR, additional renderers, additional languages, and cross-browser packaging follow only after that thesis is demonstrated.
