export const PREFERENCES_STORAGE_KEY = "preferences" as const;
export const PREFERENCE_SCHEMA_VERSION = 1 as const;

export type SitePolicy = "ask" | "always" | "disabled";

export interface SitePreference {
  readonly policy: SitePolicy;
}

export interface PreferencesSchema {
  readonly schemaVersion: typeof PREFERENCE_SCHEMA_VERSION;
  readonly globalEnabled: boolean;
  readonly languages: {
    readonly ja: {
      readonly enabled: boolean;
      readonly romanizationPolicy: "ascii-hepburn-v1";
    };
  };
  readonly renderer: "replace";
  readonly sites: Readonly<Record<string, SitePreference>>;
  readonly onboarding: {
    readonly sitePermissionExplained: boolean;
  };
}

export interface PreferencesPatch {
  readonly globalEnabled?: boolean;
  readonly japaneseEnabled?: boolean;
  readonly sitePermissionExplained?: boolean;
  readonly site?: {
    readonly origin: string;
    readonly policy: SitePolicy | null;
  };
}

export function createDefaultPreferences(): PreferencesSchema {
  return {
    schemaVersion: PREFERENCE_SCHEMA_VERSION,
    globalEnabled: true,
    languages: {
      ja: {
        enabled: true,
        romanizationPolicy: "ascii-hepburn-v1",
      },
    },
    renderer: "replace",
    sites: {},
    onboarding: {
      sitePermissionExplained: false,
    },
  };
}

