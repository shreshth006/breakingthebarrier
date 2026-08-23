import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const projectRoot = import.meta.dirname;
const licenseFiles = [
  "lindera-wasm-bundler-MIT.txt",
  "wanakana-MIT.txt",
] as const;

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "btb-manifest",
      generateBundle() {
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
