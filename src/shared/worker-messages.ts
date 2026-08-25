import { PROTOCOL_VERSION } from "./config";
import type {
  ProcessorMemoryStage,
  ProcessorProbeDetails,
} from "./messages";
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

export interface JapaneseWorkerMemoryDiagnosticRequest {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: "worker.memory.diagnostic";
  readonly requestId: string;
}

export interface JapaneseWorkerMemoryDiagnosticResponse
  extends ProcessorProbeDetails {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: "worker.memory.diagnostic.response";
  readonly requestId: string;
}

export interface JapaneseWorkerMemoryStageEvent {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: "worker.memory.stage";
  readonly requestId: string;
  readonly stage: ProcessorMemoryStage;
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

export function createJapaneseWorkerMemoryDiagnosticRequest(
  requestId: string,
): JapaneseWorkerMemoryDiagnosticRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "worker.memory.diagnostic",
    requestId,
  };
}

export function createJapaneseWorkerMemoryDiagnosticResponse(
  requestId: string,
  details: ProcessorProbeDetails,
): JapaneseWorkerMemoryDiagnosticResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "worker.memory.diagnostic.response",
    requestId,
    status: details.status,
    capabilities: details.capabilities,
    versions: details.versions,
    measurements: details.measurements,
    selfTestPassed: details.selfTestPassed,
  };
}

export function createJapaneseWorkerMemoryStageEvent(
  requestId: string,
  stage: ProcessorMemoryStage,
): JapaneseWorkerMemoryStageEvent {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "worker.memory.stage",
    requestId,
    stage,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProcessorMemoryStage(
  value: unknown,
): value is ProcessorMemoryStage {
  return (
    value === "worker-created" ||
    value === "wasm-initialized" ||
    value === "dictionary-files-fetched" ||
    value === "dictionary-constructed" ||
    value === "tokenizer-constructed" ||
    value === "temporary-buffers-released" ||
    value === "batch-completed" ||
    value === "stabilized"
  );
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

export function isJapaneseWorkerMemoryDiagnosticRequest(
  value: unknown,
): value is JapaneseWorkerMemoryDiagnosticRequest {
  return (
    isRecord(value) &&
    value.protocolVersion === PROTOCOL_VERSION &&
    value.type === "worker.memory.diagnostic" &&
    typeof value.requestId === "string"
  );
}

export function isJapaneseWorkerMemoryDiagnosticResponse(
  value: unknown,
): value is JapaneseWorkerMemoryDiagnosticResponse {
  return (
    isJapaneseWorkerProbeResponse({
      ...(isRecord(value) ? value : {}),
      type: "worker.probe.response",
    }) &&
    isRecord(value) &&
    value.type === "worker.memory.diagnostic.response"
  );
}

export function isJapaneseWorkerMemoryStageEvent(
  value: unknown,
): value is JapaneseWorkerMemoryStageEvent {
  return (
    isRecord(value) &&
    value.protocolVersion === PROTOCOL_VERSION &&
    value.type === "worker.memory.stage" &&
    typeof value.requestId === "string" &&
    isProcessorMemoryStage(value.stage)
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
