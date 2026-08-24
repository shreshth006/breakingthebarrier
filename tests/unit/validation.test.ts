import { describe, expect, it } from "vitest";
import { MAX_REQUEST_ID_LENGTH, PROTOCOL_VERSION } from "../../src/shared/config";
import {
  createProcessorEnsureRequest,
  createProcessorEnsureResponse,
  createProcessorProbeResponse,
} from "../../src/shared/messages";
import {
  getMessageTarget,
  validateHealthErrorResponse,
  validateProcessorEnsureRequest,
  validateProcessorEnsureResponse,
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
