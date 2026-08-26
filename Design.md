# Breaking the Barrier — Product Design System

- **Document status:** Planning baseline 1.0
- **Last updated:** 2026-08-24
- **Product character:** A polished browser-native reading utility

## 1. Experience statement

Breaking the Barrier should feel like a capability the browser was missing, not a destination application. The user should be able to understand the current state, make one decision, and return attention to the page.

The interface supports the content; it does not compete with it. There is no dashboard, feed, account area, or large settings surface in the MVP.

## 2. Design principles

### Content first

Page content remains visually dominant. Injected UI floats above the page, never shifts the page layout, and leaves when its task is complete.

### One clear decision

The popup and detection prompt lead with one primary choice: Romanize this page or return to Original. Secondary controls explain site memory and status without creating a control panel.

### Calm about uncertainty

Japanese readings and OCR can fail. State what is happening in plain language, keep the original available, and offer a retry when useful. Do not dramatize errors or hide uncertainty.

### Original is always close

The current view state is explicit. A visible Original/Romanized control and reliable toggle-off behavior build trust.

### Browser-native, distinct in detail

Use familiar controls, system typography, compact spacing, restrained color, and a small “opening in a barrier” motif. Identity comes from clarity and consistent reading treatment, not ornamental surfaces.

### Accessible by construction

Keyboard behavior, focus, contrast, zoom, reduced motion, and screen-reader semantics are part of each component definition.

## 3. Visual identity

### 3.1 Motif

The working brand motif is two simple vertical forms separated by an opening, with a short line passing through the gap. It suggests crossing a writing-system barrier without replacing the language beyond it.

Use the motif for the toolbar icon and small product mark only. It must remain recognizable at 16 px and should not include letters, flags, or language-specific imagery.

### 3.2 Voice

The voice is direct, considerate, and linguistically accurate.

Preferred:

- “Japanese detected”
- “Romanize this page?”
- “Showing romaji”
- “Original restored”
- “Some readings could not be generated”
- “Lens processes this image on your device”

Avoid:

- “Translate Japanese” for core behavior
- “AI-powered”
- “Perfect pronunciation”
- “We understand this page”
- technical errors, stack traces, or promises of universal site support

Use sentence case. Keep labels short. Explain permission consequences immediately before requesting them.

## 4. Color system

The palette is deliberately small. Brand blue indicates primary interaction and romanized-reading UI. Semantic colors are reserved for status. Page text in Replace Mode receives no forced color because direct styling would require wrappers and could damage the site.

Every final token pair must be verified for WCAG 2.2 AA in implementation; the values below are design candidates, not a substitute for contrast tests.

### 4.1 Light theme

- `--btb-surface`: `#FFFFFF`
- `--btb-surface-subtle`: `#F8FAFC`
- `--btb-surface-accent`: `#EEF2FF`
- `--btb-text`: `#182230`
- `--btb-text-muted`: `#475467`
- `--btb-text-on-primary`: `#FFFFFF`
- `--btb-border`: `#D0D5DD`
- `--btb-border-strong`: `#98A2B3`
- `--btb-primary`: `#2F56D3`
- `--btb-primary-hover`: `#2444AA`
- `--btb-primary-pressed`: `#1E3685`
- `--btb-focus`: `#1570EF`
- `--btb-success`: `#067647`
- `--btb-success-surface`: `#ECFDF3`
- `--btb-warning`: `#B54708`
- `--btb-warning-surface`: `#FFFAEB`
- `--btb-danger`: `#B42318`
- `--btb-danger-surface`: `#FEF3F2`
- `--btb-scrim`: `rgba(16, 24, 40, 0.42)`

### 4.2 Dark theme

