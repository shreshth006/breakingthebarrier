import { describe, expect, it } from "vitest";
import {
  createJapaneseWorkerBatchFailure,
  createJapaneseWorkerBatchRequest,
  createJapaneseWorkerBatchResponse,
  createJapaneseWorkerProbeRequest,
  createJapaneseWorkerProbeFailure,
  createJapaneseWorkerProbeResponse,
  isJapaneseWorkerBatchFailure,
  isJapaneseWorkerBatchRequest,
  isJapaneseWorkerBatchResponse,
  isJapaneseWorkerProbeRequest,
  isJapaneseWorkerProbeFailure,
  isJapaneseWorkerProbeResponse,
} from "../../src/shared/worker-messages";

const items = [
  {
    itemId: "title",
    source: "東京",
    language: "ja",
    romanizationPolicy: "ascii-hepburn-v1",
  },
] as const;

const results = [
  {
    itemId: "title",
    source: "東京",
    rendered: "toukyou",
    segments: [
      {
        start: 0,
        end: 2,
        source: "東京",
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
  },
] as const;

describe("Japanese worker messages", () => {
  it("accepts the internal probe request", () => {
    const request = createJapaneseWorkerProbeRequest("probe-1");
    expect(isJapaneseWorkerProbeRequest(request)).toBe(true);
  });

  it("accepts the versioned capability response", () => {
    const response = createJapaneseWorkerProbeResponse("probe-1", {
      status: "ready",
      capabilities: ["lindera-wasm", "ipadic-tokenizer", "kana-romanizer"],
      versions: {
        lindera: "5.3.0",
        wanakana: "5.3.1",
        dictionary: "5.3.0",
        romanizationPolicy: "ascii-hepburn-v1",
        spacingPolicy: "japanese-spacing-v1",
      },
      measurements: {
        coldReadyMs: 450,
        warmBatchItems: 100,
        warmBatchMs: 12,
      },
      selfTestPassed: true,
    });

    expect(isJapaneseWorkerProbeResponse(response)).toBe(true);
  });

  it("rejects incomplete capability responses", () => {
    expect(
      isJapaneseWorkerProbeResponse({
        type: "worker.probe.response",
        requestId: "probe-1",
      }),
    ).toBe(false);
  });

  it("accepts safe worker failure classifications", () => {
    expect(
      isJapaneseWorkerProbeFailure(
        createJapaneseWorkerProbeFailure("probe-1", "engine-load"),
      ),
    ).toBe(true);
  });

  it("accepts validated internal batch envelopes", () => {
    expect(
      isJapaneseWorkerBatchRequest(
        createJapaneseWorkerBatchRequest("batch-1", items),
      ),
    ).toBe(true);
    expect(
      isJapaneseWorkerBatchResponse(
        createJapaneseWorkerBatchResponse("batch-1", results),
      ),
    ).toBe(true);
    expect(
      isJapaneseWorkerBatchFailure(
        createJapaneseWorkerBatchFailure("batch-1", "transliteration"),
      ),
    ).toBe(true);
  });

  it("rejects a batch response whose segments do not match its source", () => {
    expect(
      isJapaneseWorkerBatchResponse(
        createJapaneseWorkerBatchResponse("batch-1", [
          {
            ...results[0],
            segments: [{ ...results[0].segments[0], source: "大阪" }],
          },
        ]),
      ),
    ).toBe(false);
  });
});
