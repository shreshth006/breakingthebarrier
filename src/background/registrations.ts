import { CONTENT_SCRIPT_PATH } from "../shared/config";
import { normalizeOrigin, originMatchPattern } from "../shared/origins";
import type { PreferenceStore } from "../storage/preferences";
import type { PreferencesSchema } from "../storage/schema";

export const SITE_REGISTRATION_PREFIX = "btb_site_" as const;

export interface ScriptingRegistrationApi {
  getRegisteredContentScripts(): Promise<
    chrome.scripting.RegisteredContentScript[]
  >;
  registerContentScripts(
    scripts: chrome.scripting.RegisteredContentScript[],
  ): Promise<void>;
  unregisterContentScripts(filter: { ids: string[] }): Promise<void>;
}

export interface OptionalPermissionApi {
  contains(permissions: chrome.permissions.Permissions): Promise<boolean>;
}

export interface RegistrationReconciliation {
  readonly expected: number;
  readonly registered: number;
  readonly unregistered: number;
  readonly missingPermissionOrigins: readonly string[];
}

export function registrationIdForOrigin(origin: string): string {
  const normalized = normalizeOrigin(origin);
  if (normalized === null) {
    throw new Error("Content registration requires an HTTP(S) origin");
  }
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(normalized)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `${SITE_REGISTRATION_PREFIX}${hash.toString(16).padStart(16, "0")}`;
}

export function createSiteRegistration(
  origin: string,
): chrome.scripting.RegisteredContentScript {
  return {
    id: registrationIdForOrigin(origin),
    matches: [originMatchPattern(origin)],
    js: [CONTENT_SCRIPT_PATH],
    runAt: "document_idle",
    allFrames: false,
    persistAcrossSessions: true,
  };
}

function sameStrings(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
): boolean {
  return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
}

function registrationMatches(
  actual: chrome.scripting.RegisteredContentScript,
  expected: chrome.scripting.RegisteredContentScript,
): boolean {
  return (
    actual.id === expected.id &&
    sameStrings(actual.matches, expected.matches) &&
    sameStrings(actual.js, expected.js) &&
    actual.runAt === expected.runAt &&
    actual.allFrames === expected.allFrames &&
    actual.persistAcrossSessions === expected.persistAcrossSessions
  );
}

function policyOrigins(preferences: PreferencesSchema): readonly string[] {
  if (!preferences.globalEnabled || !preferences.languages.ja.enabled) {
    return [];
  }
  return Object.entries(preferences.sites)
    .filter(([, preference]) => preference.policy !== "disabled")
    .map(([origin]) => origin)
    .sort();
}

export class RegistrationManager {
  readonly #preferences: Pick<PreferenceStore, "get" | "patch">;
  readonly #scripting: ScriptingRegistrationApi;
  readonly #permissions: OptionalPermissionApi;
  #pending: Promise<RegistrationReconciliation> | undefined;
  #requestedGeneration = 0;

  constructor(
    preferences: Pick<PreferenceStore, "get" | "patch">,
    scripting: ScriptingRegistrationApi,
    permissions: OptionalPermissionApi,
  ) {
    this.#preferences = preferences;
    this.#scripting = scripting;
    this.#permissions = permissions;
  }

  reconcile(): Promise<RegistrationReconciliation> {
    this.#requestedGeneration += 1;
    if (this.#pending !== undefined) {
      return this.#pending;
    }
    this.#pending = this.#reconcileUntilCurrent().finally(() => {
      this.#pending = undefined;
    });
    return this.#pending;
  }

  async #reconcileUntilCurrent(): Promise<RegistrationReconciliation> {
    for (;;) {
      const generation = this.#requestedGeneration;
      const result = await this.#reconcileOnce();
      if (generation === this.#requestedGeneration) {
        return result;
      }
    }
  }

  async #reconcileOnce(): Promise<RegistrationReconciliation> {
    const preferences = await this.#preferences.get();
    const expected = new Map<string, chrome.scripting.RegisteredContentScript>();
    const missingPermissionOrigins: string[] = [];

    for (const origin of policyOrigins(preferences)) {
      const granted = await this.#permissions.contains({
        origins: [originMatchPattern(origin)],
      });
      if (!granted) {
        missingPermissionOrigins.push(origin);
        continue;
      }
      const registration = createSiteRegistration(origin);
      const collision = expected.get(registration.id);
      if (
        collision !== undefined &&
        !sameStrings(collision.matches, registration.matches)
      ) {
        throw new Error("Remembered-site registration hash collision");
      }
      expected.set(registration.id, registration);
    }

    for (const origin of missingPermissionOrigins) {
      await this.#preferences.patch({ site: { origin, policy: null } });
    }

    const actual = (await this.#scripting.getRegisteredContentScripts()).filter(
      ({ id }) => id.startsWith(SITE_REGISTRATION_PREFIX),
    );
    const actualById = new Map(actual.map((registration) => [registration.id, registration]));
    const unregisterIds = actual
      .filter((registration) => {
        const wanted = expected.get(registration.id);
        return wanted === undefined || !registrationMatches(registration, wanted);
      })
      .map(({ id }) => id);
    const register = [...expected.values()].filter((registration) => {
      const existing = actualById.get(registration.id);
      return existing === undefined || !registrationMatches(existing, registration);
    });

    if (unregisterIds.length > 0) {
      await this.#scripting.unregisterContentScripts({ ids: unregisterIds });
    }
    if (register.length > 0) {
      await this.#scripting.registerContentScripts(register);
    }

    return {
      expected: expected.size,
      registered: register.length,
      unregistered: unregisterIds.length,
      missingPermissionOrigins,
    };
  }
}
