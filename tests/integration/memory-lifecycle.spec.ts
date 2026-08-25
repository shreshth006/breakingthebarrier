import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, test } from "@playwright/test";
import type { BrowserContext, CDPSession, Page } from "@playwright/test";
import type {
  ProcessorEnsureResponse,
  ProcessorMemoryDiagnosticResponse,
  ProcessorMemoryStage,
  ProcessorReleaseResponse,
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

interface ExtensionHarness {
  readonly context: BrowserContext;
  readonly popup: Page;
  readonly browserSession: CDPSession;
  readonly chromiumVersion: string;
}

interface LifecycleRun {
  readonly run: number;
  readonly chromiumVersion: string;
  readonly coldReadyMs: number;
  readonly warm100Ms: number;
  readonly baselinePssMiB: number;
  readonly peakIncrementalPssMiB: number;
  readonly steadyIncrementalPssMiB: number;
  readonly postUnloadIncrementalPssMiB: number;
  readonly reclaimedPssMiB: number;
}

interface StageSample {
  readonly stage: ProcessorMemoryStage;
  readonly incrementalPssMiB: number;
}

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

async function resolveWhileSampling<T>(
  operation: Promise<T>,
  sample: () => Promise<void>,
): Promise<T> {
  const completion = operation.then((value) => ({
    state: "complete" as const,
    value,
  }));
  for (;;) {
    const result = await Promise.race([
      completion,
      delay(20).then(() => ({ state: "sampling" as const })),
    ]);
    if (result.state === "complete") {
      return result.value;
    }
    await sample();
  }
}

function oneDecimal(value: number): number {
  return Number(value.toFixed(1));
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted[middle] ?? Number.NaN;
}

async function launchExtension(): Promise<ExtensionHarness> {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    offline: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
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
  return {
    context,
    popup,
    browserSession,
    chromiumVersion: browser.version(),
  };
}

async function countOffscreenDocuments(popup: Page): Promise<number> {
  return popup.evaluate(async () => {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    });
    return contexts.length;
  });
}

async function requestProcessor(
  popup: Page,
): Promise<ProcessorEnsureResponse> {
  return popup.evaluate(async () => {
    const requestId = crypto.randomUUID();
    const response: unknown = await chrome.runtime.sendMessage({
      protocolVersion: 1,
      target: "serviceWorker",
      type: "processor.ensure",
      requestId,
    });
    return response as ProcessorEnsureResponse;
  });
}

