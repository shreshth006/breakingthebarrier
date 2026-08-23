export type LanguageCode = "ja";

export type EngineWarningCode = "unknown-reading" | "partial-output";

export interface SourceAlignedSegment {
  readonly start: number;
  readonly end: number;
  readonly source: string;
  readonly reading: string | null;
  readonly romanized: string | null;
}

export interface TransliterationRequest {
  readonly itemId: string;
  readonly source: string;
  readonly language: LanguageCode;
  readonly romanizationPolicy: string;
}

export interface TransliterationResult {
  readonly itemId: string;
  readonly source: string;
  readonly rendered: string;
  readonly segments: readonly SourceAlignedSegment[];
  readonly warnings: readonly EngineWarningCode[];
  readonly versions: {
    readonly engine: string;
    readonly dictionary: string;
    readonly romanizationPolicy: string;
    readonly spacingPolicy: string;
  };
}

export interface TransliterationEngine {
  readonly language: LanguageCode;
  transliterate(
    requests: readonly TransliterationRequest[],
  ): Promise<readonly TransliterationResult[]>;
}
