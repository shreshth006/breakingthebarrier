import { PROTOCOL_VERSION } from "./config";
import type { BtbError } from "./errors";
import type {
  TransliterationRequest,
  TransliterationResult,
} from "../engines/contracts";
import type { SitePolicy } from "../storage/schema";

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

export type PageCommand = "start" | "stop" | "status";
export type FrameSessionState =
  | "original"
  | "inspecting"
  | "starting"
  | "active"
  | "degraded"
  | "stopping";
export type PageStatusReason =
  | "no-supported-text"
  | "processor-failure"
  | "restricted-page"
  | null;

export interface FrameSessionSummary {
  readonly state: FrameSessionState;
  readonly reason: PageStatusReason;
  readonly eligibleNodes: number;
  readonly processedNodes: number;
  readonly failedNodes: number;
}

export interface PageCommandRequest {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "serviceWorker";
  readonly type: "page.command";
  readonly requestId: string;
  readonly command: PageCommand;
}

export interface ContentCommandRequest {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "content";
  readonly type: "content.command";
  readonly requestId: string;
  readonly command: PageCommand;
}

export interface ContentCommandResponse extends FrameSessionSummary {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "serviceWorker";
  readonly type: "content.command.response";
  readonly requestId: string;
}

export interface PageCommandResponse extends FrameSessionSummary {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "popup";
  readonly type: "page.command.response";
  readonly requestId: string;
}

export interface SitePolicyRequest {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "serviceWorker";
  readonly type: "site.policy.set";
  readonly requestId: string;
  readonly origin: string;
  readonly policy: SitePolicy | null;
}

export interface SitePolicyResponse {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "popup";
  readonly type: "site.policy.response";
  readonly requestId: string;
  readonly origin: string;
  readonly policy: SitePolicy | null;
  readonly permissionGranted: boolean;
  readonly registered: boolean;
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

export function createPageCommandRequest(
  requestId: string,
  command: PageCommand,
): PageCommandRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target: "serviceWorker",
    type: "page.command",
    requestId,
    command,
  };
}

export function createContentCommandRequest(
  requestId: string,
  command: PageCommand,
): ContentCommandRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target: "content",
    type: "content.command",
    requestId,
    command,
  };
}

export function createContentCommandResponse(
  requestId: string,
  summary: FrameSessionSummary,
): ContentCommandResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target: "serviceWorker",
    type: "content.command.response",
    requestId,
    state: summary.state,
    reason: summary.reason,
    eligibleNodes: summary.eligibleNodes,
    processedNodes: summary.processedNodes,
    failedNodes: summary.failedNodes,
  };
}

export function createPageCommandResponse(
  requestId: string,
  summary: FrameSessionSummary,
): PageCommandResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target: "popup",
    type: "page.command.response",
    requestId,
    state: summary.state,
    reason: summary.reason,
    eligibleNodes: summary.eligibleNodes,
    processedNodes: summary.processedNodes,
    failedNodes: summary.failedNodes,
  };
}

export function createSitePolicyRequest(
  requestId: string,
  origin: string,
  policy: SitePolicy | null,
): SitePolicyRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target: "serviceWorker",
    type: "site.policy.set",
    requestId,
    origin,
    policy,
  };
}

export function createSitePolicyResponse(
  requestId: string,
  origin: string,
  policy: SitePolicy | null,
  permissionGranted: boolean,
  registered: boolean,
): SitePolicyResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    target: "popup",
    type: "site.policy.response",
    requestId,
    origin,
    policy,
    permissionGranted,
    registered,
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
