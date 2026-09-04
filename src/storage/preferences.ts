import { migratePreferences, normalizeOrigin } from "./migrations";
import {
  PREFERENCES_STORAGE_KEY,
  PREFERENCE_SCHEMA_VERSION,
} from "./schema";
import type { PreferencesPatch, PreferencesSchema } from "./schema";

export interface LocalStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface StorageChange {
  readonly oldValue?: unknown;
  readonly newValue?: unknown;
}

export interface StorageChangeSource {
  addListener(
    listener: (
      changes: Record<string, StorageChange>,
      areaName: string,
    ) => void,
  ): void;
  removeListener(
    listener: (
      changes: Record<string, StorageChange>,
      areaName: string,
    ) => void,
  ): void;
}

function isCanonical(
  stored: unknown,
  preferences: PreferencesSchema,
): boolean {
  return JSON.stringify(stored) === JSON.stringify(preferences);
}

export function applyPreferencesPatch(
  current: PreferencesSchema,
  patch: PreferencesPatch,
): PreferencesSchema {
  const siteEntries = new Map(Object.entries(current.sites));
  if (patch.site !== undefined) {
    const origin = normalizeOrigin(patch.site.origin);
    if (origin === null) {
      throw new Error("Site preferences require an HTTP(S) origin");
    }
    if (patch.site.policy === null) {
      siteEntries.delete(origin);
    } else {
      siteEntries.set(origin, { policy: patch.site.policy });
    }
  }
  return {
    schemaVersion: PREFERENCE_SCHEMA_VERSION,
    globalEnabled: patch.globalEnabled ?? current.globalEnabled,
    languages: {
      ja: {
        enabled: patch.japaneseEnabled ?? current.languages.ja.enabled,
        romanizationPolicy: "ascii-hepburn-v1",
      },
    },
    renderer: "replace",
    sites: Object.fromEntries(siteEntries),
    onboarding: {
      sitePermissionExplained:
        patch.sitePermissionExplained ??
        current.onboarding.sitePermissionExplained,
    },
  };
}

export class PreferenceStore {
  readonly #storage: LocalStorageArea;
  readonly #changes: StorageChangeSource | undefined;
  #mutation: Promise<void> = Promise.resolve();

  constructor(storage: LocalStorageArea, changes?: StorageChangeSource) {
    this.#storage = storage;
    this.#changes = changes;
  }

  async get(): Promise<PreferencesSchema> {
    await this.#mutation;
    return this.#readAndMigrate();
  }

  patch(patch: PreferencesPatch): Promise<PreferencesSchema> {
    let resolveResult!: (value: PreferencesSchema) => void;
    let rejectResult!: (reason: unknown) => void;
    const result = new Promise<PreferencesSchema>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    this.#mutation = this.#mutation
      .catch(() => undefined)
      .then(async () => {
        try {
          const current = await this.#readAndMigrate();
          const updated = applyPreferencesPatch(current, patch);
          await this.#storage.set({ [PREFERENCES_STORAGE_KEY]: updated });
          resolveResult(updated);
        } catch (error) {
          rejectResult(error);
        }
      });
    return result;
  }

  subscribe(listener: (preferences: PreferencesSchema) => void): () => void {
    if (this.#changes === undefined) {
      return () => undefined;
    }
    const onChanged = (
      changes: Record<string, StorageChange>,
      areaName: string,
    ): void => {
      const changed = changes[PREFERENCES_STORAGE_KEY];
      if (areaName !== "local" || changed?.newValue === undefined) {
        return;
      }
      try {
        listener(migratePreferences(changed.newValue));
      } catch {
        // A newer schema is left untouched until this extension understands it.
      }
    };
    this.#changes.addListener(onChanged);
    return () => this.#changes?.removeListener(onChanged);
  }

  async #readAndMigrate(): Promise<PreferencesSchema> {
    const values = await this.#storage.get(PREFERENCES_STORAGE_KEY);
    const stored = values[PREFERENCES_STORAGE_KEY];
    const preferences = migratePreferences(stored);
    if (!isCanonical(stored, preferences)) {
      await this.#storage.set({ [PREFERENCES_STORAGE_KEY]: preferences });
    }
    return preferences;
  }
}
