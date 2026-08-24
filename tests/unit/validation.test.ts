import { describe, expect, it } from "vitest";
import {
  MAX_REQUEST_ID_LENGTH,
  MAX_TRANSLITERATION_SOURCE_UTF16,
  PROTOCOL_VERSION,
} from "../../src/shared/config";
import {
  createProcessorBatchRequest,
  createProcessorBatchResponse,
  createProcessorEnsureRequest,
  createProcessorEnsureResponse,
  createProcessorProbeResponse,
  createTransliterationBatchRequest,
  createTransliterationBatchResponse,
} from "../../src/shared/messages";
import {
  getMessageTarget,
  validateHealthErrorResponse,
  validateProcessorBatchRequest,
  validateProcessorBatchResponse,
  validateProcessorEnsureRequest,
  validateProcessorEnsureResponse,
  validateTransliterationBatchRequest,
  validateTransliterationBatchResponse,
} from "../../src/shared/validation";

const probeDetails = {
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
} as const;

const transliterationItems = [
  {
    itemId: "title",
    source: "東京",
    language: "ja",
    romanizationPolicy: "ascii-hepburn-v1",
  },
] as const;

const transliterationResults = [
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

describe("runtime message validation", () => {
  it("accepts a bounded processor ensure request", () => {
    const request = createProcessorEnsureRequest("request-1");

    expect(validateProcessorEnsureRequest(request)).toEqual({
      ok: true,
      value: request,
    });
    expect(getMessageTarget(request)).toBe("serviceWorker");
  });

  it("rejects unknown protocol versions", () => {
    const result = validateProcessorEnsureRequest({
      ...createProcessorEnsureRequest("request-1"),
      protocolVersion: PROTOCOL_VERSION + 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid-message");
      expect(result.error.requestId).toBe("request-1");
    }
  });

  it("rejects oversized request identifiers", () => {
    const result = validateProcessorEnsureRequest(
      createProcessorEnsureRequest("x".repeat(MAX_REQUEST_ID_LENGTH + 1)),
    );

    expect(result.ok).toBe(false);
  });

  it("rebuilds a valid processor response at the boundary", () => {
    const response = createProcessorEnsureResponse("request-1", probeDetails);

    expect(validateProcessorEnsureResponse(response)).toEqual({
      ok: true,
      value: response,
    });
  });

  it("validates caller and processor batch requests", () => {
    const callerRequest = createTransliterationBatchRequest(
      "batch-1",
      transliterationItems,
    );
    const processorRequest = createProcessorBatchRequest(
      "batch-1",
      transliterationItems,
    );

    expect(validateTransliterationBatchRequest(callerRequest)).toEqual({
      ok: true,
      value: callerRequest,
    });
    expect(validateProcessorBatchRequest(processorRequest)).toEqual({
      ok: true,
      value: processorRequest,
    });
  });

  it("rejects an oversized transliteration item with a correlated error", () => {
    const result = validateTransliterationBatchRequest(
      createTransliterationBatchRequest("batch-large", [
        {
          ...transliterationItems[0],
          source: "x".repeat(MAX_TRANSLITERATION_SOURCE_UTF16 + 1),
        },
      ]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.requestId).toBe("batch-large");
    }
  });

  it("validates processor and caller batch responses", () => {
    const processorResponse = createProcessorBatchResponse(
      "batch-1",
      transliterationResults,
    );
    const callerResponse = createTransliterationBatchResponse(
      "content",
      "batch-1",
      transliterationResults,
    );

    expect(validateProcessorBatchResponse(processorResponse)).toEqual({
      ok: true,
      value: processorResponse,
    });
    expect(
      validateTransliterationBatchResponse(callerResponse, "content"),
    ).toEqual({ ok: true, value: callerResponse });
    expect(
      validateTransliterationBatchResponse(callerResponse, "popup").ok,
    ).toBe(false);
  });

  it("does not let an inner worker envelope overwrite outer discriminants", () => {
    const workerEnvelope = {
      protocolVersion: PROTOCOL_VERSION,
      target: "processor",
      type: "worker.probe.response",
      requestId: "inner-request",
      ...probeDetails,
    } as const;

    expect(createProcessorProbeResponse("outer-request", workerEnvelope)).toMatchObject({
      target: "serviceWorker",
      type: "processor.probe.response",
      requestId: "outer-request",
    });
    expect(createProcessorEnsureResponse("popup-request", workerEnvelope)).toMatchObject({
      target: "popup",
      type: "processor.ensure.response",
      requestId: "popup-request",
    });
  });

  it("rejects malformed safe-error responses", () => {
    const result = validateHealthErrorResponse({
      protocolVersion: PROTOCOL_VERSION,
      target: "popup",
      type: "health.error",
      requestId: "request-1",
      error: {
        code: "processor-unavailable",
        subsystem: "platform",
        severity: "recoverable",
        retryable: true,
        causeCategory: "browser-api",
        requestId: "different-request",
      },
    });

    expect(result.ok).toBe(false);
  });
});
