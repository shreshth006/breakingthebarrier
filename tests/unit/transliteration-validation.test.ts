import { describe, expect, it } from "vitest";
import {
  MAX_TRANSLITERATION_BATCH_ITEMS,
  MAX_TRANSLITERATION_BATCH_UTF16,
  MAX_TRANSLITERATION_SOURCE_UTF16,
} from "../../src/shared/config";
import type {
  TransliterationRequest,
  TransliterationResult,
} from "../../src/engines/contracts";
import {
  readTransliterationRequests,
  readTransliterationResults,
  resultsMatchRequests,
} from "../../src/shared/transliteration-validation";

function request(
  itemId = "title",
  source = "東京",
): TransliterationRequest {
  return {
    itemId,
    source,
    language: "ja",
    romanizationPolicy: "ascii-hepburn-v1",
  };
}

function result(itemId = "title", source = "東京"): TransliterationResult {
  return {
    itemId,
    source,
    rendered: "toukyou",
    segments: [
      {
        start: 0,
        end: source.length,
        source,
        reading: "トウキョウ",
        romanized: "toukyou",
      },
    ],
    warnings: [],
    versions: {
      engine: "5.3.0",
      dictionary: "5.3.0",
      romanizationPolicy: "ascii-hepburn-v1",
      spacingPolicy: "japanese-spacing-v1",
    },
  };
}

describe("transliteration boundary validation", () => {
  it("accepts a bounded request batch and rebuilds its items", () => {
    const input = [request()];
    const parsed = readTransliterationRequests(input);

    expect(parsed).toEqual(input);
    expect(parsed).not.toBe(input);
    expect(parsed?.[0]).not.toBe(input[0]);
  });

  it("rejects empty, oversized, and duplicate request batches", () => {
    expect(readTransliterationRequests([])).toBeNull();
    expect(
      readTransliterationRequests(
        Array.from({ length: MAX_TRANSLITERATION_BATCH_ITEMS + 1 }, (_, index) =>
          request(String(index)),
        ),
      ),
    ).toBeNull();
    expect(
      readTransliterationRequests([request("same"), request("same")]),
    ).toBeNull();
  });

  it("enforces per-item and aggregate source ceilings", () => {
    expect(
      readTransliterationRequests([
        request("large", "x".repeat(MAX_TRANSLITERATION_SOURCE_UTF16 + 1)),
      ]),
    ).toBeNull();

    const source = "x".repeat(MAX_TRANSLITERATION_SOURCE_UTF16);
    const overAggregate = Array.from(
      {
        length:
          Math.floor(
            MAX_TRANSLITERATION_BATCH_UTF16 /
              MAX_TRANSLITERATION_SOURCE_UTF16,
          ) + 1,
      },
      (_, index) => request(String(index), source),
    );
    expect(readTransliterationRequests(overAggregate)).toBeNull();
  });

  it("accepts deeply validated, source-aligned results", () => {
    expect(readTransliterationResults([result()])).toEqual([result()]);
  });

  it("rejects result segments with altered slices or coverage gaps", () => {
    const valid = result();
    expect(
      readTransliterationResults([
        {
          ...valid,
          segments: [{ ...valid.segments[0], source: "大阪" }],
        },
      ]),
    ).toBeNull();
    expect(
      readTransliterationResults([
        {
          ...valid,
          segments: [{ ...valid.segments[0], start: 1 }],
        },
      ]),
    ).toBeNull();
  });

  it("rejects duplicate result identifiers", () => {
    expect(
      readTransliterationResults([result("same"), result("same")]),
    ).toBeNull();
  });

  it("rejects duplicate warnings and unexpected policy versions", () => {
    const valid = result();
    expect(
      readTransliterationResults([
        {
          ...valid,
          warnings: ["unknown-reading", "unknown-reading"],
        },
      ]),
    ).toBeNull();
    expect(
      readTransliterationResults([
        {
          ...valid,
          versions: { ...valid.versions, spacingPolicy: "untrusted" },
        },
      ]),
    ).toBeNull();
  });

  it("correlates result identifiers and sources with requests", () => {
    expect(resultsMatchRequests([request()], [result()])).toBe(true);
    expect(resultsMatchRequests([request()], [result("other")])).toBe(false);
    expect(
      resultsMatchRequests([request()], [result("title", "大阪")]),
    ).toBe(false);
    expect(
      resultsMatchRequests(
        [request()],
        [
          {
            ...result(),
            versions: {
              ...result().versions,
              romanizationPolicy: "different-policy",
            },
          },
        ],
      ),
    ).toBe(false);
  });
});
