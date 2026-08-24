import {
  ensureOffscreenDocument,
  sendProcessorBatch,
  sendProcessorProbe,
} from "../platform/browser";
import { createBtbError } from "../shared/errors";
import {
  createHealthErrorResponse,
  createProcessorBatchRequest,
  createProcessorEnsureResponse,
  createProcessorProbeRequest,
  createTransliterationBatchResponse,
} from "../shared/messages";
import type {
  CallerTarget,
  HealthErrorResponse,
  ProcessorEnsureRequest,
  ProcessorEnsureResponse,
  TransliterationBatchRequest,
  TransliterationBatchResponse,
} from "../shared/messages";
import {
  getMessageTarget,
  validateHealthErrorResponse,
  validateProcessorBatchResponse,
  validateProcessorEnsureRequest,
  validateProcessorProbeResponse,
  validateTransliterationBatchRequest,
} from "../shared/validation";
import { resultsMatchRequests } from "../shared/transliteration-validation";

function isInternalSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id;
}

function callerTarget(sender: chrome.runtime.MessageSender): CallerTarget {
  return sender.tab === undefined ? "popup" : "content";
}

async function handleProcessorEnsure(
  request: ProcessorEnsureRequest,
): Promise<ProcessorEnsureResponse | HealthErrorResponse> {
  try {
    await ensureOffscreenDocument();
    const rawResponse = await sendProcessorProbe(
      createProcessorProbeRequest(request.requestId),
    );
    const response = validateProcessorProbeResponse(rawResponse);

    if (!response.ok) {
      const workerError = validateHealthErrorResponse(rawResponse);
      if (
        workerError.ok &&
        workerError.value.target === "serviceWorker" &&
        workerError.value.requestId === request.requestId
      ) {
        return createHealthErrorResponse("popup", workerError.value.error);
      }
      return createHealthErrorResponse("popup", response.error);
    }

    return createProcessorEnsureResponse(request.requestId, response.value);
  } catch {
    return createHealthErrorResponse(
      "popup",
      createBtbError(
        "processor-unavailable",
        "platform",
        "browser-api",
        true,
        request.requestId,
      ),
    );
  }
}

async function handleTransliterationBatch(
  request: TransliterationBatchRequest,
  target: CallerTarget,
): Promise<TransliterationBatchResponse | HealthErrorResponse> {
  try {
    await ensureOffscreenDocument();
    const rawResponse = await sendProcessorBatch(
      createProcessorBatchRequest(request.requestId, request.items),
    );
    const response = validateProcessorBatchResponse(rawResponse);

    if (!response.ok) {
      const workerError = validateHealthErrorResponse(rawResponse);
      if (
        workerError.ok &&
        workerError.value.target === "serviceWorker" &&
        workerError.value.requestId === request.requestId
      ) {
        return createHealthErrorResponse(target, workerError.value.error);
      }
      return createHealthErrorResponse(target, response.error);
    }

    if (!resultsMatchRequests(request.items, response.value.results)) {
      return createHealthErrorResponse(
        target,
        createBtbError(
          "invalid-message",
          "messaging",
          "boundary",
          false,
          request.requestId,
        ),
      );
    }

    return createTransliterationBatchResponse(
      target,
      request.requestId,
      response.value.results,
    );
  } catch {
    return createHealthErrorResponse(
      target,
      createBtbError(
        "processor-unavailable",
        "platform",
        "browser-api",
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
    if (getMessageTarget(message) !== "serviceWorker") {
      return false;
    }

    const ensureRequest = validateProcessorEnsureRequest(message);
    const batchRequest = validateTransliterationBatchRequest(message);
    const target = callerTarget(sender);
    const validRequest = ensureRequest.ok || batchRequest.ok;
    if (!validRequest) {
      sendResponse(createHealthErrorResponse(target, ensureRequest.error));
      return false;
    }

    if (!isInternalSender(sender)) {
      sendResponse(
        createHealthErrorResponse(
          target,
          createBtbError(
            "invalid-sender",
            "messaging",
            "boundary",
            false,
            ensureRequest.ok
              ? ensureRequest.value.requestId
              : batchRequest.ok
                ? batchRequest.value.requestId
                : null,
          ),
        ),
      );
      return false;
    }

    if (ensureRequest.ok) {
      void handleProcessorEnsure(ensureRequest.value).then(sendResponse);
    } else if (batchRequest.ok) {
      void handleTransliterationBatch(batchRequest.value, target).then(
        sendResponse,
      );
    }
    return true;
  },
);
