import {
  PROCESSOR_BATCH_TIMEOUT_MS,
  PROCESSOR_PROBE_TIMEOUT_MS,
} from "../shared/config";
import { createBtbError } from "../shared/errors";
import {
  createHealthErrorResponse,
  createProcessorBatchResponse,
  createProcessorProbeResponse,
} from "../shared/messages";
import type {
  HealthErrorResponse,
  ProcessorBatchRequest,
  ProcessorBatchResponse,
  ProcessorProbeRequest,
  ProcessorProbeResponse,
} from "../shared/messages";
import {
  getMessageTarget,
  validateProcessorBatchRequest,
  validateProcessorProbeRequest,
} from "../shared/validation";
import {
  createJapaneseWorkerBatchRequest,
  createJapaneseWorkerProbeRequest,
  isJapaneseWorkerBatchFailure,
  isJapaneseWorkerBatchResponse,
  isJapaneseWorkerProbeFailure,
  isJapaneseWorkerProbeResponse,
} from "../shared/worker-messages";
import type {
  JapaneseWorkerBatchResponse,
  JapaneseWorkerProbeResponse,
} from "../shared/worker-messages";
import type { BtbCauseCategory } from "../shared/errors";
import { resultsMatchRequests } from "../shared/transliteration-validation";
import { runWithOneRetry } from "./retry";

let japaneseWorker: Worker | undefined;

class JapaneseWorkerRequestError extends Error {
  readonly reason: BtbCauseCategory;

  constructor(reason: BtbCauseCategory) {
    super(`Japanese worker request failed: ${reason}`);
    this.name = "JapaneseWorkerRequestError";
    this.reason = reason;
  }
}

function getJapaneseWorker(): Worker {
  japaneseWorker ??= new Worker(new URL("./japanese.worker.ts", import.meta.url), {
    type: "module",
    name: "btb-japanese",
  });
  return japaneseWorker;
}

function resetJapaneseWorker(): void {
  japaneseWorker?.terminate();
  japaneseWorker = undefined;
}

function probeJapaneseWorker(
  requestId: string,
): Promise<JapaneseWorkerProbeResponse> {
  const worker = getJapaneseWorker();

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      resetJapaneseWorker();
      reject(new JapaneseWorkerRequestError("timeout"));
    }, PROCESSOR_PROBE_TIMEOUT_MS);

    const handleMessage = (event: MessageEvent<unknown>): void => {
      if (
        isJapaneseWorkerProbeResponse(event.data) &&
        event.data.requestId === requestId
      ) {
        cleanup();
        resolve(event.data);
      } else if (
        isJapaneseWorkerProbeFailure(event.data) &&
        event.data.requestId === requestId
      ) {
        cleanup();
        resetJapaneseWorker();
        reject(new JapaneseWorkerRequestError(event.data.reason));
      }
    };

    const handleError = (): void => {
      cleanup();
      resetJapaneseWorker();
      reject(new JapaneseWorkerRequestError("worker"));
    };

    function cleanup(): void {
      clearTimeout(timeoutId);
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    }

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage(createJapaneseWorkerProbeRequest(requestId));
  });
}

function requestJapaneseWorkerBatch(
  request: ProcessorBatchRequest,
): Promise<JapaneseWorkerBatchResponse> {
  const worker = getJapaneseWorker();

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      resetJapaneseWorker();
      reject(new JapaneseWorkerRequestError("timeout"));
    }, PROCESSOR_BATCH_TIMEOUT_MS);

    const handleMessage = (event: MessageEvent<unknown>): void => {
      if (
        isJapaneseWorkerBatchResponse(event.data) &&
        event.data.requestId === request.requestId
      ) {
        cleanup();
        if (!resultsMatchRequests(request.items, event.data.results)) {
          resetJapaneseWorker();
          reject(new JapaneseWorkerRequestError("worker"));
          return;
        }
        resolve(event.data);
      } else if (
        isJapaneseWorkerBatchFailure(event.data) &&
        event.data.requestId === request.requestId
      ) {
        cleanup();
        resetJapaneseWorker();
        reject(new JapaneseWorkerRequestError(event.data.reason));
      }
    };

    const handleError = (): void => {
      cleanup();
      resetJapaneseWorker();
      reject(new JapaneseWorkerRequestError("worker"));
    };

    function cleanup(): void {
      clearTimeout(timeoutId);
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    }

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage(
      createJapaneseWorkerBatchRequest(request.requestId, request.items),
    );
  });
}

async function requestJapaneseWorkerBatchWithRetry(
  request: ProcessorBatchRequest,
): Promise<JapaneseWorkerBatchResponse> {
  return runWithOneRetry(() => requestJapaneseWorkerBatch(request));
}

async function handleProcessorProbe(
  request: ProcessorProbeRequest,
): Promise<ProcessorProbeResponse | HealthErrorResponse> {
  try {
    const workerResponse = await probeJapaneseWorker(request.requestId);
    return createProcessorProbeResponse(request.requestId, workerResponse);
  } catch (error) {
    const reason =
      error instanceof JapaneseWorkerRequestError ? error.reason : "worker";
    return createHealthErrorResponse(
      "serviceWorker",
      createBtbError(
        reason === "timeout" ? "worker-timeout" : "worker-unavailable",
        "worker",
        reason,
        true,
        request.requestId,
      ),
    );
  }
}

async function handleProcessorBatch(
  request: ProcessorBatchRequest,
): Promise<ProcessorBatchResponse | HealthErrorResponse> {
  try {
    const response = await requestJapaneseWorkerBatchWithRetry(request);
    return createProcessorBatchResponse(request.requestId, response.results);
  } catch (error) {
    const reason =
      error instanceof JapaneseWorkerRequestError ? error.reason : "worker";
    return createHealthErrorResponse(
      "serviceWorker",
      createBtbError(
        reason === "timeout" ? "worker-timeout" : "transliteration-failed",
        "worker",
        reason,
        true,
        request.requestId,
      ),
    );
  }
}

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ): boolean => {
    if (getMessageTarget(message) !== "processor") {
      return false;
    }

    const probeRequest = validateProcessorProbeRequest(message);
    const batchRequest = validateProcessorBatchRequest(message);
    const validRequest = probeRequest.ok || batchRequest.ok;
    if (!validRequest || sender.id !== chrome.runtime.id) {
      const requestId = probeRequest.ok
        ? probeRequest.value.requestId
        : batchRequest.ok
          ? batchRequest.value.requestId
          : null;
      const error = validRequest
        ? createBtbError(
            "invalid-sender",
            "messaging",
            "boundary",
            false,
            requestId,
          )
        : probeRequest.error;
      sendResponse(createHealthErrorResponse("serviceWorker", error));
      return false;
    }

    if (probeRequest.ok) {
      void handleProcessorProbe(probeRequest.value).then(sendResponse);
    } else if (batchRequest.ok) {
      void handleProcessorBatch(batchRequest.value).then(sendResponse);
    }
    return true;
  },
);
