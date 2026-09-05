import {
  MAX_ORIGIN_LENGTH,
  MAX_REQUEST_ID_LENGTH,
  PROTOCOL_VERSION,
} from "./config";
import { createBtbError } from "./errors";
import type { BtbError } from "./errors";
import type {
  HealthErrorResponse,
  ContentCommandRequest,
  ContentCommandResponse,
  FrameSessionState,
  FrameSessionSummary,
  MessageTarget,
  PageCommand,
  PageCommandRequest,
  PageCommandResponse,
  PageStatusReason,
  RememberedPageAction,
  RememberedPageCommand,
  RememberedPageRequest,
  RememberedPageResponse,
  SitePolicyRequest,
  SitePolicyResponse,
  ProcessorMemoryDiagnosticInternalRequest,
  ProcessorMemoryDiagnosticInternalResponse,
  ProcessorMemoryDiagnosticRequest,
  ProcessorMemoryDiagnosticResponse,
  ProcessorMemoryStage,
  ProcessorMemoryStageEvent,
  ProcessorReleaseRequest,
  ProcessorReleaseResponse,
  ProcessorEnsureRequest,
  ProcessorEnsureResponse,
  ProcessorProbeRequest,
  ProcessorProbeResponse,
  ProcessorMeasurements,
  ProcessorBatchRequest,
  ProcessorBatchResponse,
  ProcessorVersions,
  TransliterationBatchRequest,
  TransliterationBatchResponse,
} from "./messages";
import type { SitePolicy } from "../storage/schema";
import {
  readTransliterationRequests,
  readTransliterationResults,
} from "./transliteration-validation";

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: BtbError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRequestId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_REQUEST_ID_LENGTH
  );
}

function isOrigin(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_ORIGIN_LENGTH
  );
}

function readSitePolicy(value: unknown): SitePolicy | null | undefined {
  return value === null ||
    value === "ask" ||
    value === "always" ||
    value === "disabled"
    ? value
    : undefined;
}

function readRememberedPageCommand(
  value: unknown,
): RememberedPageCommand | null {
  return value === "bootstrap" || value === "start" ? value : null;
}

function readRememberedPageAction(
  value: unknown,
): RememberedPageAction | null {
  return value === "inactive" || value === "ask" || value === "active"
    ? value
    : null;
}

function invalidMessage(requestId: string | null): ValidationResult<never> {
  return {
    ok: false,
    error: createBtbError(
      "invalid-message",
      "messaging",
      "boundary",
      false,
      requestId,
    ),
  };
}

function requestIdFrom(value: Record<string, unknown>): string | null {
  return isRequestId(value.requestId) ? value.requestId : null;
}

function hasProtocol(value: Record<string, unknown>): boolean {
  return value.protocolVersion === PROTOCOL_VERSION;
}

export function getMessageTarget(value: unknown): MessageTarget | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    value.target === "serviceWorker" ||
    value.target === "processor" ||
    value.target === "popup" ||
    value.target === "content" ||
    value.target === "diagnostics"
  ) {
    return value.target;
  }

  return null;
}

function readPageCommand(value: unknown): PageCommand | null {
  return value === "start" || value === "stop" || value === "status"
    ? value
    : null;
}

function readFrameSessionState(value: unknown): FrameSessionState | null {
  return value === "original" ||
    value === "inspecting" ||
    value === "starting" ||
    value === "active" ||
    value === "degraded" ||
    value === "stopping"
    ? value
    : null;
}

function readPageStatusReason(value: unknown): PageStatusReason | undefined {
  return value === null ||
    value === "japanese-detected" ||
    value === "no-supported-text" ||
    value === "processor-failure" ||
    value === "restricted-page"
    ? value
    : undefined;
}

