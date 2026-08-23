# Breaking the Barrier V1 — Historical Prototype (2024)

## Status

This directory is an inert archive. V1 is historical evidence of the product idea, not a technical foundation for Breaking the Barrier V2.

Nothing under `legacy/` may be imported, built, executed, packaged, tested as active code, or used as an implementation dependency. The V2 build and development workflow must not install or invoke the Python application retained here.

## What the prototype demonstrated

- A browser-extension popup could initiate Japanese-to-romaji conversion.
- A visible-tab screenshot could provide input for non-selectable text.
- OCR and transliteration could happen locally rather than through a cloud service.
- The result could be returned to the extension popup.

Its intended path was:

```text
popup screenshot capture
    -> local Flask endpoint
    -> native Japanese Tesseract OCR
    -> pykakasi
    -> one unpositioned romaji string in the popup
```

## What the prototype did not demonstrate

- Reading accessible DOM text directly.
- Updating text on the webpage.
- Handling SPA or media-site changes without a refresh.
- Reversible rendering or safe restoration.
- Positional OCR output or an overlay.
- A packaged, installation-free browser architecture.
- A tested build, dependency manifest, or release process.

## Archived files

- `manifest.json`, `popup.html`, `popup.js`, and `styles.css`: the original extension shell.
- `content.js`: the final empty content script.
- `Back end/app.py`: the original Flask, native Tesseract, and pykakasi service.

These files are preserved for historical reference. V2 starts from a clean browser-native TypeScript architecture described in the root planning documents.
