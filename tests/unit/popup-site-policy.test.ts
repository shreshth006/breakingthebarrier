import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultPreferences,
  type PreferencesSchema,
} from "../../src/storage/schema";
import { applyPreferencesPatch } from "../../src/storage/preferences";

const origin = "https://example.com";

function popupDocument(): void {
  document.body.innerHTML = `
    <button id="page-action" type="button"></button>
    <p id="status"></p>
    <span id="page-state"></span>
    <section id="site-memory" hidden>
      <span id="site-host"></span>
      <input id="remember-site" type="checkbox" disabled>
      <div id="site-policy-control" hidden>
        <select id="site-policy" disabled>
          <option value="ask">Ask first</option>
          <option value="always">Romanize automatically</option>
        </select>
      </div>
      <p id="site-status"></p>
    </section>
  `;
}

function rememberedPreferences(): PreferencesSchema {
  return applyPreferencesPatch(createDefaultPreferences(), {
    site: { origin, policy: "ask" },
  });
}

describe("popup remembered-site policy control", () => {
  beforeEach(() => {
    vi.resetModules();
    popupDocument();
  });

  it("saves automatic policy without requesting permission again", async () => {
    const sendMessage = vi.fn((message: { type: string; requestId: string }) => {
      if (message.type === "page.command") {
        return Promise.resolve({
          protocolVersion: 1,
          target: "popup",
          type: "page.command.response",
          requestId: message.requestId,
          state: "original",
          reason: null,
          eligibleNodes: 0,
          processedNodes: 0,
          failedNodes: 0,
        });
      }
      return Promise.resolve({
        protocolVersion: 1,
        target: "popup",
        type: "site.policy.response",
        requestId: message.requestId,
        origin,
        policy: "always",
        permissionGranted: true,
        registered: true,
      });
    });
    const requestPermission = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      tabs: {
        query: vi.fn(() =>
          Promise.resolve([{ url: `${origin}/private/path?discarded=true` }]),
        ),
      },
      permissions: {
        request: requestPermission,
        remove: vi.fn(),
      },
      storage: {
        local: {
          get: vi.fn(() =>
            Promise.resolve({ preferences: rememberedPreferences() }),
          ),
          set: vi.fn(() => Promise.resolve()),
        },
      },
    });

    await import("../../src/ui/popup/popup");
    const select = document.querySelector("#site-policy");
    const control = document.querySelector("#site-policy-control");
    if (!(select instanceof HTMLSelectElement) || !(control instanceof HTMLElement)) {
      throw new Error("Policy controls are missing");
    }
    await vi.waitFor(() => {
      expect(select.disabled).toBe(false);
      expect(control.hidden).toBe(false);
      expect(select.value).toBe("ask");
    });

    select.value = "always";
    select.dispatchEvent(new Event("change"));
    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "site.policy.set",
          origin,
          policy: "always",
        }),
      );
      expect(document.querySelector("#site-status")?.textContent).toBe(
        "New pages on this site will romanize automatically.",
      );
    });
    expect(requestPermission).not.toHaveBeenCalled();
    expect(select.value).toBe("always");
  });
});
