import { resolve } from "node:path";
import { defineConfig } from "vite";

const projectRoot = import.meta.dirname;

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    target: "chrome109",
    sourcemap: false,
    lib: {
      entry: resolve(projectRoot, "src/content/bootstrap.ts"),
      name: "BreakingTheBarrierContent",
      formats: ["iife"],
      fileName: () => "content-script.js",
    },
    rollupOptions: {
      output: {
        entryFileNames: "assets/content-script.js",
      },
    },
  },
});