function readNonnegativeInteger(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function readFrameSessionSummary(
  value: Record<string, unknown>,
): FrameSessionSummary | null {
  const state = readFrameSessionState(value.state);
  const reason = readPageStatusReason(value.reason);
  const eligibleNodes = readNonnegativeInteger(value.eligibleNodes);
  const processedNodes = readNonnegativeInteger(value.processedNodes);
  const failedNodes = readNonnegativeInteger(value.failedNodes);
  if (
    state === null ||
    reason === undefined ||
    eligibleNodes === null ||
    processedNodes === null ||
    failedNodes === null ||
    processedNodes + failedNodes > eligibleNodes
  ) {
    return null;
  }
  return { state, reason, eligibleNodes, processedNodes, failedNodes };
}

function validateCommandRequestEnvelope(
  value: unknown,
  target: "serviceWorker" | "content",
  type: "page.command" | "content.command",
): ValidationResult<PageCommandRequest | ContentCommandRequest> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }
  const requestId = requestIdFrom(value);
  const command = readPageCommand(value.command);
  if (
    !hasProtocol(value) ||
    value.target !== target ||
    value.type !== type ||
    requestId === null ||
    command === null
  ) {
    return invalidMessage(requestId);
  }
  return target === "serviceWorker"
    ? {
        ok: true,
        value: {
          protocolVersion: PROTOCOL_VERSION,
          target: "serviceWorker",
          type: "page.command",
          requestId,
          command,
        },
      }
    : {
        ok: true,
        value: {
          protocolVersion: PROTOCOL_VERSION,
          target: "content",
          type: "content.command",
          requestId,
          command,
        },
      };
}

export function validatePageCommandRequest(
  value: unknown,
): ValidationResult<PageCommandRequest> {
  return validateCommandRequestEnvelope(
    value,
    "serviceWorker",
    "page.command",
  ) as ValidationResult<PageCommandRequest>;
}

export function validateContentCommandRequest(
  value: unknown,
): ValidationResult<ContentCommandRequest> {
  return validateCommandRequestEnvelope(
    value,
    "content",
    "content.command",
  ) as ValidationResult<ContentCommandRequest>;
}

function validateCommandResponseEnvelope(
  value: unknown,
  target: "serviceWorker" | "popup",
  type: "content.command.response" | "page.command.response",
): ValidationResult<ContentCommandResponse | PageCommandResponse> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }
  const requestId = requestIdFrom(value);
  const summary = readFrameSessionSummary(value);
  if (
    !hasProtocol(value) ||
    value.target !== target ||
    value.type !== type ||
    requestId === null ||
    summary === null
  ) {
    return invalidMessage(requestId);
  }
  return target === "serviceWorker"
    ? {
        ok: true,
        value: {
          protocolVersion: PROTOCOL_VERSION,
          target: "serviceWorker",
          type: "content.command.response",
          requestId,
          ...summary,
        },
      }
    : {
        ok: true,
        value: {
          protocolVersion: PROTOCOL_VERSION,
          target: "popup",
          type: "page.command.response",
          requestId,
          ...summary,
        },
      };
}

export function validateContentCommandResponse(
  value: unknown,
): ValidationResult<ContentCommandResponse> {
  return validateCommandResponseEnvelope(
    value,
    "serviceWorker",
    "content.command.response",
  ) as ValidationResult<ContentCommandResponse>;
}

export function validatePageCommandResponse(
  value: unknown,
): ValidationResult<PageCommandResponse> {
  return validateCommandResponseEnvelope(
    value,
    "popup",
    "page.command.response",
  ) as ValidationResult<PageCommandResponse>;
}

export function validateSitePolicyRequest(
  value: unknown,
): ValidationResult<SitePolicyRequest> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }
  const requestId = requestIdFrom(value);
  const policy = readSitePolicy(value.policy);
  if (
    !hasProtocol(value) ||
    value.target !== "serviceWorker" ||
    value.type !== "site.policy.set" ||
    requestId === null ||
    !isOrigin(value.origin) ||
    policy === undefined
  ) {
    return invalidMessage(requestId);
  }
  return {
    ok: true,
    value: {
      protocolVersion: PROTOCOL_VERSION,
      target: "serviceWorker",
      type: "site.policy.set",
      requestId,
      origin: value.origin,
      policy,
    },
  };
}

