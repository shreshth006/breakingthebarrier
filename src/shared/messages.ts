import { PROTOCOL_VERSION } from "./config";
import type { BtbError } from "./errors";
import type {
  TransliterationRequest,
  TransliterationResult,
} from "../engines/contracts";

export type MessageTarget =
  | "serviceWorker"
  | "processor"
  | "popup"
  | "content"
  | "diagnostics";
export type CallerTarget = "popup" | "content";

export type ProcessorMemoryStage =
  | "worker-created"
  | "wasm-initialized"
  | "dictionary-files-fetched"
  | "dictionary-constructed"
  | "tokenizer-constructed"
  | "temporary-buffers-released"
  | "batch-completed"
  | "stabilized";

export type ProcessorCapability =
  | "lindera-wasm"
  | "ipadic-tokenizer"
  | "kana-romanizer";

export interface ProcessorVersions {
  readonly lindera: string;
  readonly wanakana: string;
  readonly dictionary: string;
  readonly romanizationPolicy: string;
  readonly spacingPolicy: string;
}

export interface ProcessorMeasurements {
  readonly coldReadyMs: number;
  readonly warmBatchItems: 100;
  readonly warmBatchMs: number;
}

export interface ProcessorProbeDetails {
  readonly status: "ready";
  readonly capabilities: readonly ProcessorCapability[];
  readonly versions: ProcessorVersions;
  readonly measurements: ProcessorMeasurements;
  readonly selfTestPassed: true;
}

export interface ProcessorEnsureRequest {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "serviceWorker";
  readonly type: "processor.ensure";
  readonly requestId: string;
}

export interface ProcessorProbeRequest {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "processor";
  readonly type: "processor.probe";
  readonly requestId: string;
}

export interface ProcessorProbeResponse extends ProcessorProbeDetails {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "serviceWorker";
  readonly type: "processor.probe.response";
  readonly requestId: string;
}

export interface ProcessorEnsureResponse extends ProcessorProbeDetails {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "popup";
  readonly type: "processor.ensure.response";
  readonly requestId: string;
}

export interface ProcessorReleaseRequest {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "serviceWorker";
  readonly type: "processor.release";
  readonly requestId: string;
}

export interface ProcessorReleaseResponse {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: CallerTarget;
  readonly type: "processor.release.response";
  readonly requestId: string;
  readonly released: true;
}

export interface ProcessorMemoryDiagnosticRequest {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "serviceWorker";
  readonly type: "processor.memory.diagnostic";
  readonly requestId: string;
}

export interface ProcessorMemoryDiagnosticInternalRequest {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "processor";
  readonly type: "processor.memory.diagnostic.internal";
  readonly requestId: string;
}

export interface ProcessorMemoryDiagnosticInternalResponse
  extends ProcessorProbeDetails {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "serviceWorker";
  readonly type: "processor.memory.diagnostic.internal.response";
  readonly requestId: string;
}

export interface ProcessorMemoryDiagnosticResponse extends ProcessorProbeDetails {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: CallerTarget;
  readonly type: "processor.memory.diagnostic.response";
  readonly requestId: string;
}

export interface ProcessorMemoryStageEvent {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "diagnostics";
  readonly type: "processor.memory.stage";
  readonly requestId: string;
  readonly stage: ProcessorMemoryStage;
}

export interface TransliterationBatchRequest {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "serviceWorker";
  readonly type: "transliteration.batch.request";
  readonly requestId: string;
  readonly items: readonly TransliterationRequest[];
}

export interface ProcessorBatchRequest {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "processor";
  readonly type: "processor.transliteration.batch.request";
  readonly requestId: string;
  readonly items: readonly TransliterationRequest[];
}

export interface ProcessorBatchResponse {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "serviceWorker";
  readonly type: "processor.transliteration.batch.response";
  readonly requestId: string;
  readonly results: readonly TransliterationResult[];
}

export interface TransliterationBatchResponse {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: CallerTarget;
  readonly type: "transliteration.batch.response";
  readonly requestId: string;
  readonly results: readonly TransliterationResult[];
}

export interface HealthErrorResponse {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: CallerTarget | "serviceWorker";
  readonly type: "health.error";
  readonly requestId: string | null;
  readonly error: BtbError;
}