- `--btb-surface`: `#111827`
- `--btb-surface-subtle`: `#1F2937`
- `--btb-surface-accent`: `#202A4A`
- `--btb-text`: `#F2F4F7`
- `--btb-text-muted`: `#B3BDC9`
- `--btb-text-on-primary`: `#101828`
- `--btb-border`: `#344054`
- `--btb-border-strong`: `#667085`
- `--btb-primary`: `#91A7FF`
- `--btb-primary-hover`: `#B2C0FF`
- `--btb-primary-pressed`: `#738EEA`
- `--btb-focus`: `#84CAFF`
- `--btb-success`: `#75E0A7`
- `--btb-success-surface`: `#103B2B`
- `--btb-warning`: `#FEC84B`
- `--btb-warning-surface`: `#422D12`
- `--btb-danger`: `#FDA29B`
- `--btb-danger-surface`: `#4A1D1F`
- `--btb-scrim`: `rgba(0, 0, 0, 0.60)`

### 4.3 Theme behavior

- Default to the browser/OS `prefers-color-scheme` setting.
- The MVP does not need its own theme switch.
- Injected UI resolves all values inside its Shadow root so page custom properties cannot change it.
- High-contrast and forced-colors modes use system colors and borders rather than preserving brand color.
- Never use color alone to distinguish Original, Romanized, warning, or error.

## 5. Typography

Use the native UI stack:

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
  Helvetica, Arial, "Noto Sans JP", sans-serif;
```

Do not bundle a font in the MVP. A Japanese fallback may be used when installed, but page text remains in the site's own typeface in Replace Mode.

### Type scale

- Product/page prompt title: 16 px, 600 weight, 1.35 line height.
- Popup section heading: 14 px, 600 weight, 1.4 line height.
- Body and control label: 14 px, 400 or 500 weight, 1.45 line height.
- Secondary/meta text: 12 px, 400 weight, 1.4 line height.
- Compact status label: 12 px, 600 weight, 1.3 line height.
- Lens result reading: starts at 14 px and may scale to fit the detected box within documented minimum/maximum bounds.
- Ruby `rt` reading: approximately `0.62em` of the base text with at least a readable 10 px effective size where the host layout permits.

Do not use all caps for status. Do not use font weight below 400. Let text wrap rather than shrink body copy below 12 px.

## 6. Spacing and sizing

Use a 4 px base scale:

- `--btb-space-1`: 4 px
- `--btb-space-2`: 8 px
- `--btb-space-3`: 12 px
- `--btb-space-4`: 16 px
- `--btb-space-5`: 20 px
- `--btb-space-6`: 24 px
- `--btb-space-8`: 32 px

Control and layout guidance:

- Minimum pointer target: 40 by 40 px in compact popup UI; use 44 by 44 px where space allows.
- Popup horizontal padding: 16 px.
- Popup section gap: 16 px.
- Inline label gap: 8 px.
- Page prompt padding: 16 px.
- Tooltip padding: 8 px vertically and 12 px horizontally.
- Lens label padding: 4 px vertically and 8 px horizontally.

Compact does not mean cramped. Do not reduce targets simply to keep the popup to one screen.

## 7. Borders, radii, and shadows

### Borders

- Default structural border: 1 px `--btb-border`.
- Emphasized selection or Lens box: 2 px primary border.
- Focus ring: 2 px `--btb-focus` with a 2 px offset when space permits.
- Low-confidence OCR may use a dashed border plus a text label; never dashed color alone.

### Radii

- Inputs and buttons: 6 px.
- Popup sections and page prompt: 10 px.
- Tooltips and Lens labels: 8 px.
- Status badge: 999 px only when a compact pill is genuinely useful.

Avoid wrapping every section in a rounded card. The popup is primarily an open vertical layout separated by spacing and occasional rules.

### Shadows

- Popup: none; the browser provides its container.
- Page prompt and hover tooltip: one subtle elevation, approximately `0 8px 24px rgba(16, 24, 40, 0.16)` in light mode and a stronger neutral equivalent in dark mode.
- Lens result labels: a small neutral text/surface elevation only when necessary against image content.
- Do not stack shadows, use colored glows, or apply shadow to every control.

## 8. Icons

- Use a small reviewed set of bundled SVG icons: product mark, close, chevron, check/status, warning, retry, eye/hover, scan/Lens, and pin/site memory if needed.
- Default size: 16 px; prominent action: 18 or 20 px.
- Stroke style: rounded line caps, consistent optical weight around 1.75 px at a 24 px viewBox.
- Icons accompany text for unfamiliar or consequential actions.
- Close and retry controls require accessible names.
- Do not use flags to represent languages.
- Do not add an entire icon package for fewer than a dozen simple icons; inline or bundle audited SVG assets.

## 9. Motion

Motion communicates state change and stays out of the reading path.

- Control feedback: 100–120 ms.
- Prompt/tooltips enter or leave: 160 ms.
- Lens label reposition/fade: at most 180 ms.
- Easing: standard ease-out for entry and ease-in for exit.
- Animate opacity and small transforms only; avoid height animation that reflows content.
- No bounce, spring, parallax, shimmer, pulsing scan beam, or indefinite decorative motion.
- A loading spinner may rotate only while real work is pending and must have a text status.
- Under `prefers-reduced-motion: reduce`, remove transform animation, stop spinner rotation, and use immediate or short opacity changes.

## 10. Popup information architecture

### 10.1 Size

- Target width: 320 px.
- Minimum useful width: 300 px.
- Content height is state-driven; keep the primary flow within roughly 480 px where possible.
- The popup may scroll when zoom or longer localized text requires it.

### 10.2 Layout

```text
Product mark  Breaking the Barrier             [status]

