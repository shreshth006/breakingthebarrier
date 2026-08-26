import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, test } from "@playwright/test";
import type { CDPSession } from "@playwright/test";

const projectRoot = resolve(import.meta.dirname, "../..");
const extensionPath = resolve(projectRoot, "dist");
const fixturePath = resolve(
  projectRoot,
  "tests/fixtures/pages/static-article.html",
);
const hardeningFixturePath = resolve(
  projectRoot,
  "tests/fixtures/pages/hardening-article.html",
);
const dynamicFixturePath = resolve(
  projectRoot,
  "tests/fixtures/pages/dynamic-article.html",
);

async function readBrowserPssMiB(session: CDPSession): Promise<number> {
  const { processInfo } = await session.send("SystemInfo.getProcessInfo");
  const pssKiB = await Promise.all(
    processInfo.map(async ({ id }) => {
      try {
        const status = await readFile(`/proc/${String(id)}/smaps_rollup`, "utf8");
        const match = /^Pss:\s+(\d+)\s+kB$/mu.exec(status);
        return match === null ? 0 : Number(match[1]);
      } catch {
        return 0;
      }
    }),
  );
  return pssKiB.reduce((total, value) => total + value, 0) / 1024;
}

async function readRendererRetainedMiB(session: CDPSession): Promise<number> {
  const usage = await session.send("Runtime.getHeapUsage");
  return (
    (usage.usedSize +
      usage.embedderHeapUsedSize +
      usage.backingStorageSize) /
    (1024 * 1024)
  );
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, milliseconds);
  });
}

test("action injection romanizes a static page locally and restores it", async () => {
  const fixture = await readFile(fixturePath);
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(fixture);
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Fixture server did not bind a TCP port");
  }

  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    let serviceWorker = context.serviceWorkers()[0];
    serviceWorker ??= await context.waitForEvent("serviceworker");
    const extensionId = new URL(serviceWorker.url()).host;
    const page = await context.newPage();
    const fixtureUrl = `http://127.0.0.1:${String(address.port)}/article`;
    await page.goto(fixtureUrl);
    await page.bringToFront();

    const browser = context.browser();
    if (browser === null) {
      throw new Error("Persistent Chromium browser is unavailable");
    }
    const browserSession = await browser.newBrowserCDPSession();
    const { targetInfos } = await browserSession.send("Target.getTargets", {
      filter: [{ type: "tab", exclude: false }, { exclude: true }],
    });
    const pageTarget = targetInfos.find(
      (target) => target.type === "tab" && target.url === fixtureUrl,
    );
    if (pageTarget === undefined) {
      throw new Error(
        `Could not resolve the static fixture target: ${JSON.stringify(
          targetInfos.map(({ targetId, type, url }) => ({ targetId, type, url })),
        )}`,
      );
    }

    const uploadedRequests: string[] = [];
    context.on("request", (request) => {
      if (/^https?:/u.test(request.url())) {
        uploadedRequests.push(request.url());
      }
    });
    await context.setOffline(true);

    await browserSession.send("Extensions.triggerAction", {
      id: extensionId,
      targetId: pageTarget.targetId,
    });
    const extensionControl = await context.newPage();
    await extensionControl.goto(
      `chrome-extension://${extensionId}/src/ui/popup/popup.html`,
    );
    await page.bringToFront();
    const startSummary: unknown = await extensionControl.evaluate(async () => {
      const requestId = crypto.randomUUID();
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id === undefined) {
        throw new Error("No active fixture tab");
      }
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        files: ["assets/content-script.js"],
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        files: ["assets/content-script.js"],
      });
      const response: unknown = await chrome.tabs.sendMessage(
        tab.id,
        {
          protocolVersion: 1,
          target: "content",
          type: "content.command",
          requestId,
          command: "start",
        },
        { frameId: 0 },
      );
      return response;
    });
    expect(startSummary).toMatchObject({
      state: "active",
      eligibleNodes: 3,
      processedNodes: 3,
      failedNodes: 0,
    });
    await expect(page.locator("#headline")).toHaveText("seiza ni naretara", {
      timeout: 15_000,
    });
    await expect(page.locator("#mixed")).toHaveText(
      "  English aishiteru 123 🎵  ",
      { useInnerText: false },
    );
    await expect(page.locator("#interactive")).toHaveText("toukyou");
    await expect(page.locator("#code")).toHaveText("東京");
    await expect(page.locator("#pre")).toHaveText("愛してる");
    await expect(page.locator("#editable")).toHaveText("東京");
    await expect(page.locator("#ignored")).toHaveText("愛してる");
    await expect(page.locator("#hidden")).toHaveText("東京");
    await expect(page.locator("#article")).toHaveAttribute(
      "data-page-owned",
      "preserved",
    );

    await page.bringToFront();
    const stopSummary: unknown = await extensionControl.evaluate(async () => {
      const requestId = crypto.randomUUID();
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id === undefined) {
        throw new Error("No active fixture tab");
      }
      const response: unknown = await chrome.tabs.sendMessage(
        tab.id,
        {
          protocolVersion: 1,
          target: "content",
          type: "content.command",
          requestId,
          command: "stop",
        },
        { frameId: 0 },
      );
      if (await chrome.offscreen.hasDocument()) {
        await chrome.offscreen.closeDocument();
      }
      return response;
    });
    expect(stopSummary).toMatchObject({
      state: "original",
      eligibleNodes: 0,
      processedNodes: 0,
      failedNodes: 0,
    });
    await expect(page.locator("#headline")).toHaveText("星座になれたら");
    await expect(page.locator("#mixed")).toHaveText(
      "  English 愛してる 123 🎵  ",
      { useInnerText: false },
    );
    await expect(page.locator("#interactive")).toHaveText("東京");
    const preservation = await page.evaluate(() => {
      const button = document.querySelector("#interactive");
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return {
        sameNode: button?.firstChild === window.fixtureOriginalNode,
        clicks: window.fixtureClicks,
      };
    });
    expect(preservation).toEqual({ sameNode: true, clicks: 1 });
    expect(uploadedRequests).toEqual([]);
  } finally {
    await context.close();
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => {
        if (error === undefined) {
          resolveClose();
        } else {
          rejectClose(error);
        }
      });
    });
  }
});

