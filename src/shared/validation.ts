import {
  MAX_REQUEST_ID_LENGTH,
  PROTOCOL_VERSION,
} from "./config";
import { createBtbError } from "./errors";
import type { BtbError } from "./errors";
import type {
  HealthErrorResponse,
  MessageTarget,
  ProcessorEnsureRequest,
  ProcessorEnsureResponse,
  ProcessorProbeRequest,
  ProcessorProbeResponse,
  ProcessorVersions,
} from "./messages";

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
    value.target === "popup"
  ) {
    return value.target;
  }

  return null;
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

function readVersions(value: unknown): ProcessorVersions | null {
  if (
    !isRecord(value) ||
    typeof value.lindera !== "string" ||
    typeof value.wanakana !== "string" ||
    typeof value.romanizationPolicy !== "string"
  ) {
    return null;
  }

  return {
    lindera: value.lindera,
    wanakana: value.wanakana,
    romanizationPolicy: value.romanizationPolicy,
  };
}

function hasExpectedCapabilities(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.includes("lindera-wasm") &&
    value.includes("kana-romanizer")
  );
}

function readProbeDetails(
  value: Record<string, unknown>,
): Omit<ProcessorProbeResponse, "protocolVersion" | "target" | "type" | "requestId"> | null {
  const versions = readVersions(value.versions);
  if (
    value.status !== "ready" ||
    value.selfTestPassed !== true ||
    !hasExpectedCapabilities(value.capabilities) ||
    versions === null
  ) {
    return null;
  }

  return {
    status: "ready",
    capabilities: ["lindera-wasm", "kana-romanizer"],
    versions,
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
    (value.target !== "popup" && value.target !== "serviceWorker") ||
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
