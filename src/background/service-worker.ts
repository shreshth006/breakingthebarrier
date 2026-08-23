import { ensureOffscreenDocument, sendProcessorProbe } from "../platform/browser";
import { createBtbError } from "../shared/errors";
import {
  createHealthErrorResponse,
  createProcessorEnsureResponse,
  createProcessorProbeRequest,
} from "../shared/messages";
import type {
  HealthErrorResponse,
  ProcessorEnsureRequest,
  ProcessorEnsureResponse,
} from "../shared/messages";
import {
  getMessageTarget,
  validateHealthErrorResponse,
  validateProcessorEnsureRequest,
  validateProcessorProbeResponse,
} from "../shared/validation";

function isInternalSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id;
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

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ): boolean => {
    if (getMessageTarget(message) !== "serviceWorker") {
      return false;
    }

    const request = validateProcessorEnsureRequest(message);
    if (!request.ok) {
      sendResponse(createHealthErrorResponse("popup", request.error));
      return false;
    }

    if (!isInternalSender(sender)) {
      sendResponse(
        createHealthErrorResponse(
          "popup",
          createBtbError(
            "invalid-sender",
            "messaging",
            "boundary",
            false,
            request.value.requestId,
          ),
        ),
      );
      return false;
    }

    void handleProcessorEnsure(request.value).then(sendResponse);
    return true;
  },
);
