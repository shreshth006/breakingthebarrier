import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalFrameEngineClient } from "../../src/content/engine-client";
import type { TransliterationResult } from "../../src/engines/contracts";
import { createTransliterationBatchResponse } from "../../src/shared/messages";
import { validateTransliterationBatchRequest } from "../../src/shared/validation";

function result(itemId: string, source: string): TransliterationResult {
  return {
    itemId,
    source,
    rendered: `r:${source}`,
    segments: [
      {
        start: 0,
        end: source.length,
        source,
        reading: null,
        romanized: `r:${source}`,
      },
    ],
    warnings: [],
    versions: {
      engine: "test",
      dictionary: "test",
      romanizationPolicy: "ascii-hepburn-v1",
      spacingPolicy: "japanese-spacing-v1",
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LocalFrameEngineClient", () => {
  it("coalesces in-flight duplicates and reuses the bounded memory cache", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const sendMessage = vi.fn(async (rawRequest: unknown) => {
      const request = validateTransliterationBatchRequest(rawRequest);
      if (!request.ok) {
        throw new Error(request.error.code);
      }
      await gate;
      return createTransliterationBatchResponse(
        "content",
        request.value.requestId,
        request.value.items.map((item) => result(item.itemId, item.source)),
      );
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    const client = new LocalFrameEngineClient();

    const first = client.transliterate(["東京"]);
    const second = client.transliterate(["東京"]);
    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledTimes(1);
    });
    release();
    await expect(first).resolves.toMatchObject(
      new Map([["東京", { rendered: "r:東京" }]]),
    );
    await expect(second).resolves.toMatchObject(
      new Map([["東京", { rendered: "r:東京" }]]),
    );
    await client.transliterate(["東京"]);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("partitions more than 100 unique strings into bounded batches", async () => {
    const sendMessage = vi.fn((rawRequest: unknown) => {
      const request = validateTransliterationBatchRequest(rawRequest);
      if (!request.ok) {
        throw new Error(request.error.code);
      }
      return Promise.resolve(
        createTransliterationBatchResponse(
          "content",
          request.value.requestId,
          request.value.items.map((item) => result(item.itemId, item.source)),
        ),
      );
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    const client = new LocalFrameEngineClient();
    const sources = Array.from(
      { length: 101 },
      (_, index) => `東京${String(index)}`,
    );

    const output = await client.transliterate(sources);
    expect(output.size).toBe(101);
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });
});
