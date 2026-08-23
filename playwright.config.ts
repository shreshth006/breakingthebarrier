import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/integration",
  outputDir: "test-results",
  reporter: "list",
  timeout: 30_000,
  workers: 1,
  use: {
    trace: "retain-on-failure",
  },
});
