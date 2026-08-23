import { PROCESSOR_PROBE_TIMEOUT_MS } from "../shared/config";
import { createBtbError } from "../shared/errors";
import {
  createHealthErrorResponse,
  createProcessorProbeResponse,
} from "../shared/messages";
import type {
  HealthErrorResponse,
  ProcessorProbeRequest,
  ProcessorProbeResponse,
} from "../shared/messages";
import {
  getMessageTarget,
  validateProcessorProbeRequest,
} from "../shared/validation";
import {
  createJapaneseWorkerProbeRequest,
  isJapaneseWorkerProbeFailure,
  isJapaneseWorkerProbeResponse,
} from "../shared/worker-messages";
import type { JapaneseWorkerProbeResponse } from "../shared/worker-messages";
import type { BtbCauseCategory } from "../shared/errors";

let japaneseWorker: Worker | undefined;

class JapaneseWorkerProbeError extends Error {
  readonly reason: BtbCauseCategory;

  constructor(reason: BtbCauseCategory) {
    super(`Japanese worker probe failed: ${reason}`);
    this.name = "JapaneseWorkerProbeError";
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
      reject(new JapaneseWorkerProbeError("timeout"));
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
        reject(new JapaneseWorkerProbeError(event.data.reason));
      }
    };

    const handleError = (): void => {
      cleanup();
      resetJapaneseWorker();
      reject(new JapaneseWorkerProbeError("worker"));
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

async function handleProcessorProbe(
  request: ProcessorProbeRequest,
): Promise<ProcessorProbeResponse | HealthErrorResponse> {
  try {
    const workerResponse = await probeJapaneseWorker(request.requestId);
    return createProcessorProbeResponse(request.requestId, workerResponse);
  } catch (error) {
    const reason =
      error instanceof JapaneseWorkerProbeError ? error.reason : "worker";
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

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ): boolean => {
    if (getMessageTarget(message) !== "processor") {
      return false;
    }

    const request = validateProcessorProbeRequest(message);
    if (!request.ok || sender.id !== chrome.runtime.id) {
      const error = request.ok
        ? createBtbError(
            "invalid-sender",
            "messaging",
            "boundary",
            false,
            request.value.requestId,
          )
        : request.error;
      sendResponse(createHealthErrorResponse("serviceWorker", error));
      return false;
    }

    void handleProcessorProbe(request.value).then(sendResponse);
    return true;
  },
);
