import { describe, expect, it } from "vitest";
import {
  createJapaneseWorkerProbeRequest,
  createJapaneseWorkerProbeFailure,
  createJapaneseWorkerProbeResponse,
  isJapaneseWorkerProbeRequest,
  isJapaneseWorkerProbeFailure,
  isJapaneseWorkerProbeResponse,
} from "../../src/shared/worker-messages";

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
});
