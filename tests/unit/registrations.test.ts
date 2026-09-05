import { describe, expect, it, vi } from "vitest";
import {
  createSiteRegistration,
  RegistrationManager,
  registrationIdForOrigin,
} from "../../src/background/registrations";
import { originMatchPattern } from "../../src/shared/origins";
import { applyPreferencesPatch } from "../../src/storage/preferences";
import { createDefaultPreferences } from "../../src/storage/schema";
import type { PreferencesPatch, PreferencesSchema } from "../../src/storage/schema";

class MemoryPreferenceStore {
  preferences: PreferencesSchema;

  constructor(preferences: PreferencesSchema) {
    this.preferences = preferences;
  }

  get(): Promise<PreferencesSchema> {
    return Promise.resolve(this.preferences);
  }

  patch(patch: PreferencesPatch): Promise<PreferencesSchema> {
    this.preferences = applyPreferencesPatch(this.preferences, patch);
    return Promise.resolve(this.preferences);
  }
}

function rememberedPreferences(): PreferencesSchema {
  return applyPreferencesPatch(createDefaultPreferences(), {
    site: { origin: "https://Example.com/private", policy: "ask" },
  });
}

describe("remembered-site registrations", () => {
  it("derives a stable opaque registration and concrete match pattern", () => {
    expect(originMatchPattern("https://Example.com/private?q=secret")).toBe(
      "https://example.com/*",
    );
    const id = registrationIdForOrigin("https://example.com/private");
    expect(id).toMatch(/^btb_site_[0-9a-f]{16}$/u);
    expect(id).toBe(registrationIdForOrigin("https://EXAMPLE.com/other"));
    expect(id).not.toContain("example");
    expect(createSiteRegistration("https://example.com")).toEqual({
      id,
      matches: ["https://example.com/*"],
      js: ["assets/content-script.js"],
      runAt: "document_idle",
      allFrames: false,
      persistAcrossSessions: true,
    });
  });

  it("registers once and is idempotent across repeated reconciliation", async () => {
    const preferences = new MemoryPreferenceStore(rememberedPreferences());
    const registrations: chrome.scripting.RegisteredContentScript[] = [];
    const scripting = {
      getRegisteredContentScripts: vi.fn(() => Promise.resolve([...registrations])),
      registerContentScripts: vi.fn(
        (scripts: chrome.scripting.RegisteredContentScript[]) => {
          registrations.push(...scripts);
          return Promise.resolve();
        },
      ),
      unregisterContentScripts: vi.fn(({ ids }: { ids: string[] }) => {
        for (const id of ids) {
          const index = registrations.findIndex((entry) => entry.id === id);
          if (index >= 0) registrations.splice(index, 1);
        }
        return Promise.resolve();
      }),
    };
    const manager = new RegistrationManager(preferences, scripting, {
      contains: vi.fn(() => Promise.resolve(true)),
    });

    expect(await manager.reconcile()).toMatchObject({ registered: 1 });
    expect(await manager.reconcile()).toMatchObject({
      registered: 0,
      unregistered: 0,
    });
    expect(scripting.registerContentScripts).toHaveBeenCalledOnce();
    expect(registrations).toHaveLength(1);
  });

  it("reruns when preferences change during an active reconciliation", async () => {
    const preferences = new MemoryPreferenceStore(rememberedPreferences());
    const registrations: chrome.scripting.RegisteredContentScript[] = [];
    let releasePermission!: () => void;
    const permissionGate = new Promise<void>((resolve) => {
      releasePermission = resolve;
    });
    let firstPermissionCheck = true;
    const scripting = {
      getRegisteredContentScripts: vi.fn(() => Promise.resolve([...registrations])),
      registerContentScripts: vi.fn(
        (scripts: chrome.scripting.RegisteredContentScript[]) => {
          registrations.push(...scripts);
          return Promise.resolve();
        },
      ),
      unregisterContentScripts: vi.fn(() => Promise.resolve()),
    };
    const manager = new RegistrationManager(preferences, scripting, {
      contains: vi.fn(async () => {
        if (firstPermissionCheck) {
          firstPermissionCheck = false;
          await permissionGate;
        }
        return true;
      }),
    });

    const first = manager.reconcile();
    await preferences.patch({
      site: { origin: "https://second.example", policy: "always" },
    });
    const second = manager.reconcile();
    releasePermission();
    await Promise.all([first, second]);

    expect(registrations.map(({ matches }) => matches?.[0]).sort()).toEqual([
      "https://example.com/*",
      "https://second.example/*",
    ]);
  });

  it("repairs stale registrations and removes registrations without policy", async () => {
    const preferences = new MemoryPreferenceStore(rememberedPreferences());
    const wanted = createSiteRegistration("https://example.com");
    const registrations: chrome.scripting.RegisteredContentScript[] = [
      { ...wanted, js: ["stale.js"] },
      createSiteRegistration("https://unused.example"),
      {
        id: "unrelated_registration",
        matches: ["https://other.example/*"],
        js: ["unrelated.js"],
      },
    ];
    const scripting = {
      getRegisteredContentScripts: vi.fn(() => Promise.resolve([...registrations])),
      registerContentScripts: vi.fn(() => Promise.resolve()),
      unregisterContentScripts: vi.fn(() => Promise.resolve()),
    };
    const manager = new RegistrationManager(preferences, scripting, {
      contains: vi.fn(() => Promise.resolve(true)),
    });

    expect(await manager.reconcile()).toMatchObject({
      registered: 1,
      unregistered: 2,
    });
    expect(scripting.unregisterContentScripts).toHaveBeenCalledWith({
      ids: [wanted.id, registrationIdForOrigin("https://unused.example")],
    });
    expect(scripting.registerContentScripts).toHaveBeenCalledWith([wanted]);
  });

  it("drops policy and registration when origin permission is revoked", async () => {
    const preferences = new MemoryPreferenceStore(rememberedPreferences());
    const existing = createSiteRegistration("https://example.com");
    const scripting = {
      getRegisteredContentScripts: vi.fn(() => Promise.resolve([existing])),
      registerContentScripts: vi.fn(() => Promise.resolve()),
      unregisterContentScripts: vi.fn(() => Promise.resolve()),
    };
    const manager = new RegistrationManager(preferences, scripting, {
      contains: vi.fn(() => Promise.resolve(false)),
    });

    expect(await manager.reconcile()).toEqual({
      expected: 0,
      registered: 0,
      unregistered: 1,
      missingPermissionOrigins: ["https://example.com"],
    });
    expect(preferences.preferences.sites).toEqual({});
  });

  it("unregisters while globally or linguistically disabled", async () => {
    for (const patch of [
      { globalEnabled: false },
      { japaneseEnabled: false },
      { site: { origin: "https://example.com", policy: "disabled" as const } },
    ]) {
      const preferences = new MemoryPreferenceStore(
        applyPreferencesPatch(rememberedPreferences(), patch),
      );
      const scripting = {
        getRegisteredContentScripts: vi.fn(() =>
          Promise.resolve([createSiteRegistration("https://example.com")]),
        ),
        registerContentScripts: vi.fn(() => Promise.resolve()),
        unregisterContentScripts: vi.fn(() => Promise.resolve()),
      };
      const manager = new RegistrationManager(preferences, scripting, {
        contains: vi.fn(() => Promise.resolve(true)),
      });
      expect(await manager.reconcile()).toMatchObject({
        expected: 0,
        unregistered: 1,
      });
    }
  });
});
