import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, test } from "@playwright/test";
import type { CDPSession } from "@playwright/test";
import type {
  HealthErrorResponse,
  TransliterationBatchResponse,
} from "../../src/shared/messages";

const projectRoot = resolve(import.meta.dirname, "../..");
const extensionPath = resolve(projectRoot, "dist");
const dictionaryCases = [
  { source: "星座になれたら", expected: "seiza ni naretara" },
  { source: "愛してる", expected: "aishiteru" },
  { source: "東京", expected: "toukyou" },
  { source: "龘", expected: "龘" },
  { source: "私は東京へ行く。", expected: "watashi wa toukyou e iku。" },
  { source: "山田太郎", expected: "yamada tarou" },
  { source: "ABC東京123", expected: "ABCtoukyou123" },
] as const;

async function readBrowserPssMiB(session: CDPSession): Promise<number> {
  const { processInfo } = await session.send("SystemInfo.getProcessInfo");
  const pssKiB = await Promise.all(
    processInfo.map(async ({ id }) => {
      try {
        const status = await readFile(
          `/proc/${String(id)}/smaps_rollup`,
          "utf8",
        );
        const match = /^Pss:\s+(\d+)\s+kB$/mu.exec(status);
        return match === null ? 0 : Number(match[1]);
      } catch {
        return 0;
      }
    }),
  );
  return pssKiB.reduce((total, value) => total + value, 0) / 1024;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, milliseconds);
  });
}

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

    const browser = context.browser();
    if (browser === null) {
      throw new Error("Persistent Chromium browser is unavailable");
    }
    const browserSession = await browser.newBrowserCDPSession();
    const baselinePssMiB = await readBrowserPssMiB(browserSession);

    const processorPromise = popup.evaluate(async () => {
      const requestId = crypto.randomUUID();
      const response: unknown = await chrome.runtime.sendMessage({
        protocolVersion: 1,
        target: "serviceWorker",
        type: "processor.ensure",
        requestId,
      });
      if (
        typeof response !== "object" ||
        response === null ||
        !("requestId" in response) ||
        response.requestId !== requestId ||
        !("measurements" in response) ||
        typeof response.measurements !== "object" ||
        response.measurements === null ||
        !("coldReadyMs" in response.measurements) ||
        !("warmBatchMs" in response.measurements) ||
        typeof response.measurements.coldReadyMs !== "number" ||
        typeof response.measurements.warmBatchMs !== "number"
      ) {
        throw new Error("Packaged processor returned no measurements");
      }
      return {
        coldReadyMs: response.measurements.coldReadyMs,
        warmBatchMs: response.measurements.warmBatchMs,
      };
    });

    const observedPssPromise = Promise.all(
      [50, 100, 200, 350, 500].map(async (milliseconds) => {
        await delay(milliseconds);
        return readBrowserPssMiB(browserSession);
      }),
    );
    const [measurements, observedPssMiB] = await Promise.all([
      processorPromise,
      observedPssPromise,
    ]);
    await delay(500);
    const steadyPssMiB = await readBrowserPssMiB(browserSession);
    const peakPssMiB = Math.max(...observedPssMiB, steadyPssMiB);
    const memory = {
      metric: "Linux Pss",
      baselineMiB: Number(baselinePssMiB.toFixed(1)),
      observedPeakDeltaMiB: Number((peakPssMiB - baselinePssMiB).toFixed(1)),
      steadyDeltaMiB: Number((steadyPssMiB - baselinePssMiB).toFixed(1)),
      budgetPassed:
        peakPssMiB - baselinePssMiB < 150 &&
        steadyPssMiB - baselinePssMiB < 150,
    };

    console.info("processor measurements", JSON.stringify(measurements));
    console.info("processor memory", JSON.stringify(memory));
    expect(measurements.coldReadyMs).toBeLessThanOrEqual(2_000);
    expect(measurements.warmBatchMs).toBeLessThanOrEqual(100);
    expect(memory.observedPeakDeltaMiB).toBeGreaterThan(0);
    expect(memory.steadyDeltaMiB).toBeGreaterThan(0);

    const batchResponse = await popup.evaluate(async (cases) => {
      const requestId = crypto.randomUUID();
      const response: unknown = await chrome.runtime.sendMessage({
        protocolVersion: 1,
        target: "serviceWorker",
        type: "transliteration.batch.request",
        requestId,
        items: cases.map(({ source }, index) => ({
          itemId: String(index),
          source,
          language: "ja",
          romanizationPolicy: "ascii-hepburn-v1",
        })),
      });
      return response as TransliterationBatchResponse;
    }, dictionaryCases);
    expect(batchResponse).toMatchObject({
      protocolVersion: 1,
      target: "content",
      type: "transliteration.batch.response",
    });
    expect(batchResponse.results).toHaveLength(dictionaryCases.length);
    for (const [index, expected] of dictionaryCases.entries()) {
      const result = batchResponse.results[index];
      if (result === undefined) {
        throw new Error(`Missing transliteration result ${String(index)}`);
      }
      expect(result).toMatchObject({
        itemId: String(index),
        source: expected.source,
        rendered: expected.expected,
        versions: {
          engine: "5.3.0",
          dictionary: "5.3.0",
          romanizationPolicy: "ascii-hepburn-v1",
          spacingPolicy: "japanese-spacing-v1",
        },
      });
      expect(result.segments.map((segment) => segment.source).join("")).toBe(
        expected.source,
      );
    }

    const invalidResponse = await popup.evaluate(async () => {
      const requestId = crypto.randomUUID();
      const response: unknown = await chrome.runtime.sendMessage({
        protocolVersion: 1,
        target: "serviceWorker",
        type: "transliteration.batch.request",
        requestId,
        items: Array.from({ length: 101 }, (_, index) => ({
          itemId: String(index),
          source: "東京",
          language: "ja",
          romanizationPolicy: "ascii-hepburn-v1",
        })),
      });
      return response as HealthErrorResponse;
    });
    expect(invalidResponse).toMatchObject({
      target: "content",
      type: "health.error",
      error: {
        code: "invalid-message",
        retryable: false,
      },
    });

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