test("realistic Phase 1 fixture preserves counters, loanwords, boundaries, and compounds", async () => {
  const fixture = await readFile(hardeningFixturePath);
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(fixture);
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Hardening fixture server did not bind a TCP port");
  }

  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    let serviceWorker = context.serviceWorkers()[0];
    serviceWorker ??= await context.waitForEvent("serviceworker");
    const extensionId = new URL(serviceWorker.url()).host;
    const page = await context.newPage();
    const fixtureUrl = `http://127.0.0.1:${String(address.port)}/hardening`;
    await page.goto(fixtureUrl);
    await page.bringToFront();

    const browser = context.browser();
    if (browser === null) {
      throw new Error("Persistent Chromium browser is unavailable");
    }
    const browserSession = await browser.newBrowserCDPSession();
    const { targetInfos } = await browserSession.send("Target.getTargets", {
      filter: [{ type: "tab", exclude: false }, { exclude: true }],
    });
    const pageTarget = targetInfos.find(
      (target) => target.type === "tab" && target.url === fixtureUrl,
    );
    if (pageTarget === undefined) {
      throw new Error("Could not resolve the hardening fixture tab target");
    }

    const uploadedRequests: string[] = [];
    context.on("request", (request) => {
      if (/^https?:/u.test(request.url())) {
        uploadedRequests.push(request.url());
      }
    });
    await context.setOffline(true);
    await browserSession.send("Extensions.triggerAction", {
      id: extensionId,
      targetId: pageTarget.targetId,
    });

    const extensionControl = await context.newPage();
    await extensionControl.goto(
      `chrome-extension://${extensionId}/src/ui/popup/popup.html`,
    );
    await page.bringToFront();
    const startSummary: unknown = await extensionControl.evaluate(async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id === undefined) {
        throw new Error("No active hardening fixture tab");
      }
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        files: ["assets/content-script.js"],
      });
      const response: unknown = await chrome.tabs.sendMessage(
        tab.id,
        {
          protocolVersion: 1,
          target: "content",
          type: "content.command",
          requestId: crypto.randomUUID(),
          command: "start",
        },
        { frameId: 0 },
      );
      return response;
    });
    expect(startSummary).toMatchObject({
      state: "active",
      eligibleNodes: 15,
      processedNodes: 15,
      failedNodes: 0,
    });
    await expect(page.locator("#inline-boundaries")).toHaveText(
      "wikipedia wa dare demo henshuu dekiru furii hyakka jiten desu",
    );
    await expect(page.locator("#counters")).toHaveText(
      "1928 nen 2024 nen 2 gatsu 29 nichi 490 nin 12 mei 24 jikan dai 1 kai",
    );
    await expect(page.locator("#loanwords")).toHaveText(
      "faasuto raito fikushon infomeeshon wikipedia",
    );
    await expect(page.locator("#unknown-compounds")).toHaveText(
      "巨椋池 諏訪頼嗣 toukyou",
    );
    await expect(page.locator("#punctuation")).toHaveText(
      "toukyou。desu English 123 🎵",
      { useInnerText: false },
    );
    await expect(page.locator("#phonetics")).toHaveText(
      "takasegawa nijouen / genryuuteien / natte",
    );
    await expect(page.locator("#cookie")).toHaveText(
      "Cookie ni kansuru seimei",
    );
    await expect(page.locator("#latin-left")).toHaveText("toukyou ABC");
    await expect(page.locator("#latin-right")).toHaveText("ABC toukyou");
    await expect(page.locator("#excluded")).toHaveText("ファースト 東京");
    await expect(page.locator("#page-owned")).toHaveAttribute(
      "data-page-owned",
      "preserved",
    );

    const identity = await page.evaluate(() => {
      const node = document.querySelector("#page-owned")?.firstChild;
      return {
        sameNode: node === window.hardeningOriginalNode,
        clicks: window.hardeningClicks,
      };
    });
    expect(identity).toEqual({ sameNode: true, clicks: 0 });

    await page.bringToFront();
    const stopSummary: unknown = await extensionControl.evaluate(async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id === undefined) {
        throw new Error("No active hardening fixture tab");
      }
      const response: unknown = await chrome.tabs.sendMessage(
        tab.id,
        {
          protocolVersion: 1,
          target: "content",
          type: "content.command",
          requestId: crypto.randomUUID(),
          command: "stop",
        },
        { frameId: 0 },
      );
      if (await chrome.offscreen.hasDocument()) {
        await chrome.offscreen.closeDocument();
      }
      return response;
    });
    expect(stopSummary).toMatchObject({ state: "original" });
    await expect(page.locator("#inline-boundaries")).toHaveText(
      "ウィキペディアは誰でも編集できるフリー百科事典です",
    );
    await expect(page.locator("#counters")).toHaveText(
      "1928年 2024年 2月29日 490人 12名 24時間 第1回",
    );
    await expect(page.locator("#loanwords")).toHaveText(
      "ファーストライト フィクション インフォメーション ウィキペディア",
    );
    await expect(page.locator("#unknown-compounds")).toHaveText(
      "巨椋池 諏訪頼嗣 東京",
    );
    await expect(page.locator("#phonetics")).toHaveText(
      "たかせがわ にじょうえん / げんりゅうていえん / なって",
    );
    await expect(page.locator("#cookie")).toHaveText("Cookieに関する声明");
    await expect(page.locator("#latin-left")).toHaveText("東京ABC");
    await expect(page.locator("#latin-right")).toHaveText("ABC東京");
    const restored = await page.evaluate(() => {
      const node = document.querySelector("#page-owned")?.firstChild;
      document.querySelector("#page-owned")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      return {
        sameNode: node === window.hardeningOriginalNode,
        clicks: window.hardeningClicks,
      };
    });
    expect(restored).toEqual({ sameNode: true, clicks: 1 });
    expect(uploadedRequests).toEqual([]);
  } finally {
    await context.close();
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => {
        if (error === undefined) {
          resolveClose();
        } else {
          rejectClose(error);
        }
      });
    });
  }
});

