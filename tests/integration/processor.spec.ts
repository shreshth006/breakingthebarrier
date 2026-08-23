import { resolve } from "node:path";
import { chromium, expect, test } from "@playwright/test";

const projectRoot = resolve(import.meta.dirname, "../..");
const extensionPath = resolve(projectRoot, "dist");

test("packaged popup starts the local Lindera worker", async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    offline: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    let serviceWorker = context.serviceWorkers()[0];
    serviceWorker ??= await context.waitForEvent("serviceworker");

    const extensionId = new URL(serviceWorker.url()).host;
    const popup = await context.newPage();
    await popup.goto(
      `chrome-extension://${extensionId}/src/ui/popup/popup.html`,
    );

    await popup.getByRole("button", { name: "Check local processor" }).click();

    await expect(popup.getByRole("status")).toContainText(
      "Ready · Lindera 5.3.0 · WanaKana 5.3.1",
      { timeout: 12_000 },
    );
    await expect(popup.getByText("This build does not read")).toBeVisible();
  } finally {
    await context.close();
  }
});
