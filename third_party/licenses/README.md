# Third-party notices

The active Phase 0 build packages these production dependencies:

- `lindera-wasm-bundler` 5.3.0 — MIT — <https://github.com/lindera/lindera>
- `wanakana` 5.3.1 — MIT — <https://github.com/WaniKani/WanaKana>
- Lindera IPADIC 5.3.0 (MeCab IPADIC 2.7.0-20070801 data) — terms in
  `lindera-ipadic-5.3.0-NOTICE.txt` — <https://github.com/lindera/lindera/releases/tag/v5.3.0>

The corresponding license and notice texts are copied into this directory and
emitted in the unpacked extension under `third_party/licenses/`. Dictionary
provenance, the official release digest, and the committed archive location are
recorded in `third_party/ipadic-5.3.0.json`; `npm run assets:verify` checks the
archive, every extracted file, format version, and schema without network
access.
