import { describe, expect, it, vi } from "vitest";
import { migratePreferences } from "../../src/storage/migrations";
import { normalizeOrigin } from "../../src/shared/origins";
import { PreferenceStore } from "../../src/storage/preferences";
import type {
  LocalStorageArea,
  StorageChange,
  StorageChangeSource,
} from "../../src/storage/preferences";
import {
  createDefaultPreferences,
  PREFERENCES_STORAGE_KEY,
} from "../../src/storage/schema";

class MemoryStorage implements LocalStorageArea {
  readonly values: Record<string, unknown>;
  readonly set = vi.fn((items: Record<string, unknown>): Promise<void> => {
    Object.assign(this.values, items);
    return Promise.resolve();
  });

  constructor(initial: Record<string, unknown> = {}) {
    this.values = { ...initial };
  }

  get(key: string): Promise<Record<string, unknown>> {
    return Promise.resolve({ [key]: this.values[key] });
  }
}

class MemoryChanges implements StorageChangeSource {
  listener:
    | ((
        changes: Record<string, StorageChange>,
        areaName: string,
      ) => void)
    | undefined;

  addListener(
    listener: (
      changes: Record<string, StorageChange>,
      areaName: string,
    ) => void,
  ): void {
    this.listener = listener;
  }

  removeListener(): void {
    this.listener = undefined;
  }
}

describe("versioned preferences", () => {
  it("creates and persists privacy-safe defaults", async () => {
    const storage = new MemoryStorage();
    const preferences = await new PreferenceStore(storage).get();

    expect(preferences).toEqual(createDefaultPreferences());
    expect(storage.values[PREFERENCES_STORAGE_KEY]).toEqual(preferences);
    expect(JSON.stringify(preferences)).not.toMatch(/page|title|text|cache/i);
  });

  it("normalizes only concrete HTTP(S) origins", () => {
    expect(normalizeOrigin("HTTPS://Example.COM:443/path?q=private")).toBe(
      "https://example.com",
    );
    expect(normalizeOrigin("http://example.com:8080/a")).toBe(
      "http://example.com:8080",
    );
    expect(normalizeOrigin("chrome://extensions")).toBeNull();
    expect(normalizeOrigin("not a url")).toBeNull();
  });

  it("migrates the legacy schema and discards invalid site keys", () => {
    const migrated = migratePreferences({
      schemaVersion: 0,
      enabled: false,
      japaneseEnabled: true,
      permissionExplanationSeen: true,
      sitePolicies: {
        "https://Example.com/path": "always",
        "http://localhost:4173/private": "ask",
        "chrome://settings": "always",
        "https://invalid-policy.example": "sometimes",
      },
    });

    expect(migrated).toEqual({
      ...createDefaultPreferences(),
      globalEnabled: false,
      sites: {
        "https://example.com": { policy: "always" },
        "http://localhost:4173": { policy: "ask" },
      },
      onboarding: { sitePermissionExplained: true },
    });
    expect(migratePreferences(migrated)).toEqual(migrated);
  });

  it("refuses to overwrite a future schema", () => {
    expect(() => migratePreferences({ schemaVersion: 2 })).toThrow(
      "newer schema version",
    );
  });

  it("serializes patches and removes a site without retaining URL paths", async () => {
    const storage = new MemoryStorage();
    const store = new PreferenceStore(storage);

    await Promise.all([
      store.patch({ globalEnabled: false }),
      store.patch({
        site: { origin: "https://example.com/private/path", policy: "ask" },
      }),
      store.patch({ japaneseEnabled: false }),
    ]);
    expect(await store.get()).toEqual({
      ...createDefaultPreferences(),
      globalEnabled: false,
      languages: {
        ja: { enabled: false, romanizationPolicy: "ascii-hepburn-v1" },
      },
      sites: { "https://example.com": { policy: "ask" } },
    });

    await store.patch({
      site: { origin: "https://example.com/another-path", policy: null },
    });
    expect((await store.get()).sites).toEqual({});
  });

  it("publishes canonical local-storage changes and unsubscribes", () => {
    const changes = new MemoryChanges();
    const listener = vi.fn();
    const unsubscribe = new PreferenceStore(
      new MemoryStorage(),
      changes,
    ).subscribe(listener);
    const updated = { ...createDefaultPreferences(), globalEnabled: false };

    changes.listener?.(
      { [PREFERENCES_STORAGE_KEY]: { newValue: updated } },
      "session",
    );
    changes.listener?.(
      { [PREFERENCES_STORAGE_KEY]: { newValue: updated } },
      "local",
    );
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(updated);

    unsubscribe();
    expect(changes.listener).toBeUndefined();
  });
});