export function validateSitePolicyResponse(
  value: unknown,
): ValidationResult<SitePolicyResponse> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }
  const requestId = requestIdFrom(value);
  const policy = readSitePolicy(value.policy);
  if (
    !hasProtocol(value) ||
    value.target !== "popup" ||
    value.type !== "site.policy.response" ||
    requestId === null ||
    !isOrigin(value.origin) ||
    policy === undefined ||
    typeof value.permissionGranted !== "boolean" ||
    typeof value.registered !== "boolean"
  ) {
    return invalidMessage(requestId);
  }
  return {
    ok: true,
    value: {
      protocolVersion: PROTOCOL_VERSION,
      target: "popup",
      type: "site.policy.response",
      requestId,
      origin: value.origin,
      policy,
      permissionGranted: value.permissionGranted,
      registered: value.registered,
    },
  };
}

export function validateRememberedPageRequest(
  value: unknown,
): ValidationResult<RememberedPageRequest> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }
  const requestId = requestIdFrom(value);
  const command = readRememberedPageCommand(value.command);
  if (
    !hasProtocol(value) ||
    value.target !== "serviceWorker" ||
    value.type !== "remembered.page.command" ||
    requestId === null ||
    command === null
  ) {
    return invalidMessage(requestId);
  }
  return {
    ok: true,
    value: {
      protocolVersion: PROTOCOL_VERSION,
      target: "serviceWorker",
      type: "remembered.page.command",
      requestId,
      command,
    },
  };
}

export function validateRememberedPageResponse(
  value: unknown,
): ValidationResult<RememberedPageResponse> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }
  const requestId = requestIdFrom(value);
  const action = readRememberedPageAction(value.action);
  const summary = readFrameSessionSummary(value);
  if (
    !hasProtocol(value) ||
    value.target !== "content" ||
    value.type !== "remembered.page.response" ||
    requestId === null ||
    action === null ||
    summary === null
  ) {
    return invalidMessage(requestId);
  }
  return {
    ok: true,
    value: {
      protocolVersion: PROTOCOL_VERSION,
      target: "content",
      type: "remembered.page.response",
      requestId,
      action,
      ...summary,
    },
  };
}

export function validateProcessorReleaseRequest(
  value: unknown,
): ValidationResult<ProcessorReleaseRequest> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }
  const requestId = requestIdFrom(value);
  if (
    !hasProtocol(value) ||
    value.target !== "serviceWorker" ||
    value.type !== "processor.release" ||
    requestId === null
  ) {
    return invalidMessage(requestId);
  }
  return {
    ok: true,
    value: {
      protocolVersion: PROTOCOL_VERSION,
      target: "serviceWorker",
      type: "processor.release",
      requestId,
    },
  };
}

export function validateProcessorMemoryDiagnosticRequest(
  value: unknown,
): ValidationResult<ProcessorMemoryDiagnosticRequest> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }
  const requestId = requestIdFrom(value);
  if (
    !hasProtocol(value) ||
    value.target !== "serviceWorker" ||
    value.type !== "processor.memory.diagnostic" ||
    requestId === null
  ) {
    return invalidMessage(requestId);
  }
  return {
    ok: true,
    value: {
      protocolVersion: PROTOCOL_VERSION,
      target: "serviceWorker",
      type: "processor.memory.diagnostic",
      requestId,
    },
  };
}

export function validateProcessorMemoryDiagnosticInternalRequest(
  value: unknown,
): ValidationResult<ProcessorMemoryDiagnosticInternalRequest> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }
  const requestId = requestIdFrom(value);
  if (
    !hasProtocol(value) ||
    value.target !== "processor" ||
    value.type !== "processor.memory.diagnostic.internal" ||
    requestId === null
  ) {
    return invalidMessage(requestId);
  }
  return {
    ok: true,
    value: {
      protocolVersion: PROTOCOL_VERSION,
      target: "processor",
      type: "processor.memory.diagnostic.internal",
      requestId,
    },
  };
}

