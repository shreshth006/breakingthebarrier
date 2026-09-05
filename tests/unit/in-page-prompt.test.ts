import { describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import { CONTENT_IGNORE_ATTRIBUTE, CONTENT_UI_ATTRIBUTE } from "../../src/shared/config";
import { showJapaneseDetectionPrompt } from "../../src/ui/in-page/prompt";

function promptHost(): HTMLElement {
  const host = document.querySelector(
    `[${CONTENT_UI_ATTRIBUTE}="japanese-detection-prompt"]`,
  );
  if (!(host instanceof HTMLElement)) throw new Error("Prompt host not found");
  return host;
}

describe("in-page Japanese detection prompt", () => {
  it("mounts one marked non-modal Shadow-root region without stealing focus", () => {
    const pageButton = document.createElement("button");
    document.body.append(pageButton);
    pageButton.focus();
    const actions = { romanize: vi.fn(), dismiss: vi.fn() };

    showJapaneseDetectionPrompt(document, actions);
    showJapaneseDetectionPrompt(document, actions);

    const host = promptHost();
    expect(document.querySelectorAll(`[${CONTENT_UI_ATTRIBUTE}]`)).toHaveLength(1);
    expect(host.hasAttribute(CONTENT_IGNORE_ATTRIBUTE)).toBe(true);
    expect(host.shadowRoot?.querySelector("section")?.getAttribute("role")).toBeNull();
    expect(host.shadowRoot?.querySelector("section")?.getAttribute("aria-label")).toBe(
      "Japanese detected",
    );
    expect(document.activeElement).toBe(pageButton);
  });

  it("passes automated accessibility rules for its open Shadow tree", async () => {
    showJapaneseDetectionPrompt(document, {
      romanize: vi.fn(() => Promise.resolve(true)),
      dismiss: vi.fn(),
    });

    const results = await axe.run(promptHost(), {
      rules: {
        "color-contrast": { enabled: false },
      },
    });
    expect(results.violations).toEqual([]);
  });

  it("starts romanization and removes itself after success", async () => {
    const romanize = vi.fn(() => Promise.resolve(true));
    showJapaneseDetectionPrompt(document, { romanize, dismiss: vi.fn() });
    const host = promptHost();
    const button = host.shadowRoot?.querySelector("button[data-primary]");
    if (!(button instanceof HTMLButtonElement)) throw new Error("Action missing");

    button.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(romanize).toHaveBeenCalledOnce();
    expect(host.isConnected).toBe(false);
  });

  it("dismisses through Not now and scoped Escape", () => {
    const dismiss = vi.fn();
    showJapaneseDetectionPrompt(document, {
      romanize: vi.fn(),
      dismiss,
    });
    let host = promptHost();
    const notNow = [...(host.shadowRoot?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent === "Not now",
    );
    if (!(notNow instanceof HTMLButtonElement)) throw new Error("Dismiss missing");
    notNow.click();
    expect(dismiss).toHaveBeenCalledOnce();
    expect(host.isConnected).toBe(false);

    showJapaneseDetectionPrompt(document, {
      romanize: vi.fn(),
      dismiss,
    });
    host = promptHost();
    const close = host.shadowRoot?.querySelector("button[data-close]");
    if (!(close instanceof HTMLButtonElement)) throw new Error("Close missing");
    close.focus();
    close.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(dismiss).toHaveBeenCalledTimes(2);
    expect(host.isConnected).toBe(false);
  });
});
