import {
  ensureOffscreenDocument,
  releaseOffscreenDocument,
  sendProcessorBatch,
  sendProcessorMemoryDiagnostic,
  sendProcessorProbe,
} from "../platform/browser";
import { createBtbError } from "../shared/errors";
import {
  createContentCommandRequest,
  createHealthErrorResponse,
  createPageCommandResponse,
  createProcessorBatchRequest,
  createProcessorEnsureResponse,
  createProcessorMemoryDiagnosticInternalRequest,
  createProcessorMemoryDiagnosticResponse,
  createProcessorProbeRequest,
  createProcessorReleaseResponse,
  createTransliterationBatchResponse,
} from "../shared/messages";
import type {
  CallerTarget,
  HealthErrorResponse,
  PageCommandRequest,
  PageCommandResponse,
  ProcessorEnsureRequest,
  ProcessorEnsureResponse,
  ProcessorMemoryDiagnosticRequest,
  ProcessorMemoryDiagnosticResponse,
  ProcessorReleaseRequest,
  ProcessorReleaseResponse,
  TransliterationBatchRequest,
  TransliterationBatchResponse,
} from "../shared/messages";
import {
  getMessageTarget,
  validateHealthErrorResponse,
  validateContentCommandResponse,
  validatePageCommandRequest,
  validateProcessorBatchResponse,
  validateProcessorEnsureRequest,
  validateProcessorMemoryDiagnosticInternalResponse,
  validateProcessorMemoryDiagnosticRequest,
  validateProcessorProbeResponse,
  validateProcessorReleaseRequest,
  validateTransliterationBatchRequest,
} from "../shared/validation";
import {
  ACTIVE_FRAME_SESSION_STORAGE_KEY,
  CONTENT_SCRIPT_PATH,
} from "../shared/config";
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

