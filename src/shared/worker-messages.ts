import { PROTOCOL_VERSION } from "./config";
import type { ProcessorProbeDetails } from "./messages";

export interface JapaneseWorkerProbeRequest {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: "worker.probe";
  readonly requestId: string;
}

export interface JapaneseWorkerProbeResponse extends ProcessorProbeDetails {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: "worker.probe.response";
  readonly requestId: string;
}

export interface JapaneseWorkerProbeFailure {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: "worker.probe.failure";
  readonly requestId: string;
  readonly reason:
    | "engine-module"
    | "engine-load"
    | "dictionary-fetch"
    | "dictionary-schema"
    | "wasm-compile"
    | "wasm-link"
    | "wasm-runtime"
    | "self-test";
}

export function createJapaneseWorkerProbeRequest(
  requestId: string,
): JapaneseWorkerProbeRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "worker.probe",
    requestId,
  };
}

export function createJapaneseWorkerProbeResponse(
  requestId: string,
  details: ProcessorProbeDetails,
): JapaneseWorkerProbeResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "worker.probe.response",
    requestId,
    ...details,
  };
}

export function createJapaneseWorkerProbeFailure(
  requestId: string,
  reason: JapaneseWorkerProbeFailure["reason"],
): JapaneseWorkerProbeFailure {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "worker.probe.failure",
    requestId,
    reason,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isJapaneseWorkerProbeRequest(
  value: unknown,
): value is JapaneseWorkerProbeRequest {
  return (
    isRecord(value) &&
    value.protocolVersion === PROTOCOL_VERSION &&
    value.type === "worker.probe" &&
    typeof value.requestId === "string"
  );
}

export function isJapaneseWorkerProbeResponse(
  value: unknown,
): value is JapaneseWorkerProbeResponse {
  if (
    !isRecord(value) ||
    !isRecord(value.versions) ||
    !isRecord(value.measurements)
  ) {
    return false;
  }

  return (
    value.protocolVersion === PROTOCOL_VERSION &&
    value.type === "worker.probe.response" &&
    typeof value.requestId === "string" &&
    value.status === "ready" &&
    value.selfTestPassed === true &&
    Array.isArray(value.capabilities) &&
    value.capabilities.includes("lindera-wasm") &&
    value.capabilities.includes("ipadic-tokenizer") &&
    value.capabilities.includes("kana-romanizer") &&
    typeof value.versions.lindera === "string" &&
    typeof value.versions.wanakana === "string" &&
    typeof value.versions.dictionary === "string" &&
    typeof value.versions.romanizationPolicy === "string" &&
    typeof value.versions.spacingPolicy === "string"
    && typeof value.measurements.coldReadyMs === "number"
    && Number.isFinite(value.measurements.coldReadyMs)
    && value.measurements.coldReadyMs >= 0
    && value.measurements.warmBatchItems === 100
    && typeof value.measurements.warmBatchMs === "number"
    && Number.isFinite(value.measurements.warmBatchMs)
    && value.measurements.warmBatchMs >= 0
  );
}

export function isJapaneseWorkerProbeFailure(
  value: unknown,
): value is JapaneseWorkerProbeFailure {
  return (
    isRecord(value) &&
    value.protocolVersion === PROTOCOL_VERSION &&
    value.type === "worker.probe.failure" &&
    typeof value.requestId === "string" &&
    (value.reason === "engine-module" ||
      value.reason === "engine-load" ||
      value.reason === "dictionary-fetch" ||
      value.reason === "dictionary-schema" ||
      value.reason === "wasm-compile" ||
      value.reason === "wasm-link" ||
      value.reason === "wasm-runtime" ||
      value.reason === "self-test")
  );
}