export function validateProcessorEnsureRequest(
  value: unknown,
): ValidationResult<ProcessorEnsureRequest> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }

  const requestId = requestIdFrom(value);
  if (
    !hasProtocol(value) ||
    value.target !== "serviceWorker" ||
    value.type !== "processor.ensure" ||
    requestId === null
  ) {
    return invalidMessage(requestId);
  }

  return {
    ok: true,
    value: {
      protocolVersion: PROTOCOL_VERSION,
      target: "serviceWorker",
      type: "processor.ensure",
      requestId,
    },
  };
}

export function validateProcessorProbeRequest(
  value: unknown,
): ValidationResult<ProcessorProbeRequest> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }

  const requestId = requestIdFrom(value);
  if (
    !hasProtocol(value) ||
    value.target !== "processor" ||
    value.type !== "processor.probe" ||
    requestId === null
  ) {
    return invalidMessage(requestId);
  }

  return {
    ok: true,
    value: {
      protocolVersion: PROTOCOL_VERSION,
      target: "processor",
      type: "processor.probe",
      requestId,
    },
  };
}

function validateBatchRequestEnvelope(
  value: unknown,
  target: "serviceWorker" | "processor",
  type:
    | "transliteration.batch.request"
    | "processor.transliteration.batch.request",
): ValidationResult<TransliterationBatchRequest | ProcessorBatchRequest> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }

  const requestId = requestIdFrom(value);
  const items = readTransliterationRequests(value.items);
  if (
    !hasProtocol(value) ||
    value.target !== target ||
    value.type !== type ||
    requestId === null ||
    items === null
  ) {
    return invalidMessage(requestId);
  }

  return target === "serviceWorker"
    ? {
        ok: true,
        value: {
          protocolVersion: PROTOCOL_VERSION,
          target: "serviceWorker",
          type: "transliteration.batch.request",
          requestId,
          items,
        },
      }
    : {
        ok: true,
        value: {
          protocolVersion: PROTOCOL_VERSION,
          target: "processor",
          type: "processor.transliteration.batch.request",
          requestId,
          items,
        },
      };
}

export function validateTransliterationBatchRequest(
  value: unknown,
): ValidationResult<TransliterationBatchRequest> {
  return validateBatchRequestEnvelope(
    value,
    "serviceWorker",
    "transliteration.batch.request",
  ) as ValidationResult<TransliterationBatchRequest>;
}

export function validateProcessorBatchRequest(
  value: unknown,
): ValidationResult<ProcessorBatchRequest> {
  return validateBatchRequestEnvelope(
    value,
    "processor",
    "processor.transliteration.batch.request",
  ) as ValidationResult<ProcessorBatchRequest>;
}

function readVersions(value: unknown): ProcessorVersions | null {
  if (
    !isRecord(value) ||
    typeof value.lindera !== "string" ||
    typeof value.wanakana !== "string" ||
    typeof value.dictionary !== "string" ||
    typeof value.romanizationPolicy !== "string" ||
    typeof value.spacingPolicy !== "string"
  ) {
    return null;
  }

  return {
    lindera: value.lindera,
    wanakana: value.wanakana,
    dictionary: value.dictionary,
    romanizationPolicy: value.romanizationPolicy,
    spacingPolicy: value.spacingPolicy,
  };
}

function hasExpectedCapabilities(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.includes("lindera-wasm") &&
    value.includes("ipadic-tokenizer") &&
    value.includes("kana-romanizer")
  );
}

function readMeasurements(value: unknown): ProcessorMeasurements | null {
  if (
    !isRecord(value) ||
    typeof value.coldReadyMs !== "number" ||
    !Number.isFinite(value.coldReadyMs) ||
    value.coldReadyMs < 0 ||
    value.warmBatchItems !== 100 ||
    typeof value.warmBatchMs !== "number" ||
    !Number.isFinite(value.warmBatchMs) ||
    value.warmBatchMs < 0
  ) {
    return null;
  }

  return {
    coldReadyMs: value.coldReadyMs,
    warmBatchItems: 100,
    warmBatchMs: value.warmBatchMs,
  };
}

