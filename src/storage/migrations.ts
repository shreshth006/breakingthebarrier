import {
  createDefaultPreferences,
  PREFERENCE_SCHEMA_VERSION,
} from "./schema";
import type {
  PreferencesSchema,
  SitePolicy,
  SitePreference,
} from "./schema";
import { normalizeOrigin } from "../shared/origins";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSitePolicy(value: unknown): value is SitePolicy {
  return value === "ask" || value === "always" || value === "disabled";
}

function readSites(value: unknown): Readonly<Record<string, SitePreference>> {
  if (!isRecord(value)) {
    return {};
  }
  const normalized = new Map<string, SitePreference>();
  for (const [rawOrigin, rawPreference] of Object.entries(value)) {
    const origin = normalizeOrigin(rawOrigin);
    const policy = isRecord(rawPreference)
      ? rawPreference.policy
      : rawPreference;
    if (origin !== null && isSitePolicy(policy)) {
      normalized.set(origin, { policy });
    }
  }
  return Object.fromEntries(normalized);
}

function sanitizeV1(value: Record<string, unknown>): PreferencesSchema {
  const defaults = createDefaultPreferences();
  const languages = isRecord(value.languages) ? value.languages : {};
  const japanese = isRecord(languages.ja) ? languages.ja : {};
  const onboarding = isRecord(value.onboarding) ? value.onboarding : {};
  return {
    schemaVersion: PREFERENCE_SCHEMA_VERSION,
    globalEnabled:
      typeof value.globalEnabled === "boolean"
        ? value.globalEnabled
        : defaults.globalEnabled,
    languages: {
      ja: {
        enabled:
          typeof japanese.enabled === "boolean"
            ? japanese.enabled
            : defaults.languages.ja.enabled,
        romanizationPolicy: "ascii-hepburn-v1",
      },
    },
    renderer: "replace",
    sites: readSites(value.sites),
    onboarding: {
      sitePermissionExplained:
        typeof onboarding.sitePermissionExplained === "boolean"
          ? onboarding.sitePermissionExplained
          : defaults.onboarding.sitePermissionExplained,
    },
  };
}

function migrateV0(value: Record<string, unknown>): PreferencesSchema {
  return sanitizeV1({
    schemaVersion: PREFERENCE_SCHEMA_VERSION,
    globalEnabled: value.enabled,
    languages: {
      ja: {
        enabled: value.japaneseEnabled,
      },
    },
    renderer: "replace",
    sites: value.sitePolicies,
    onboarding: {
      sitePermissionExplained: value.permissionExplanationSeen,
    },
  });
}

export function migratePreferences(value: unknown): PreferencesSchema {
  if (value === undefined || value === null) {
    return createDefaultPreferences();
  }
  if (!isRecord(value)) {
    return createDefaultPreferences();
  }
  if (value.schemaVersion === 0) {
    return migrateV0(value);
  }
  if (value.schemaVersion === PREFERENCE_SCHEMA_VERSION) {
    return sanitizeV1(value);
  }
  if (
    typeof value.schemaVersion === "number" &&
    value.schemaVersion > PREFERENCE_SCHEMA_VERSION
  ) {
    throw new Error("Stored preferences use a newer schema version");
  }
  return createDefaultPreferences();
}
