import { PROTOCOL_VERSION } from "./config";
import type { BtbError } from "./errors";

export type MessageTarget = "serviceWorker" | "processor" | "popup";

export type ProcessorCapability = "lindera-wasm" | "kana-romanizer";

export interface ProcessorVersions {
  readonly lindera: string;
  readonly wanakana: string;
  readonly romanizationPolicy: string;
}

export interface ProcessorProbeDetails {
  readonly status: "ready";
  readonly capabilities: readonly ProcessorCapability[];
  readonly versions: ProcessorVersions;
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

export interface HealthErrorResponse {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly target: "popup" | "serviceWorker";
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