test("Phase 2 observes dynamic text, subtrees, replacements, exclusions, and latest-source restore", async () => {
  const fixture = await readFile(dynamicFixturePath);
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(fixture);
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Dynamic fixture server did not bind a TCP port");
  }

  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  try {
    let serviceWorker = context.serviceWorkers()[0];
    serviceWorker ??= await context.waitForEvent("serviceworker");
    const extensionId = new URL(serviceWorker.url()).host;
    const page = await context.newPage();
    const fixtureUrl = `http://127.0.0.1:${String(address.port)}/dynamic`;
    await page.goto(fixtureUrl);
    const browser = context.browser();
    if (browser === null) throw new Error("Persistent Chromium browser is unavailable");
    const browserSession = await browser.newBrowserCDPSession();
    const { targetInfos } = await browserSession.send("Target.getTargets", {
      filter: [{ type: "tab", exclude: false }, { exclude: true }],
    });
    const pageTarget = targetInfos.find(
      (target) => target.type === "tab" && target.url === fixtureUrl,
    );
    if (pageTarget === undefined) throw new Error("Could not resolve dynamic fixture target");
    await context.setOffline(true);
    await browserSession.send("Extensions.triggerAction", {
      id: extensionId,
      targetId: pageTarget.targetId,
    });
    const extensionControl = await context.newPage();
    await extensionControl.goto(
      `chrome-extension://${extensionId}/src/ui/popup/popup.html`,
    );
    await page.bringToFront();
    const startSummary: unknown = await extensionControl.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) throw new Error("No active dynamic fixture tab");
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        files: ["assets/content-script.js"],
      });
      const response: unknown = await chrome.tabs.sendMessage(
        tab.id,
        {
          protocolVersion: 1,
          target: "content",
          type: "content.command",
          requestId: crypto.randomUUID(),
          command: "start",
        },
        { frameId: 0 },
      );
      return response;
    });
    expect(startSummary).toMatchObject({
      state: "active",
      eligibleNodes: 1,
      processedNodes: 1,
      failedNodes: 0,
    });
    await expect(page.locator("#initial")).toHaveText("toukyou");

    await page.evaluate(() => {
      const initial = document.querySelector("#initial")?.firstChild;
      if (!(initial instanceof Text)) throw new Error("Missing initial text node");
      initial.data = "大阪";
    });
    await expect(page.locator("#initial")).toHaveText("oosaka");

    await page.evaluate(() => {
      const lyrics = document.querySelector("#lyrics");
      const root = document.querySelector("#dynamic-root");
      if (lyrics === null || root === null) throw new Error("Missing dynamic nodes");
      lyrics.textContent = "星座になれたら";
      const subtree = document.createElement("section");
      subtree.innerHTML = "<span>愛してる</span><span>東京</span>";
      root.append(subtree);
    });
    await expect(page.locator("#lyrics")).toHaveText("seiza ni naretara");
    await expect(page.locator("#dynamic-root section")).toHaveText(
      "aishiteru toukyou",
    );
    await page.evaluate(() => history.pushState({}, "", "#lyrics-next"));

    await page.evaluate(() => {
      const root = document.querySelector("#dynamic-root");
      if (root === null) throw new Error("Missing dynamic root");
      const stress = document.createElement("section");
      stress.id = "mutation-stress";
      stress.innerHTML = Array.from(
        { length: 1_000 },
        () => "<span data-stress>東京</span>",
      ).join("");
      root.append(stress);
      window.dynamicStressStart = performance.now();
      window.dynamicLongTasks = [];
      if ("PerformanceObserver" in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.dynamicLongTasks.push(entry.duration);
          }
        });
        observer.observe({ type: "longtask" });
      }
    });
    await expect(page.locator("#mutation-stress [data-stress]")).toHaveCount(1_000);
    await expect
      .poll(
        async () =>
          page
            .locator("#mutation-stress [data-stress]")
            .evaluateAll((nodes) =>
              nodes.filter((node) => node.textContent.trim() === "toukyou").length,
            ),
        { timeout: 10_000 },
      )
      .toBe(1_000);
    const stressSummary = await page.evaluate(() => ({
      nodes: document.querySelectorAll("#mutation-stress [data-stress]").length,
      longTasks: window.dynamicLongTasks.length,
      drainMs: performance.now() - window.dynamicStressStart,
    }));
    expect(stressSummary.nodes).toBe(1_000);
    expect(stressSummary.longTasks).toBe(0);
    expect(stressSummary.drainMs).toBeLessThan(10_000);
    console.log("dynamic mutation stress", stressSummary);

    await page.evaluate(() => {
      const replacement = document.createElement("span");
      replacement.textContent = "今日はいい天気です";
      const replacementRoot = document.querySelector("#replacement");
      const exclusions = document.querySelector("#exclusions");
      if (replacementRoot === null || exclusions === null) {
        throw new Error("Missing dynamic replacement nodes");
      }
      replacementRoot.replaceChildren(replacement);
      exclusions.innerHTML =
        "<code>東京</code><pre>愛してる</pre><input value='東京'><span contenteditable='true'>大阪</span>";
    });
    await expect(page.locator("#replacement")).toHaveText(
      "kyou wa ii tenkidesu",
    );
    await expect(page.locator("#exclusions code")).toHaveText("東京");
    await expect(page.locator("#exclusions pre")).toHaveText("愛してる");
    await expect(page.locator("#exclusions input")).toHaveValue("東京");
    await expect(page.locator("#exclusions span")).toHaveText("大阪");

    await page.evaluate(() => {
      const initial = document.querySelector("#initial")?.firstChild;
      if (!(initial instanceof Text)) throw new Error("Missing initial text node");
      initial.data = "京都";
    });
    await expect(page.locator("#initial")).toHaveText("kyouto");

    await page.bringToFront();
    const stopSummary: unknown = await extensionControl.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) throw new Error("No active dynamic fixture tab");
      const response: unknown = await chrome.tabs.sendMessage(
        tab.id,
        {
          protocolVersion: 1,
          target: "content",
          type: "content.command",
          requestId: crypto.randomUUID(),
          command: "stop",
        },
        { frameId: 0 },
      );
      return response;
    });
    expect(stopSummary).toMatchObject({ state: "original" });
    await expect(page.locator("#initial")).toHaveText("京都");
    await expect(page.locator("#lyrics")).toHaveText("星座になれたら");
    await expect(page.locator("#replacement")).toHaveText("今日はいい天気です");
  } finally {
    await context.close();
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => (error === undefined ? resolveClose() : rejectClose(error)));
    });
  }
});