function readProbeDetails(
  value: Record<string, unknown>,
): Omit<ProcessorProbeResponse, "protocolVersion" | "target" | "type" | "requestId"> | null {
  const versions = readVersions(value.versions);
  const measurements = readMeasurements(value.measurements);
  if (
    value.status !== "ready" ||
    value.selfTestPassed !== true ||
    !hasExpectedCapabilities(value.capabilities) ||
    versions === null ||
    measurements === null
  ) {
    return null;
  }

  return {
    status: "ready",
    capabilities: ["lindera-wasm", "ipadic-tokenizer", "kana-romanizer"],
    versions,
    measurements,
    selfTestPassed: true,
  };
}

export function validateProcessorProbeResponse(
  value: unknown,
): ValidationResult<ProcessorProbeResponse> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }

  const requestId = requestIdFrom(value);
  const details = readProbeDetails(value);
  if (
    !hasProtocol(value) ||
    value.target !== "serviceWorker" ||
    value.type !== "processor.probe.response" ||
    requestId === null ||
    details === null
  ) {
    return invalidMessage(requestId);
  }

  return {
    ok: true,
    value: {
      protocolVersion: PROTOCOL_VERSION,
      target: "serviceWorker",
      type: "processor.probe.response",
      requestId,
      ...details,
    },
  };
}

export function validateProcessorEnsureResponse(
  value: unknown,
): ValidationResult<ProcessorEnsureResponse> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }

  const requestId = requestIdFrom(value);
  const details = readProbeDetails(value);
  if (
    !hasProtocol(value) ||
    value.target !== "popup" ||
    value.type !== "processor.ensure.response" ||
    requestId === null ||
    details === null
  ) {
    return invalidMessage(requestId);
  }

  return {
    ok: true,
    value: {
      protocolVersion: PROTOCOL_VERSION,
      target: "popup",
      type: "processor.ensure.response",
      requestId,
      ...details,
    },
  };
}

export function validateProcessorReleaseResponse(
  value: unknown,
  target: "popup" | "content",
): ValidationResult<ProcessorReleaseResponse> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }
  const requestId = requestIdFrom(value);
  if (
    !hasProtocol(value) ||
    value.target !== target ||
    value.type !== "processor.release.response" ||
    value.released !== true ||
    requestId === null
  ) {
    return invalidMessage(requestId);
  }
  return {
    ok: true,
    value: {
      protocolVersion: PROTOCOL_VERSION,
      target,
      type: "processor.release.response",
      requestId,
      released: true,
    },
  };
}

function validateMemoryDiagnosticResponseEnvelope(
  value: unknown,
  target: "serviceWorker" | "popup" | "content",
  type:
    | "processor.memory.diagnostic.internal.response"
    | "processor.memory.diagnostic.response",
): ValidationResult<
  ProcessorMemoryDiagnosticInternalResponse | ProcessorMemoryDiagnosticResponse
> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }
  const requestId = requestIdFrom(value);
  const details = readProbeDetails(value);
  if (
    !hasProtocol(value) ||
    value.target !== target ||
    value.type !== type ||
    requestId === null ||
    details === null
  ) {
    return invalidMessage(requestId);
  }
  return target === "serviceWorker"
    ? {
        ok: true,
        value: {
          protocolVersion: PROTOCOL_VERSION,
          target: "serviceWorker",
          type: "processor.memory.diagnostic.internal.response",
          requestId,
          ...details,
        },
      }
    : {
        ok: true,
        value: {
          protocolVersion: PROTOCOL_VERSION,
          target,
          type: "processor.memory.diagnostic.response",
          requestId,
          ...details,
        },
      };
}

export function validateProcessorMemoryDiagnosticInternalResponse(
  value: unknown,
): ValidationResult<ProcessorMemoryDiagnosticInternalResponse> {
  return validateMemoryDiagnosticResponseEnvelope(
    value,
    "serviceWorker",
    "processor.memory.diagnostic.internal.response",
  ) as ValidationResult<ProcessorMemoryDiagnosticInternalResponse>;
}