async function handleProcessorMemoryDiagnostic(
  request: ProcessorMemoryDiagnosticRequest,
  target: CallerTarget,
): Promise<ProcessorMemoryDiagnosticResponse | HealthErrorResponse> {
  try {
    await ensureOffscreenDocument();
    const rawResponse = await sendProcessorMemoryDiagnostic(
      createProcessorMemoryDiagnosticInternalRequest(request.requestId),
    );
    const response = validateProcessorMemoryDiagnosticInternalResponse(
      rawResponse,
    );
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
    return createProcessorMemoryDiagnosticResponse(
      target,
      request.requestId,
      response.value,
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

async function handleProcessorRelease(
  request: ProcessorReleaseRequest,
  target: CallerTarget,
): Promise<ProcessorReleaseResponse | HealthErrorResponse> {
  try {
    if (!(await releaseOffscreenDocument())) {
      throw new Error("Processor document remained open");
    }
    return createProcessorReleaseResponse(target, request.requestId);
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

const originalPageSummary = {
  state: "original",
  reason: null,
  eligibleNodes: 0,
  processedNodes: 0,
  failedNodes: 0,
} as const;

const restrictedPageSummary = {
  state: "degraded",
  reason: "restricted-page",
  eligibleNodes: 0,
  processedNodes: 0,
  failedNodes: 0,
} as const;

let sessionMutation = Promise.resolve();

function readActiveTabIds(value: unknown): Set<number> {
  if (!Array.isArray(value)) {
    return new Set();
  }
  return new Set(
    value.filter(
      (entry): entry is number =>
        typeof entry === "number" &&
        Number.isSafeInteger(entry) &&
        entry >= 0,
    ),
  );
}

function updateActiveTabSession(
  tabId: number,
  active: boolean,
): Promise<number> {
  let resolveCount!: (count: number) => void;
  let rejectCount!: (error: unknown) => void;
  const result = new Promise<number>((resolve, reject) => {
    resolveCount = resolve;
    rejectCount = reject;
  });
  sessionMutation = sessionMutation
    .then(async () => {
      const stored = await chrome.storage.session.get(
        ACTIVE_FRAME_SESSION_STORAGE_KEY,
      );
      const activeTabs = readActiveTabIds(
        stored[ACTIVE_FRAME_SESSION_STORAGE_KEY],
      );
      if (active) {
        activeTabs.add(tabId);
      } else {
        activeTabs.delete(tabId);
      }
      await chrome.storage.session.set({
        [ACTIVE_FRAME_SESSION_STORAGE_KEY]: [...activeTabs],
      });
      resolveCount(activeTabs.size);
    })
    .catch((error: unknown) => {
      rejectCount(error);
    });
  return result;
}

async function releaseProcessorWhenUnused(activeSessionCount: number): Promise<void> {
  if (activeSessionCount === 0) {
    await releaseOffscreenDocument();
  }
}

async function activeTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function handlePageCommand(
  request: PageCommandRequest,
): Promise<PageCommandResponse> {
  const tabId = await activeTabId();
  if (tabId === null) {
    return createPageCommandResponse(request.requestId, restrictedPageSummary);
  }
  try {
    if (request.command === "start") {
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [0] },
        files: [CONTENT_SCRIPT_PATH],
      });
    }
    const rawResponse: unknown = await chrome.tabs.sendMessage(
      tabId,
      createContentCommandRequest(request.requestId, request.command),
      { frameId: 0 },
    );
    const response = validateContentCommandResponse(rawResponse);
    if (!response.ok || response.value.requestId !== request.requestId) {
      return createPageCommandResponse(
        request.requestId,
        restrictedPageSummary,
      );
    }
    if (request.command === "start") {
      const count = await updateActiveTabSession(
        tabId,
        response.value.state === "active",
      );
      await releaseProcessorWhenUnused(count);
    } else if (request.command === "stop") {
      const count = await updateActiveTabSession(tabId, false);
      await releaseProcessorWhenUnused(count);
    }
    return createPageCommandResponse(request.requestId, response.value);
  } catch {
    if (request.command === "status" || request.command === "stop") {
      return createPageCommandResponse(request.requestId, originalPageSummary);
    }
    return createPageCommandResponse(request.requestId, restrictedPageSummary);
  }
}

function removeTabSession(tabId: number): void {
  void updateActiveTabSession(tabId, false)
    .then(releaseProcessorWhenUnused)
    .catch(() => undefined);
}

chrome.tabs.onRemoved.addListener((tabId) => {
  removeTabSession(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    removeTabSession(tabId);
  }
});

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
    const diagnosticRequest = validateProcessorMemoryDiagnosticRequest(message);
    const releaseRequest = validateProcessorReleaseRequest(message);
    const pageCommandRequest = validatePageCommandRequest(message);
    const target = callerTarget(sender);
    const validRequest =
      ensureRequest.ok ||
      batchRequest.ok ||
      diagnosticRequest.ok ||
      releaseRequest.ok ||
      pageCommandRequest.ok;
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
                : diagnosticRequest.ok
                  ? diagnosticRequest.value.requestId
                  : releaseRequest.ok
                    ? releaseRequest.value.requestId
                    : pageCommandRequest.ok
                      ? pageCommandRequest.value.requestId
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
    } else if (diagnosticRequest.ok) {
      void handleProcessorMemoryDiagnostic(
        diagnosticRequest.value,
        target,
      ).then(sendResponse);
    } else if (releaseRequest.ok) {
      void handleProcessorRelease(releaseRequest.value, target).then(
        sendResponse,
      );
    } else if (pageCommandRequest.ok) {
      if (sender.tab !== undefined) {
        sendResponse(
          createHealthErrorResponse(
            "content",
            createBtbError(
              "invalid-sender",
              "messaging",
              "boundary",
              false,
              pageCommandRequest.value.requestId,
            ),
          ),
        );
        return false;
      }
      void handlePageCommand(pageCommandRequest.value).then(sendResponse);
    }
    return true;
  },
);
