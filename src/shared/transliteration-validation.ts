import {
  MAX_TRANSLITERATION_BATCH_ITEMS,
  MAX_TRANSLITERATION_BATCH_UTF16,
  MAX_TRANSLITERATION_ITEM_ID_LENGTH,
  MAX_TRANSLITERATION_RENDERED_UTF16,
  MAX_TRANSLITERATION_SEGMENTS,
  MAX_TRANSLITERATION_SOURCE_UTF16,
} from "./config";
import type {
  EngineWarningCode,
  SourceAlignedSegment,
  TransliterationRequest,
  TransliterationResult,
} from "../engines/contracts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedItemId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_TRANSLITERATION_ITEM_ID_LENGTH
  );
}

function isBoundedString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length <= maximum;
}

function isNonEmptyBoundedString(
  value: unknown,
  maximum: number,
): value is string {
  return isBoundedString(value, maximum) && value.length > 0;
}

export function readTransliterationRequests(
  value: unknown,
): readonly TransliterationRequest[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_TRANSLITERATION_BATCH_ITEMS
  ) {
    return null;
  }

  const itemIds = new Set<string>();
  const requests: TransliterationRequest[] = [];
  let totalSourceLength = 0;

  for (const item of value) {
    if (
      !isRecord(item) ||
      !isBoundedItemId(item.itemId) ||
      itemIds.has(item.itemId) ||
      !isBoundedString(item.source, MAX_TRANSLITERATION_SOURCE_UTF16) ||
      item.source.length === 0 ||
      item.language !== "ja" ||
      item.romanizationPolicy !== "ascii-hepburn-v1"
    ) {
      return null;
    }

    totalSourceLength += item.source.length;
    if (totalSourceLength > MAX_TRANSLITERATION_BATCH_UTF16) {
      return null;
    }
    itemIds.add(item.itemId);
    requests.push({
      itemId: item.itemId,
      source: item.source,
      language: "ja",
      romanizationPolicy: "ascii-hepburn-v1",
    });
  }

  return requests;
}

function readWarning(value: unknown): EngineWarningCode | null {
  return value === "unknown-reading" || value === "partial-output"
    ? value
    : null;
}

function readSegment(
  value: unknown,
  source: string,
): SourceAlignedSegment | null {
  if (
    !isRecord(value) ||
    typeof value.start !== "number" ||
    typeof value.end !== "number" ||
    !Number.isInteger(value.start) ||
    !Number.isInteger(value.end) ||
    value.start < 0 ||
    value.end < value.start ||
    value.end > source.length ||
    !isBoundedString(value.source, MAX_TRANSLITERATION_SOURCE_UTF16) ||
    value.source !== source.slice(value.start, value.end) ||
    !(
      value.reading === null ||
      isBoundedString(value.reading, MAX_TRANSLITERATION_SOURCE_UTF16)
    ) ||
    !(
      value.romanized === null ||
      isBoundedString(value.romanized, MAX_TRANSLITERATION_RENDERED_UTF16)
    )
  ) {
    return null;
  }

  return {
    start: value.start,
    end: value.end,
    source: value.source,
    reading: value.reading,
    romanized: value.romanized,
  };
}

function readResult(value: unknown): TransliterationResult | null {
  if (
    !isRecord(value) ||
    !isBoundedItemId(value.itemId) ||
    !isBoundedString(value.source, MAX_TRANSLITERATION_SOURCE_UTF16) ||
    value.source.length === 0 ||
    !isBoundedString(value.rendered, MAX_TRANSLITERATION_RENDERED_UTF16) ||
    !Array.isArray(value.segments) ||
    value.segments.length === 0 ||
    value.segments.length > MAX_TRANSLITERATION_SEGMENTS ||
    !Array.isArray(value.warnings) ||
    value.warnings.length > 2 ||
    !isRecord(value.versions)
  ) {
    return null;
  }

  const source = value.source;
  const segments: SourceAlignedSegment[] = [];
  for (const candidate of value.segments) {
    const segment = readSegment(candidate, source);
    if (segment === null) {
      return null;
    }
    segments.push(segment);
  }

  const warnings: EngineWarningCode[] = [];
  for (const candidate of value.warnings) {
    const warning = readWarning(candidate);
    if (warning === null) {
      return null;
    }
    warnings.push(warning);
  }

  if (
    new Set(warnings).size !== warnings.length ||
    !isNonEmptyBoundedString(value.versions.engine, 64) ||
    !isNonEmptyBoundedString(value.versions.dictionary, 64) ||
    value.versions.romanizationPolicy !== "ascii-hepburn-v1" ||
    value.versions.spacingPolicy !== "japanese-spacing-v1"
  ) {
    return null;
  }

  let previousEnd = 0;
  for (const segment of segments) {
    if (segment.start !== previousEnd) {
      return null;
    }
    previousEnd = segment.end;
  }
  if (previousEnd !== source.length) {
    return null;
  }

  return {
    itemId: value.itemId,
    source,
    rendered: value.rendered,
    segments,
    warnings,
    versions: {
      engine: value.versions.engine,
      dictionary: value.versions.dictionary,
      romanizationPolicy: value.versions.romanizationPolicy,
      spacingPolicy: value.versions.spacingPolicy,
    },
  };
}

export function readTransliterationResults(
  value: unknown,
): readonly TransliterationResult[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_TRANSLITERATION_BATCH_ITEMS
  ) {
    return null;
  }

  const results: TransliterationResult[] = [];
  for (const candidate of value) {
    const result = readResult(candidate);
    if (result === null) {
      return null;
    }
    results.push(result);
  }

  const itemIds = new Set(results.map((result) => result.itemId));
  const totalSourceLength = results.reduce(
    (total, result) => total + result.source.length,
    0,
  );
  return itemIds.size === results.length &&
    totalSourceLength <= MAX_TRANSLITERATION_BATCH_UTF16
    ? results
    : null;
}

export function resultsMatchRequests(
  requests: readonly TransliterationRequest[],
  results: readonly TransliterationResult[],
): boolean {
  if (requests.length !== results.length) {
    return false;
  }
  const requestById = new Map(
    requests.map((request) => [request.itemId, request] as const),
  );
  return results.every(
    (result) => {
      const request = requestById.get(result.itemId);
      return (
        request?.source === result.source &&
        request.romanizationPolicy === result.versions.romanizationPolicy
      );
    },
  );
}