export function validateProcessorMemoryDiagnosticResponse(
  value: unknown,
  target: "popup" | "content",
): ValidationResult<ProcessorMemoryDiagnosticResponse> {
  return validateMemoryDiagnosticResponseEnvelope(
    value,
    target,
    "processor.memory.diagnostic.response",
  ) as ValidationResult<ProcessorMemoryDiagnosticResponse>;
}

function isProcessorMemoryStage(value: unknown): value is ProcessorMemoryStage {
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

export function validateProcessorMemoryStageEvent(
  value: unknown,
): ValidationResult<ProcessorMemoryStageEvent> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }
  const requestId = requestIdFrom(value);
  if (
    !hasProtocol(value) ||
    value.target !== "diagnostics" ||
    value.type !== "processor.memory.stage" ||
    requestId === null ||
    !isProcessorMemoryStage(value.stage)
  ) {
    return invalidMessage(requestId);
  }
  return {
    ok: true,
    value: {
      protocolVersion: PROTOCOL_VERSION,
      target: "diagnostics",
      type: "processor.memory.stage",
      requestId,
      stage: value.stage,
    },
  };
}

function validateBatchResponseEnvelope(
  value: unknown,
  target: "serviceWorker" | "popup" | "content",
  type:
    | "processor.transliteration.batch.response"
    | "transliteration.batch.response",
): ValidationResult<ProcessorBatchResponse | TransliterationBatchResponse> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }

  const requestId = requestIdFrom(value);
  const results = readTransliterationResults(value.results);
  if (
    !hasProtocol(value) ||
    value.target !== target ||
    value.type !== type ||
    requestId === null ||
    results === null
  ) {
    return invalidMessage(requestId);
  }

  return target === "serviceWorker"
    ? {
        ok: true,
        value: {
          protocolVersion: PROTOCOL_VERSION,
          target: "serviceWorker",
          type: "processor.transliteration.batch.response",
          requestId,
          results,
        },
      }
    : {
        ok: true,
        value: {
          protocolVersion: PROTOCOL_VERSION,
          target,
          type: "transliteration.batch.response",
          requestId,
          results,
        },
      };
}

export function validateProcessorBatchResponse(
  value: unknown,
): ValidationResult<ProcessorBatchResponse> {
  return validateBatchResponseEnvelope(
    value,
    "serviceWorker",
    "processor.transliteration.batch.response",
  ) as ValidationResult<ProcessorBatchResponse>;
}

export function validateTransliterationBatchResponse(
  value: unknown,
  target: "popup" | "content",
): ValidationResult<TransliterationBatchResponse> {
  return validateBatchResponseEnvelope(
    value,
    target,
    "transliteration.batch.response",
  ) as ValidationResult<TransliterationBatchResponse>;
}

function isBtbError(value: unknown): value is BtbError {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.subsystem === "string" &&
    (value.severity === "recoverable" || value.severity === "fatal") &&
    typeof value.retryable === "boolean" &&
    typeof value.causeCategory === "string" &&
    (value.requestId === null || isRequestId(value.requestId))
  );
}

export function validateHealthErrorResponse(
  value: unknown,
): ValidationResult<HealthErrorResponse> {
  if (!isRecord(value)) {
    return invalidMessage(null);
  }

  const requestId = requestIdFrom(value);
  if (
    !hasProtocol(value) ||
    (value.target !== "popup" &&
      value.target !== "content" &&
      value.target !== "serviceWorker") ||
    value.type !== "health.error" ||
    !isBtbError(value.error) ||
    value.requestId !== value.error.requestId
  ) {
    return invalidMessage(requestId);
  }

  return {
    ok: true,
    value: {
      protocolVersion: PROTOCOL_VERSION,
      target: value.target,
      type: "health.error",
      requestId: value.error.requestId,
      error: value.error,
    },
  };
}