test("5,000-node scan stays sliced and within the page-side memory budget", async () => {
  const largeFixture = `<!doctype html><html lang="ja"><body><main>${Array.from(
    { length: 5_000 },
    (_, index) => `<span data-index="${String(index)}">東京</span>`,
  ).join("")}</main></body></html>`;
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(largeFixture);
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Large fixture server did not bind a TCP port");
  }

  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  try {
    let serviceWorker = context.serviceWorkers()[0];
    serviceWorker ??= await context.waitForEvent("serviceworker");
    const extensionId = new URL(serviceWorker.url()).host;
    const page = await context.newPage();
    const fixtureUrl = `http://127.0.0.1:${String(address.port)}/large`;
    await page.goto(fixtureUrl);
    await page.bringToFront();

    const browser = context.browser();
    if (browser === null) {
      throw new Error("Persistent Chromium browser is unavailable");
    }
    const browserSession = await browser.newBrowserCDPSession();
    const pageSession = await context.newCDPSession(page);
    const { targetInfos } = await browserSession.send("Target.getTargets", {
      filter: [{ type: "tab", exclude: false }, { exclude: true }],
    });
    const pageTarget = targetInfos.find(
      (target) => target.type === "tab" && target.url === fixtureUrl,
    );
    if (pageTarget === undefined) {
      throw new Error("Could not resolve the large fixture tab target");
    }
    await browserSession.send("Extensions.triggerAction", {
      id: extensionId,
      targetId: pageTarget.targetId,
    });

    const extensionControl = await context.newPage();
    await extensionControl.goto(
      `chrome-extension://${extensionId}/src/ui/popup/popup.html`,
    );
    await page.bringToFront();
    await extensionControl.evaluate(async () => {
      const requestId = crypto.randomUUID();
      await chrome.runtime.sendMessage({
        protocolVersion: 1,
        target: "serviceWorker",
        type: "transliteration.batch.request",
        requestId,
        items: [
          {
            itemId: "warm",
            source: "東京",
            language: "ja",
            romanizationPolicy: "ascii-hepburn-v1",
          },
        ],
      });
    });
    await pageSession.send("HeapProfiler.collectGarbage");
    await delay(500);
    const baselinePssMiB = await readBrowserPssMiB(browserSession);
    const baselineRetainedMiB = await readRendererRetainedMiB(pageSession);
    await page.evaluate(() => {
      window.fixtureLongTasks = [];
      if ("PerformanceObserver" in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.fixtureLongTasks.push(entry.duration);
          }
        });
        observer.observe({ type: "longtask" });
      }
    });

    const summary: unknown = await extensionControl.evaluate(async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id === undefined) {
        throw new Error("No active large fixture tab");
      }
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        files: ["assets/content-script.js"],
      });
      const response: unknown = await chrome.tabs.sendMessage(
        tab.id,
        {
          protocolVersion: 1,
          target: "content",
          type: "content.command",
          requestId: crypto.randomUUID(),
          command: "start",
        },
        { frameId: 0 },
      );
      return response;
    });
    expect(summary).toMatchObject({
      state: "active",
      eligibleNodes: 5_000,
      processedNodes: 5_000,
      failedNodes: 0,
    });
    await expect(page.locator("span").first()).toHaveText("toukyou");
    await pageSession.send("HeapProfiler.collectGarbage");
    await delay(500);
    const activePssMiB = await readBrowserPssMiB(browserSession);
    const activeRetainedMiB = await readRendererRetainedMiB(pageSession);
    const pageSideDeltaMiB = activePssMiB - baselinePssMiB;
    const retainedDeltaMiB = activeRetainedMiB - baselineRetainedMiB;
    const longTasks = await page.evaluate(() => window.fixtureLongTasks);
    console.info(
      "static DOM performance",
      JSON.stringify({
        nodes: 5_000,
        totalPssDeltaMiB: Number(pageSideDeltaMiB.toFixed(1)),
        rendererRetainedDeltaMiB: Number(retainedDeltaMiB.toFixed(1)),
        longTasks,
      }),
    );
    expect(retainedDeltaMiB).toBeLessThanOrEqual(20);
    expect(longTasks).toEqual([]);

    await page.bringToFront();
    await extensionControl.evaluate(async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id === undefined) {
        throw new Error("No active large fixture tab");
      }
      await chrome.tabs.sendMessage(
        tab.id,
        {
          protocolVersion: 1,
          target: "content",
          type: "content.command",
          requestId: crypto.randomUUID(),
          command: "stop",
        },
        { frameId: 0 },
      );
      if (await chrome.offscreen.hasDocument()) {
        await chrome.offscreen.closeDocument();
      }
    });
    await expect(page.locator("span").first()).toHaveText("東京");
  } finally {
    await context.close();
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => {
        if (error === undefined) {
          resolveClose();
        } else {
          rejectClose(error);
        }
      });
    });
  }
});

declare global {
interface Window {
  fixtureOriginalNode: ChildNode;
  fixtureClicks: number;
  fixtureLongTasks: number[];
  dynamicLongTasks: number[];
  dynamicStressStart: number;
  hardeningOriginalNode: ChildNode;
  hardeningClicks: number;
}
}