Current page
Japanese detected / No supported text / Unavailable
Short explanatory line when needed

[ Romanize this page ]
or
[ Romanized  |  Original ]

Remember for this site                         [toggle]
Permission explanation appears before request

Secondary status or retry
```

The MVP does not show a sidebar, tab navigation, usage chart, recent pages, account avatar, or settings dashboard.

### 10.3 Header

- Product mark and name on the left.
- A compact textual status on the right only when it adds value: Original, Starting, On, Partial, or Unavailable.
- Do not put a close button inside the browser popup.

### 10.4 Primary control

Before activation:

- Primary filled button: “Romanize this page.”
- If inspection is still running: disabled button and text “Checking this page…”
- If no Japanese is detected: secondary action “Check again,” only when a rescan is meaningful.

While active:

- Use a two-state segmented control or one clear button whose label is “Show original.”
- The selected state includes text and check/position, not color alone.
- Avoid an unlabeled generic on/off switch for the central view because “on” does not explain what the page shows.

### 10.5 Remembered-site control

- Label: “Remember for this site.”
- Supporting text before first grant: “Allows Breaking the Barrier to check pages on this site automatically. Text stays on this device.”
- Request permission only after the user changes this control or chooses a clearly labeled confirmation.
- If permission is denied, return the control to off and say “Site access was not granted.” Do not repeatedly prompt.
- Display only the normalized site host, not a long URL or page path.

### 10.6 MVP popup states

#### Original / idle

Show current-site availability and the primary action. Do not load the Japanese engine merely because the popup opened.

#### Inspecting

Show “Checking this page…” with a compact progress indicator. Keep secondary controls disabled only when their action truly depends on detection.

#### Japanese detected

Show “Japanese detected” and “Romanize this page?” The primary action is visually dominant.

#### Starting

Show “Preparing Japanese readings…” The first dictionary load can take longer; explain it once without adding a progress percentage the system cannot know.

#### Romanized

Show “Showing romaji” and the Original control. Site memory remains available.

#### Partial

Show “Showing romaji” plus a warning line: “Some text could not be read and was left original.” Do not list page content in the popup.

#### No supported text

Show “No supported Japanese text found.” Explain that image text requires Lens later if Lens exists in the current phase.

#### Restricted page

Show “This browser page cannot be changed.” Do not show retry unless navigation could make it valid.

#### Retryable error

Show “Readings are unavailable right now. The page was left original.” Provide Retry and, if active state may be ambiguous, Show original.

## 11. Page-level detection prompt

### 11.1 Purpose and timing

The page prompt appears only after the extension is allowed to inspect the site and Japanese evidence passes the product threshold. On a new site without access, the popup is the first interaction.

### 11.2 Placement

- Fixed to the top-right of the visual viewport with 16 px edge spacing.
- Width: 300–340 px depending on localization and zoom.
- Must account for `visualViewport` and avoid browser UI assumptions.
- If it obscures an obvious page control, allow the user to dismiss it; do not attempt autonomous page-layout analysis.
- Never insert it into normal document flow.

### 11.3 Content

```text
Japanese detected
Romanize this page while keeping the language Japanese?