async function runGoldenBatch(popup: Page): Promise<void> {
  const response = await popup.evaluate(async (cases) => {
    const requestId = crypto.randomUUID();
    const result: unknown = await chrome.runtime.sendMessage({
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
    return result as TransliterationBatchResponse;
  }, dictionaryCases);

  expect(response.type).toBe("transliteration.batch.response");
  expect(response.results.map((result) => result.rendered)).toEqual(
    dictionaryCases.map(({ expected }) => expected),
  );
  for (const result of response.results) {
    expect(result.segments.map((segment) => segment.source).join("")).toBe(
      result.source,
    );
  }
}

async function releaseProcessor(popup: Page): Promise<ProcessorReleaseResponse> {
  return popup.evaluate(async () => {
    const requestId = crypto.randomUUID();
    const response: unknown = await chrome.runtime.sendMessage({
      protocolVersion: 1,
      target: "serviceWorker",
      type: "processor.release",
      requestId,
    });
    return response as ProcessorReleaseResponse;
  });
}

async function runLifecycle(run: number): Promise<LifecycleRun> {
  const harness = await launchExtension();
  try {
    await delay(300);
    expect(await countOffscreenDocuments(harness.popup)).toBe(0);
    const baselinePssMiB = await readBrowserPssMiB(harness.browserSession);
    const observedPssMiB: number[] = [];
    const processorPromise = requestProcessor(harness.popup);
    const processor = await resolveWhileSampling(
      processorPromise,
      async () => {
        observedPssMiB.push(
          await readBrowserPssMiB(harness.browserSession),
        );
      },
    );
    observedPssMiB.push(await readBrowserPssMiB(harness.browserSession));
    expect(processor.type).toBe("processor.ensure.response");
    expect(await countOffscreenDocuments(harness.popup)).toBe(1);

    await runGoldenBatch(harness.popup);
    await delay(750);
    const steadyPssMiB = await readBrowserPssMiB(harness.browserSession);
    observedPssMiB.push(steadyPssMiB);

    const release = await releaseProcessor(harness.popup);
    expect(release).toMatchObject({
      target: "content",
      type: "processor.release.response",
      released: true,
    });
    await expect
      .poll(() => countOffscreenDocuments(harness.popup), { timeout: 5_000 })
      .toBe(0);
    await delay(1_000);
    const postUnloadPssMiB = await readBrowserPssMiB(harness.browserSession);

    return {
      run,
      chromiumVersion: harness.chromiumVersion,
      coldReadyMs: processor.measurements.coldReadyMs,
      warm100Ms: processor.measurements.warmBatchMs,
      baselinePssMiB: oneDecimal(baselinePssMiB),
      peakIncrementalPssMiB: oneDecimal(
        Math.max(...observedPssMiB) - baselinePssMiB,
      ),
      steadyIncrementalPssMiB: oneDecimal(
        steadyPssMiB - baselinePssMiB,
      ),
      postUnloadIncrementalPssMiB: oneDecimal(
        postUnloadPssMiB - baselinePssMiB,
      ),
      reclaimedPssMiB: oneDecimal(steadyPssMiB - postUnloadPssMiB),
    };
  } finally {
    await harness.context.close();
  }
}

async function runStagedDiagnostic(): Promise<{
  readonly stages: readonly StageSample[];
  readonly postUnloadIncrementalPssMiB: number;
}> {
  const harness = await launchExtension();
  try {
    await delay(300);
    const baselinePssMiB = await readBrowserPssMiB(harness.browserSession);
    const requestId = `memory-${crypto.randomUUID()}`;
    await harness.popup.evaluate((id) => {
      const diagnosticScope = globalThis as typeof globalThis & {
        btbMemoryStages?: string[];
      };
      diagnosticScope.btbMemoryStages = [];
      chrome.runtime.onMessage.addListener((message: unknown) => {
        if (
          typeof message === "object" &&
          message !== null &&
          "protocolVersion" in message &&
          message.protocolVersion === 1 &&
          "target" in message &&
          message.target === "diagnostics" &&
          "type" in message &&
          message.type === "processor.memory.stage" &&
          "requestId" in message &&
          message.requestId === id &&
          "stage" in message &&
          typeof message.stage === "string"
        ) {
          diagnosticScope.btbMemoryStages?.push(message.stage);
        }
      });
    }, requestId);

    const diagnosticPromise = harness.popup.evaluate(async (id) => {
      const response: unknown = await chrome.runtime.sendMessage({
        protocolVersion: 1,
        target: "serviceWorker",
        type: "processor.memory.diagnostic",
        requestId: id,
      });
      return response as ProcessorMemoryDiagnosticResponse;
    }, requestId);
    const stages: StageSample[] = [];
    const seen = new Set<string>();
    const diagnostic = await resolveWhileSampling(
      diagnosticPromise,
      async () => {
        const pendingStages = await harness.popup.evaluate(() => {
          const diagnosticScope = globalThis as typeof globalThis & {
            btbMemoryStages?: string[];
          };
          return diagnosticScope.btbMemoryStages?.splice(0) ?? [];
        });
        for (const stage of pendingStages) {
          if (!seen.has(stage)) {
            seen.add(stage);
            stages.push({
              stage: stage as ProcessorMemoryStage,
              incrementalPssMiB: oneDecimal(
                (await readBrowserPssMiB(harness.browserSession)) -
                  baselinePssMiB,
              ),
            });
          }
        }
      },
    );
    expect(diagnostic.type).toBe("processor.memory.diagnostic.response");
    expect(stages.map(({ stage }) => stage)).toEqual([
      "worker-created",
      "wasm-initialized",
      "dictionary-files-fetched",
      "dictionary-constructed",
      "tokenizer-constructed",
      "temporary-buffers-released",
      "batch-completed",
      "stabilized",
    ]);

    await releaseProcessor(harness.popup);
    await expect
      .poll(() => countOffscreenDocuments(harness.popup), { timeout: 5_000 })
      .toBe(0);
    await delay(1_000);
    const postUnloadPssMiB = await readBrowserPssMiB(harness.browserSession);
    const recreated = await requestProcessor(harness.popup);
    expect(recreated.type).toBe("processor.ensure.response");
    expect(await countOffscreenDocuments(harness.popup)).toBe(1);
    await releaseProcessor(harness.popup);
    await expect
      .poll(() => countOffscreenDocuments(harness.popup), { timeout: 5_000 })
      .toBe(0);
    return {
      stages,
      postUnloadIncrementalPssMiB: oneDecimal(
        postUnloadPssMiB - baselinePssMiB,
      ),
    };
  } finally {
    await harness.context.close();
  }
}

test("profiles and releases the packaged Japanese processor", async () => {
  test.setTimeout(120_000);

  const diagnostic = await runStagedDiagnostic();
  console.info("processor staged memory", JSON.stringify(diagnostic));

  const runs: LifecycleRun[] = [];
  for (let run = 1; run <= 5; run += 1) {
    runs.push(await runLifecycle(run));
  }

  const summary = {
    environment: {
      platform: process.platform,
      architecture: process.arch,
      chromium: runs[0]?.chromiumVersion ?? "unknown",
      metric: "sum of active Chromium process Linux PSS",
    },
    runs,
    range: {
      coldReadyMs: [
        Math.min(...runs.map(({ coldReadyMs }) => coldReadyMs)),
        Math.max(...runs.map(({ coldReadyMs }) => coldReadyMs)),
      ],
      warm100Ms: [
        Math.min(...runs.map(({ warm100Ms }) => warm100Ms)),
        Math.max(...runs.map(({ warm100Ms }) => warm100Ms)),
      ],
      peakIncrementalPssMiB: [
        Math.min(...runs.map(({ peakIncrementalPssMiB }) => peakIncrementalPssMiB)),
        Math.max(...runs.map(({ peakIncrementalPssMiB }) => peakIncrementalPssMiB)),
      ],
      steadyIncrementalPssMiB: [
        Math.min(...runs.map(({ steadyIncrementalPssMiB }) => steadyIncrementalPssMiB)),
        Math.max(...runs.map(({ steadyIncrementalPssMiB }) => steadyIncrementalPssMiB)),
      ],
      postUnloadIncrementalPssMiB: [
        Math.min(
          ...runs.map(
            ({ postUnloadIncrementalPssMiB }) => postUnloadIncrementalPssMiB,
          ),
        ),
        Math.max(
          ...runs.map(
            ({ postUnloadIncrementalPssMiB }) => postUnloadIncrementalPssMiB,
          ),
        ),
      ],
    },
    median: {
      coldReadyMs: median(runs.map(({ coldReadyMs }) => coldReadyMs)),
      warm100Ms: median(runs.map(({ warm100Ms }) => warm100Ms)),
      peakIncrementalPssMiB: median(
        runs.map(({ peakIncrementalPssMiB }) => peakIncrementalPssMiB),
      ),
      steadyIncrementalPssMiB: median(
        runs.map(({ steadyIncrementalPssMiB }) => steadyIncrementalPssMiB),
      ),
      postUnloadIncrementalPssMiB: median(
        runs.map(({ postUnloadIncrementalPssMiB }) =>
          postUnloadIncrementalPssMiB,
        ),
      ),
    },
  };
  console.info("processor five-run lifecycle", JSON.stringify(summary));

  for (const run of runs) {
    expect(run.coldReadyMs).toBeLessThanOrEqual(2_000);
    expect(run.warm100Ms).toBeLessThanOrEqual(100);
    expect(run.peakIncrementalPssMiB).toBeLessThanOrEqual(180);
    expect(run.steadyIncrementalPssMiB).toBeLessThanOrEqual(180);
    expect(run.postUnloadIncrementalPssMiB).toBeLessThan(30);
    expect(run.reclaimedPssMiB).toBeGreaterThan(
      run.steadyIncrementalPssMiB * 0.7,
    );
  }
});
