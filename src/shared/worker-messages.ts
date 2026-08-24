import { PROTOCOL_VERSION } from "./config";
import type { ProcessorProbeDetails } from "./messages";
import type {
  TransliterationRequest,
  TransliterationResult,
} from "../engines/contracts";
import {
  readTransliterationRequests,
  readTransliterationResults,
} from "./transliteration-validation";

export type JapaneseWorkerFailureReason =
  | "engine-module"
  | "engine-load"
  | "dictionary-fetch"
  | "dictionary-schema"
  | "wasm-compile"
  | "wasm-link"
  | "wasm-runtime"
  | "self-test"
  | "transliteration";

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
  readonly reason: Exclude<JapaneseWorkerFailureReason, "transliteration">;
}

export interface JapaneseWorkerBatchRequest {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: "worker.transliteration.batch.request";
  readonly requestId: string;
  readonly items: readonly TransliterationRequest[];
}

export interface JapaneseWorkerBatchResponse {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: "worker.transliteration.batch.response";
  readonly requestId: string;
  readonly results: readonly TransliterationResult[];
}

export interface JapaneseWorkerBatchFailure {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: "worker.transliteration.batch.failure";
  readonly requestId: string;
  readonly reason: JapaneseWorkerFailureReason;
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

export function createJapaneseWorkerBatchRequest(
  requestId: string,
  items: readonly TransliterationRequest[],
): JapaneseWorkerBatchRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "worker.transliteration.batch.request",
    requestId,
    items,
  };
}

export function createJapaneseWorkerBatchResponse(
  requestId: string,
  results: readonly TransliterationResult[],
): JapaneseWorkerBatchResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "worker.transliteration.batch.response",
    requestId,
    results,
  };
}

export function createJapaneseWorkerBatchFailure(
  requestId: string,
  reason: JapaneseWorkerFailureReason,
): JapaneseWorkerBatchFailure {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "worker.transliteration.batch.failure",
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
    typeof value.versions.spacingPolicy === "string" &&
    typeof value.measurements.coldReadyMs === "number" &&
    Number.isFinite(value.measurements.coldReadyMs) &&
    value.measurements.coldReadyMs >= 0 &&
    value.measurements.warmBatchItems === 100 &&
    typeof value.measurements.warmBatchMs === "number" &&
    Number.isFinite(value.measurements.warmBatchMs) &&
    value.measurements.warmBatchMs >= 0
  );
}

export function isJapaneseWorkerBatchRequest(
  value: unknown,
): value is JapaneseWorkerBatchRequest {
  return (
    isRecord(value) &&
    value.protocolVersion === PROTOCOL_VERSION &&
    value.type === "worker.transliteration.batch.request" &&
    typeof value.requestId === "string" &&
    readTransliterationRequests(value.items) !== null
  );
}

export function isJapaneseWorkerBatchResponse(
  value: unknown,
): value is JapaneseWorkerBatchResponse {
  return (
    isRecord(value) &&
    value.protocolVersion === PROTOCOL_VERSION &&
    value.type === "worker.transliteration.batch.response" &&
    typeof value.requestId === "string" &&
    readTransliterationResults(value.results) !== null
  );
}

function isWorkerFailureReason(
  value: unknown,
): value is JapaneseWorkerFailureReason {
  return (
    value === "engine-module" ||
    value === "engine-load" ||
    value === "dictionary-fetch" ||
    value === "dictionary-schema" ||
    value === "wasm-compile" ||
    value === "wasm-link" ||
    value === "wasm-runtime" ||
    value === "self-test" ||
    value === "transliteration"
  );
}

export function isJapaneseWorkerBatchFailure(
  value: unknown,
): value is JapaneseWorkerBatchFailure {
  return (
    isRecord(value) &&
    value.protocolVersion === PROTOCOL_VERSION &&
    value.type === "worker.transliteration.batch.failure" &&
    typeof value.requestId === "string" &&
    isWorkerFailureReason(value.reason)
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