[ Romanize ]  [ Not now ]                         [Close]
```

On an already remembered “always” site, replace the decision prompt with a brief non-interactive status toast only if users need confirmation. Do not show a prompt on every page change.

### 11.4 Semantics and focus

- Mount inside the extension's marked Shadow root.
- Use a labeled region with polite live status; do not declare a modal dialog.
- Do not steal focus when it appears.
- All actions are reachable in logical order if the user tabs to the region.
- Escape dismisses it when focus is inside or a registered extension shortcut targets it; Escape must not globally interfere with the site in normal browsing.
- Closing and “Not now” are distinct only if policy behavior differs; explain saved behavior.

## 12. Hover Mode — later

### Interaction

- Original page text remains unchanged.
- Pointer hover after a short intentional delay displays a tooltip; focus on a supported target displays the same content without delay.
- Moving to another target updates the tooltip without leaving stale boxes.
- Leaving, scrolling, resizing, node removal, Escape, or mode exit dismisses it.

### Tooltip content

```text
東京
toukyou
```

- Original is smaller or muted but remains readable.
- Romanized reading is the primary line.
- Optional uncertainty text appears below: “Reading may be incomplete.”
- Maximum width: 320 px; wrap long lines.
- Position above the text when space permits, otherwise below, clamped to the visual viewport.
- The tooltip itself does not capture pointer input unless it contains an explicit action.

### Accessibility

- Hover cannot be the only trigger; keyboard focus or a later explicit inspect command is required.
- Avoid attaching focusability to every text node. Use existing focusable contexts and an explicit keyboard inspection pattern determined during Phase 4.
- Screen-reader announcement must not duplicate the source continuously.

## 13. Learning / Annotation Mode — later/experimental

### Visual treatment

- Preserve original Japanese as the dominant text.
- Place romanized reading above through semantic ruby where safe.
- Use the page's text color by default; reading may use a restrained inherited/muted value only when contrast can be established.
- Do not place colored chips around every word.
- Maintain source punctuation and avoid artificial line breaks.

### Ruby guidance

- Use `<ruby>` and `<rt>` semantics only after restoration and framework tests pass.
- `rt` uses roughly `0.62em`, medium weight, and compact line height.
- Respect vertical writing modes where browser behavior is usable; otherwise leave source unchanged or use Hover Mode.
- If annotation causes clipping or severe reflow in a host context, fall back to Replace or Hover according to product policy rather than forcing layout.

### Accessibility

- Test major screen readers for duplicate original/reading announcements.
- Provide a mode description in settings.
- Do not add `aria-label` replacements to page content as a shortcut.

## 14. Lens Mode overlay — later

### 14.1 Entry and selection

- Popup action: “Read text in an image” with a scan icon.
- Entering Lens visibly changes the cursor and adds a small instruction strip: “Drag around text. Esc to cancel.”
- Pointer selection uses a 2 px primary outline and a translucent neutral scrim outside the region.
- A click without a meaningful drag may select a named default region only if the interaction is clearly explained; otherwise do nothing and keep instructions visible.
- Keyboard users can choose “Scan visible area” or adjust a focusable selection rectangle with arrow keys in the Phase 5 design.

### 14.2 Processing state

- Freeze the selection outline while processing.
- Show a compact label near, not inside, the text region: “Reading image text on this device…”
- Do not use a fake percentage.
- Disable repeated capture until the current job finishes or is cancelled.
- Keep a visible Cancel action and support Escape.

### 14.3 Result boxes

- Each result uses a transparent or lightly tinted fixed box aligned to the recognized region.
- Romanized text appears on a solid high-contrast label attached above or below the box.
- Original OCR text may appear in smaller type within the label when it helps verification.
- Keep boxes from covering the original more than necessary.
- For dense text, merge line-level results rather than produce dozens of overlapping word labels.
- Low OCR confidence uses a dashed outline and explicit “Check text” wording. Color is supplemental.
- Results have one small top-level toolbar: Refresh, Clear, and Close. Do not add per-box action clutter in the first Lens release.

### 14.4 Geometry and invalidation

- Results are viewport-bound.
- On scroll, resize, zoom, navigation, video movement, or invalid geometry, fade/dismiss immediately and show “Page moved—scan again” only when useful.
- Never leave labels over unrelated content.

### 14.5 Empty and failure states

- No text found: “No readable Japanese text found in that area.” Offer Scan again.
- OCR unavailable: “Image reading is unavailable. Nothing was sent off this device.”
- Protected/blank capture: “This content could not be captured by the browser.”
- Partial reading: show available labels and one top-level warning; do not repeat warnings on every box.

## 15. Spotlight Mode — experimental

### Active treatment

- Enter through an explicit “Spotlight” experimental control.
- Show a restrained circular or rounded-rectangle guide around the pointer, approximately 160–220 px depending on the tested crop.
- Use a 2 px primary ring with a small “Spotlight” label; no glow, flashlight cone, or animated beam.
- The guide follows the pointer directly without animation.

### Stationary and processing treatment

- No OCR starts while the pointer is moving.
- After the stationary debounce, the ring changes to a processing state using text or a small progress mark.
- The result tooltip appears offset from the pointer and never directly under it.
- Pointer motion immediately marks the result stale and removes it.

### Exit and safety

- Escape, tab blur, scroll, click, or the popup control exits Spotlight.
- A persistent small status indicator makes it impossible to forget the mode is active.
- If capture is throttled, say “Pause to read” rather than showing an error.
- Never imply Spotlight can read protected or rapidly moving video reliably.

## 16. Component states

### Buttons

- Primary: filled brand color, high-contrast text.
- Secondary: surface background, structural border, normal text.
- Quiet: text/icon with transparent background for dismiss/lesser actions.
- Destructive is reserved for clearing permissions or data, not Show original.
- Hover, active, focus, disabled, and loading states must all be distinct.
- Disabled controls retain readable contrast and include nearby explanation when the reason is not obvious.

### Toggles and segmented controls

- Use a switch for persistent binary preferences such as Remember for this site.
- Use a labeled segmented control or explicit action for Original versus Romanized.
- Do not use a switch without visible text describing its effect.

### Status badges

- Use sparingly in the popup header or Lens toolbar.
- Include text: Original, On, Partial, or Experimental.
- Warning/error badges include an icon or label in addition to color.

## 17. Loading, disabled, and error behavior

### Loading

- Describe the actual stage: Checking page, Preparing Japanese readings, Romanizing new text, Capturing region, or Reading image text.
- Keep original content visible until a result is ready.
- Never replace text with blank placeholders or skeleton bars.
- If warm dynamic work is normally fast, avoid flashing a loading indicator for every lyric update; announce only sustained delays.

### Disabled

- A disabled global/site state says “Off for this site” or “Extension is off,” not merely “Disabled.”
- Show the safe consequence: “This page stays original.”
- When site permission is missing, the action to grant it remains a deliberate enabled control rather than an unexplained disabled toggle.

### Errors

- Lead with outcome: “The page was left original.”
- Then give the safe cause category: readings unavailable, page restricted, permission not granted, no readable image text, or content moved.
- Provide Retry only when the error is retryable.
- Do not show raw exception messages, worker names, HTTP terms, or page content.
- A partial failure does not use full danger styling; use warning styling and keep the successful view.

## 18. Accessibility specification

### Keyboard

- Popup tab order follows visual order.
- Enter/Space activates buttons, switches, and segmented controls according to native behavior.
- Escape closes page prompt, tooltip, Lens, and Spotlight when those components own the interaction.
- Do not install broad page shortcuts in the MVP unless the user configures them through browser commands.
- Lens provides a keyboard alternative to drag selection before release.

### Focus

- Never remove focus outlines without an equivalent visible ring.
- Injected prompts do not steal page focus.
- When a user explicitly opens Lens, focus moves to the Lens instruction/toolbar; on exit it returns to the invoking extension control where the platform permits.
- Removed overlays must not strand focus in detached content.

### Screen readers

- Popup status changes use a polite live region.
- Page prompt has a concise accessible label and does not repeatedly announce on DOM mutations.
- Loading indicators include readable text.
- Icons with adjacent text are decorative; icon-only controls have names.
- Replace Mode does not modify author ARIA labels. Its effect on spoken page text is documented.
- Hover and Learning modes require dedicated duplicate-reading tests.

### Contrast and visual adaptation

- Meet WCAG 2.2 AA for text, controls, icons that convey meaning, focus, and state boundaries.
- Test both themes, forced colors, high contrast, 200% and 400% zoom where applicable.
- Text reflows without horizontal scrolling inside the 320 px popup at 200% browser zoom when the platform allows.
- Do not encode OCR confidence, mode, or errors by hue alone.

### Motion and cognition

- Honor reduced motion.
- Avoid auto-dismiss for an actionable prompt while a user may be reading it. Informational status may fade only after it remains available long enough and is recoverable in the popup.
- Use consistent terms and control placement across states.
- Avoid countdowns, urgency, and repeated permission prompts.

## 19. Responsive and hostile-page behavior

- Injected UI styles live in a Shadow root and start with a scoped reset.
- Use a high but documented stacking layer within the extension root; do not participate in an arbitrary z-index arms race beyond what is necessary for visibility.
- Clamp prompts/tooltips to `visualViewport` and account for zoom and on-screen keyboards where relevant.
- If a page uses transformed roots or unusual writing modes, fixed top-frame UI still uses viewport coordinates.
- If host CSP or browser restrictions prevent injection, the popup explains the limitation.
- Extension UI must remain usable over both light and dark page content through its own opaque surface and border.
- Page styles must never leak into extension buttons, focus rings, or typography.

## 20. Phase-by-phase UI surface

### Phase 0

- Minimal status popup for development only.
- No injected page UI.

### Phase 1 (complete)

- Minimal popup start/stop controls.
- No remembered-site permission or polished prompt.

### Phase 2 (next)

- Existing controls show dynamic health in a development build.
- No new product surface is required for observer internals.

### Phase 3 — MVP

- Final popup states.
- Japanese detection and non-modal page prompt for authorized sites.
- Original/Romanized control.
- Remember for this site and permission explanation.
- Light/dark, keyboard, reduced motion, and error states.

### Phase 4

- Hover Mode and optional Learning experiment.
- Renderer setting becomes visible only for modes that pass acceptance.

### Phase 5

- Lens entry, region selection, processing, result overlay, invalidation, and OCR states.

### Phase 6

- Spotlight appears only under an Experimental label and explicit opt-in.

### Phase 7+

- Language choice remains compact; do not turn the popup into a long list. Show enabled/detected languages and place advanced configuration in the browser's extension options page only when necessary.

## 21. Design acceptance checklist

Before a user-visible phase is marked complete, verify:

- The primary action is obvious without reading documentation.
- The UI says romanize/transliterate, not translate.
- Current page view is unambiguous.
- Original content is one action away.
- First-use permission consequences are explained before the browser prompt.
- No page content appears in logs or error UI.
- Popup and injected UI work in light, dark, high-contrast, keyboard-only, reduced-motion, and 200% zoom checks.
- Focus is visible and returns predictably after overlays close.
- Extension UI is not transliterated by the extension.
- Loading text describes real work and does not flash on every small mutation.
- Partial reading and OCR uncertainty are honest without becoming noisy.
- Injected UI does not shift page layout or remain over unrelated content.
- No decorative element makes the utility feel like a dashboard or blocks the user's content.
