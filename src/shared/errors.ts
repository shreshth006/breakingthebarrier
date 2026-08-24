export type BtbErrorCode =
  | "invalid-message"
  | "invalid-sender"
  | "processor-unavailable"
  | "worker-timeout"
  | "worker-unavailable";

export type BtbSubsystem =
  | "messaging"
  | "platform"
  | "processor"
  | "worker";

export type BtbErrorSeverity = "recoverable" | "fatal";

export type BtbCauseCategory =
  | "boundary"
  | "browser-api"
  | "timeout"
  | "worker"
  | "engine-module"
  | "engine-load"
  | "dictionary-fetch"
  | "dictionary-schema"
  | "wasm-compile"
  | "wasm-link"
  | "wasm-runtime"
  | "self-test";

export interface BtbError {
  readonly code: BtbErrorCode;
  readonly subsystem: BtbSubsystem;
  readonly severity: BtbErrorSeverity;
  readonly retryable: boolean;
  readonly causeCategory: BtbCauseCategory;
  readonly requestId: string | null;
}

export function createBtbError(
  code: BtbErrorCode,
  subsystem: BtbSubsystem,
  causeCategory: BtbCauseCategory,
  retryable: boolean,
  requestId: string | null,
): BtbError {
  return {
    code,
    subsystem,
    severity: retryable ? "recoverable" : "fatal",
    retryable,
    causeCategory,
    requestId,
  };
}