export function createProcessorEnsureRequest(
  requestId: string,
): ProcessorEnsureRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target: "serviceWorker",
    type: "processor.ensure",
    requestId,
  };
}

export function createProcessorProbeRequest(
  requestId: string,
): ProcessorProbeRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target: "processor",
    type: "processor.probe",
    requestId,
  };
}

export function createProcessorProbeResponse(
  requestId: string,
  details: ProcessorProbeDetails,
): ProcessorProbeResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target: "serviceWorker",
    type: "processor.probe.response",
    requestId,
    status: details.status,
    capabilities: details.capabilities,
    versions: details.versions,
    measurements: details.measurements,
    selfTestPassed: details.selfTestPassed,
  };
}

export function createProcessorEnsureResponse(
  requestId: string,
  details: ProcessorProbeDetails,
): ProcessorEnsureResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target: "popup",
    type: "processor.ensure.response",
    requestId,
    status: details.status,
    capabilities: details.capabilities,
    versions: details.versions,
    measurements: details.measurements,
    selfTestPassed: details.selfTestPassed,
  };
}

export function createHealthErrorResponse(
  target: HealthErrorResponse["target"],
  error: BtbError,
): HealthErrorResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target,
    type: "health.error",
    requestId: error.requestId,
    error,
  };
}

export function createProcessorReleaseRequest(
  requestId: string,
): ProcessorReleaseRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target: "serviceWorker",
    type: "processor.release",
    requestId,
  };
}

export function createProcessorReleaseResponse(
  target: CallerTarget,
  requestId: string,
): ProcessorReleaseResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target,
    type: "processor.release.response",
    requestId,
    released: true,
  };
}

export function createProcessorMemoryDiagnosticRequest(
  requestId: string,
): ProcessorMemoryDiagnosticRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target: "serviceWorker",
    type: "processor.memory.diagnostic",
    requestId,
  };
}

export function createProcessorMemoryDiagnosticInternalRequest(
  requestId: string,
): ProcessorMemoryDiagnosticInternalRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target: "processor",
    type: "processor.memory.diagnostic.internal",
    requestId,
  };
}

export function createProcessorMemoryDiagnosticInternalResponse(
  requestId: string,
  details: ProcessorProbeDetails,
): ProcessorMemoryDiagnosticInternalResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target: "serviceWorker",
    type: "processor.memory.diagnostic.internal.response",
    requestId,
    status: details.status,
    capabilities: details.capabilities,
    versions: details.versions,
    measurements: details.measurements,
    selfTestPassed: details.selfTestPassed,
  };
}

export function createProcessorMemoryDiagnosticResponse(
  target: CallerTarget,
  requestId: string,
  details: ProcessorProbeDetails,
): ProcessorMemoryDiagnosticResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target,
    type: "processor.memory.diagnostic.response",
    requestId,
    status: details.status,
    capabilities: details.capabilities,
    versions: details.versions,
    measurements: details.measurements,
    selfTestPassed: details.selfTestPassed,
  };
}

export function createProcessorMemoryStageEvent(
  requestId: string,
  stage: ProcessorMemoryStage,
): ProcessorMemoryStageEvent {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target: "diagnostics",
    type: "processor.memory.stage",
    requestId,
    stage,
  };
}

export function createTransliterationBatchRequest(
  requestId: string,
  items: readonly TransliterationRequest[],
): TransliterationBatchRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target: "serviceWorker",
    type: "transliteration.batch.request",
    requestId,
    items,
  };
}

export function createProcessorBatchRequest(
  requestId: string,
  items: readonly TransliterationRequest[],
): ProcessorBatchRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target: "processor",
    type: "processor.transliteration.batch.request",
    requestId,
    items,
  };
}

export function createProcessorBatchResponse(
  requestId: string,
  results: readonly TransliterationResult[],
): ProcessorBatchResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target: "serviceWorker",
    type: "processor.transliteration.batch.response",
    requestId,
    results,
  };
}

export function createTransliterationBatchResponse(
  target: CallerTarget,
  requestId: string,
  results: readonly TransliterationResult[],
): TransliterationBatchResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target,
    type: "transliteration.batch.response",
    requestId,
    results,
  };
}
