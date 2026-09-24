# Breaking The Barrier

> **Privacy-First, Local Webpage Transliteration Extension**  
> Read foreign text across the web in local, reversible transliteration (Romaji / Latin script) with word-by-word alignment and Zero network server dependencies.

---

## 🌟 Key Features

* **Dual Mode (Ruby Annotations)**:
  * Word-by-word token alignment using `<ruby>` and `<rt>` elements.
  * Transliterated readings float **directly above their corresponding original words**.
  * Styled in soft, high-contrast off-white (`#e2e8f0`) with subtle outline shadows for seamless legibility across dark and light web themes.
* **Replace Mode**:
  * Replaces original text in-place for fast, immersive reading.
* **Image Transliteration**:
  * Scans image accessibility tags (`alt`, `title`, `aria-label`) and attaches non-intrusive floating translucent overlay badges.
* **100% Offline & Local Privacy**:
  * Powered by local WebWorkers, WebAssembly (Lindera IPADIC dictionary for Japanese), and AnyAscii for universal language support (Punjabi, Hindi, Urdu, Cyrillic, Arabic, Korean, and 100+ scripts).
  * Zero tracking, zero telemetry, and zero external server calls.
* **Bounded DOM Observer & Yielded Scanning**:
  * Efficient slice-based TreeWalker DOM scanner that handles dynamic web apps (Spotify, YouTube, Wikipedia, social media) without lag.
  * `data-btb-ignore` attribute enforcement to prevent recursive scanner self-triggers.

---

## 🛠️ Architecture & Tech Stack

* **Framework & Build System**: TypeScript, Vite 8
* **Target Runtime**: Chrome Extension Manifest V3 (Chrome, Edge, Brave, Opera)
* **Japanese Engine**: Lindera WASM + IPADIC 5.3.0 dictionary running inside a dedicated Web Worker
* **Universal Engine**: AnyAscii 0.3.2 (Unicode-to-ASCII transliteration)
* **Test Suite**: Vitest (143 unit tests across 27 suites) + JSDOM
* **Permissions Model**: Least-privilege optional host permissions (`activeTab`, `scripting`, `storage`, `offscreen`)

---

## 🚀 Getting Started & Installation

### Prerequisites
* **Node.js** `>= 24.0.0`
* **npm** `>= 10.0.0`

### Build Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/breaking-the-barrier.git
   cd breaking-the-barrier
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the production extension**:
   ```bash
   npm run build
   ```
   *This command builds both the core extension assets and the self-contained IIFE content script (`dist/assets/content-script.js`).*

4. **Load into Google Chrome / Microsoft Edge**:
   1. Open `chrome://extensions` (or `edge://extensions`) in your browser.
   2. Enable **Developer mode** (toggle in the top-right corner).
   3. Click **Load unpacked**.
   4. Select the `dist/` directory inside this project folder.

---

## 🧪 Testing & Verification

Run the full automated test suite and distribution checks:

```bash
# Run unit test suite (143 tests)
npm run test

# Run TypeScript type check
npm run typecheck

# Verify distribution bundle integrity
npm run verify:dist

# Run all verification steps at once
npm run verify
```

---

## 📁 Repository Structure

```
├── manifest.json                 # Chrome Extension Manifest V3 configuration
├── vite.config.ts                # Main Vite build config (service worker, popup, offscreen)
├── vite.content.config.ts        # Content script IIFE build config
├── src/
│   ├── background/               # Service worker, session management & site policy
│   ├── content/                  # DOM controller, slice scanner & script bootstrap
│   ├── engines/                  # Lindera WASM Japanese engine & AnyAscii universal engine
│   ├── renderers/                # Annotation (Ruby token alignment) & Replace renderers
│   ├── storage/                  # Preference storage, schema & migrations
│   ├── ui/                       # Popup interface & in-page UI elements
│   └── shared/                   # Shared validation schemas & message contracts
├── tests/
│   └── unit/                     # Vitest unit test suites
└── scripts/                      # IPADIC dictionary verification & dist validation scripts
```

---

## 📄 License

MIT License © 2026 Breaking The Barrier Contributors.
