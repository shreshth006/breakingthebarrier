import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import {
  IPADIC_DIST_DIRECTORY,
  IPADIC_RUNTIME_FILES,
  readVerifiedIpadicArchive,
} from "./scripts/ipadic-archive.mjs";

const projectRoot = import.meta.dirname;
const licenseFiles = [
  "lindera-wasm-bundler-MIT.txt",
  "wanakana-MIT.txt",
] as const;

function requireDictionaryFile(
  files: ReadonlyMap<string, Buffer>,
  name: string,
): Buffer {
  const file = files.get(name);
  if (file === undefined) {
    throw new Error(`Verified IPADIC file is unavailable: ${name}`);
  }
  return file;
}

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "btb-manifest",
      async generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "manifest.json",
          source: readFileSync(resolve(projectRoot, "manifest.json"), "utf8"),
        });

        for (const licenseFile of licenseFiles) {
          this.emitFile({
            type: "asset",
            fileName: `third_party/licenses/${licenseFile}`,
            source: readFileSync(
              resolve(projectRoot, "third_party/licenses", licenseFile),
              "utf8",
            ),
          });
        }

        const dictionaryFiles = await readVerifiedIpadicArchive();
        for (const dictionaryFile of IPADIC_RUNTIME_FILES) {
          this.emitFile({
            type: "asset",
            fileName: `${IPADIC_DIST_DIRECTORY}/${dictionaryFile}`,
            source: requireDictionaryFile(dictionaryFiles, dictionaryFile),
          });
        }

        this.emitFile({
          type: "asset",
          fileName: "third_party/licenses/lindera-ipadic-5.3.0-NOTICE.txt",
          source: requireDictionaryFile(dictionaryFiles, "NOTICE.txt"),
        });
      },
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome109",
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: resolve(projectRoot, "src/ui/popup/popup.html"),
        offscreen: resolve(projectRoot, "src/processor/offscreen.html"),
        "service-worker": resolve(
          projectRoot,
          "src/background/service-worker.ts",
        ),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  worker: {
    format: "es",
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
