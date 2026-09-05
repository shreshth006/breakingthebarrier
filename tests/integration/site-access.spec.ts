import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const projectRoot = resolve(import.meta.dirname, "../..");
const extensionPath = resolve(projectRoot, "dist");
const fixturePath = resolve(
  projectRoot,
  "tests/fixtures/pages/static-article.html",
);

test("remembered-site UI refuses missing permission and reconciles stale policy", async () => {
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
    throw new Error("Remembered-site fixture server did not bind a TCP port");
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
    const origin = `http://127.0.0.1:${String(address.port)}`;
    const fixtureUrl = `${origin}/article/private-path?not-stored=true`;
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
      throw new Error("Could not resolve the remembered-site fixture tab");
    }
    await browserSession.send("Extensions.triggerAction", {
      id: extensionId,
      targetId: pageTarget.targetId,
    });

    const popup = await context.newPage();
    await popup.goto(
      `chrome-extension://${extensionId}/src/ui/popup/popup.html`,
    );
    await page.bringToFront();
    await popup.reload();
    const remember = popup.getByRole("switch", {
      name: "Remember for this site",
    });
    await expect(remember).toBeVisible();
    await expect(popup.locator("#site-host")).toHaveText(
      `127.0.0.1:${String(address.port)}`,
    );

    await expect(remember).not.toBeChecked();
    await expect(remember).toBeEnabled();
    const policy = popup.locator("#site-policy");
    await expect(policy).toBeHidden();
    await expect(policy.locator("option")).toHaveText([
      "Ask first",
      "Romanize automatically",
    ]);
    const accessibility = await new AxeBuilder({ page: popup })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await popup.evaluate(() => {
      const control = document.querySelector("#site-policy-control");
      const select = document.querySelector("#site-policy");
      if (!(control instanceof HTMLElement) || !(select instanceof HTMLSelectElement)) {
        throw new Error("Site policy controls are unavailable");
      }
      control.hidden = false;
      select.disabled = false;
    });
    const rememberedAccessibility = await new AxeBuilder({ page: popup })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(rememberedAccessibility.violations).toEqual([]);
    await popup.evaluate(() => {
      const control = document.querySelector("#site-policy-control");
      if (control instanceof HTMLElement) control.hidden = true;
    });
    await popup.locator("body").press("Tab");
    await expect(popup.locator("#page-action")).toBeFocused();
    await popup.keyboard.press("Tab");
    await expect(remember).toBeFocused();
    await popup.emulateMedia({
      colorScheme: "dark",
      forcedColors: "active",
      reducedMotion: "reduce",
    });
    await popup.setViewportSize({ width: 640, height: 900 });
    await popup.evaluate(() => {
      document.body.style.zoom = "2";
    });
    const actionBox = await popup.locator("#page-action").boundingBox();
    const rememberBox = await remember.boundingBox();
    expect(actionBox).not.toBeNull();
    expect(rememberBox).not.toBeNull();
    expect((actionBox?.x ?? 0) + (actionBox?.width ?? 0)).toBeLessThanOrEqual(640);
    expect((rememberBox?.x ?? 0) + (rememberBox?.width ?? 0)).toBeLessThanOrEqual(640);
    const refused = await popup.evaluate(async (expectedOrigin) => {
      const response: unknown = await chrome.runtime.sendMessage({
        protocolVersion: 1,
        target: "serviceWorker",
        type: "site.policy.set",
        requestId: "missing-permission",
        origin: expectedOrigin,
        policy: "ask",
      });
      const preferences = await chrome.storage.local.get("preferences");
      const registrations = await chrome.scripting.getRegisteredContentScripts();
      const permission = await chrome.permissions.contains({
        origins: [`${expectedOrigin}/*`],
      });
      return {
        response,
        preferences: preferences.preferences,
        registrations,
        permission,
      };
    }, origin);
    expect(refused.response).toMatchObject({
      type: "site.policy.response",
      policy: null,
      permissionGranted: false,
      registered: false,
    });
    expect(refused.permission).toBe(false);
    expect(refused.preferences).toMatchObject({ sites: {} });
    expect(
      refused.registrations.filter(({ id }) => id.startsWith("btb_site_")),
    ).toHaveLength(0);

    await popup.evaluate(async (expectedOrigin) => {
      const stored = await chrome.storage.local.get("preferences");
      const preferences = stored.preferences as Record<string, unknown>;
      await chrome.storage.local.set({
        preferences: {
          ...preferences,
          sites: { [expectedOrigin]: { policy: "ask" } },
        },
      });
    }, origin);
    await expect
      .poll(
        () =>
          popup.evaluate(async (expectedOrigin) => {
            const stored = await chrome.storage.local.get("preferences");
            const registrations =
              await chrome.scripting.getRegisteredContentScripts();
            const preferences = stored.preferences as
              | { sites?: Record<string, unknown> }
              | undefined;
            return {
              site: preferences?.sites?.[expectedOrigin],
              registrations: registrations.filter(({ id }) =>
                id.startsWith("btb_site_"),
              ).length,
            };
          }, origin),
        { timeout: 5_000 },
      )
      .toEqual({ site: undefined, registrations: 0 });
    expect(JSON.stringify(refused.preferences)).not.toContain("private-path");

    await page.bringToFront();
    const started: unknown = await popup.evaluate(async () => {
      const response: unknown = await chrome.runtime.sendMessage({
        protocolVersion: 1,
        target: "serviceWorker",
        type: "page.command",
        requestId: "preference-stop-start",
        command: "start",
      });
      return response;
    });
    expect(started).toMatchObject({ state: "active", processedNodes: 3 });
    await expect(page.locator("#headline")).toHaveText("seiza ni naretara");

    await popup.evaluate(async (expectedOrigin) => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id === undefined) throw new Error("Fixture tab is unavailable");
      await chrome.storage.session.set({
        rememberedFrameSessionsV1: [{ tabId: tab.id, origin: expectedOrigin }],
      });
      const stored = await chrome.storage.local.get("preferences");
      const preferences = stored.preferences as Record<string, unknown>;
      await chrome.storage.local.set({
        preferences: { ...preferences, globalEnabled: false },
      });
    }, origin);
    await expect(page.locator("#headline")).toHaveText("星座になれたら", {
      timeout: 5_000,
    });
    const sessions = await popup.evaluate(async () => {
      const stored = await chrome.storage.session.get([
        "activeFrameSessionsV1",
        "rememberedFrameSessionsV1",
      ]);
      return stored;
    });
    expect(sessions).toMatchObject({
      activeFrameSessionsV1: [],
      rememberedFrameSessionsV1: [],
    });
  } finally {
    await context.close();
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => {
        if (error === undefined) resolveClose();
        else rejectClose(error);
      });
    });
  }
});
