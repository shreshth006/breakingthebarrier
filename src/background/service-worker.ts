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
  createRememberedPageResponse,
  createSitePolicyResponse,
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
  RememberedPageRequest,
  RememberedPageResponse,
  SitePolicyRequest,
  SitePolicyResponse,
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
  validateRememberedPageRequest,
  validateSitePolicyRequest,
  validateTransliterationBatchRequest,
} from "../shared/validation";
import { CONTENT_SCRIPT_PATH } from "../shared/config";
import { resultsMatchRequests } from "../shared/transliteration-validation";
import { PreferenceStore } from "../storage/preferences";
import { normalizeOrigin, originMatchPattern } from "../shared/origins";
import { RegistrationManager } from "./registrations";
import { decideRememberedPageAction } from "./remembered-pages";
import { FrameSessionStore } from "./frame-sessions";

const preferenceStore = new PreferenceStore(
  chrome.storage.local,
  chrome.storage.onChanged,
);
const registrationManager = new RegistrationManager(
  preferenceStore,
  chrome.scripting,
  chrome.permissions,
);
const frameSessionStore = new FrameSessionStore(chrome.storage.session);

function reconcileRegistrations(): void {
  void registrationManager.reconcile().catch(() => undefined);
}

void preferenceStore.get().then(reconcileRegistrations).catch(() => undefined);

chrome.runtime.onInstalled.addListener(() => {
  reconcileRegistrations();
});

chrome.runtime.onStartup.addListener(reconcileRegistrations);
chrome.permissions.onAdded.addListener(reconcileRegistrations);

function isInternalSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id;
}

function isExtensionPageSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.url?.startsWith(chrome.runtime.getURL("")) === true;
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

async function stopRememberedFrames(origins: ReadonlySet<string>): Promise<void> {
  const stoppedTabIds = await frameSessionStore.takeRemembered(origins);
  await stopRememberedTabIds(stoppedTabIds);
}

async function stopRememberedTabIds(
  stoppedTabIds: readonly number[],
): Promise<void> {
  if (stoppedTabIds.length === 0) {
    return;
  }
  await Promise.all(
    stoppedTabIds.map(async (tabId) => {
      try {
        await chrome.tabs.sendMessage(
          tabId,
          createContentCommandRequest(crypto.randomUUID(), "stop"),
          { frameId: 0 },
        );
      } catch {
        // A closed or navigating tab already discarded its page state.
      }
    }),
  );
  let activeCount = 0;
  for (const tabId of stoppedTabIds) {
    activeCount = await frameSessionStore.setActive(tabId, false);
  }
  await releaseProcessorWhenUnused(activeCount);
}

async function stopDisallowedRememberedFrames(): Promise<void> {
  const preferences = await preferenceStore.get();
  const allowedOrigins = new Set<string>();
  if (preferences.globalEnabled && preferences.languages.ja.enabled) {
    for (const [origin, site] of Object.entries(preferences.sites)) {
      if (site.policy !== "disabled") {
        allowedOrigins.add(origin);
      }
    }
  }
  const tabIds = await frameSessionStore.takeDisallowedRemembered(
    allowedOrigins,
  );
  await stopRememberedTabIds(tabIds);
}

preferenceStore.subscribe(() => {
  reconcileRegistrations();
  void stopDisallowedRememberedFrames().catch(() => undefined);
});

async function releaseProcessorWhenUnused(activeSessionCount: number): Promise<void> {
  if (activeSessionCount === 0) {
    await releaseOffscreenDocument();
  }
}

async function activeTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function handleSitePolicy(
  request: SitePolicyRequest,
): Promise<SitePolicyResponse | HealthErrorResponse> {
  const origin = normalizeOrigin(request.origin);
  try {
    if (origin === null || origin !== request.origin) {
      throw new Error("Site policy origin is not canonical");
    }
    const permission = { origins: [originMatchPattern(origin)] };
    if (request.policy === null || request.policy === "disabled") {
      await preferenceStore.patch({
        site: { origin, policy: request.policy },
        sitePermissionExplained: true,
      });
      await registrationManager.reconcile();
      await stopRememberedFrames(new Set([origin]));
      await chrome.permissions.remove(permission);
      return createSitePolicyResponse(
        request.requestId,
        origin,
        request.policy,
        false,
        false,
      );
    }
    if (!(await chrome.permissions.contains(permission))) {
      return createSitePolicyResponse(
        request.requestId,
        origin,
        null,
        false,
        false,
      );
    }
    await preferenceStore.patch({
      site: { origin, policy: request.policy },
      sitePermissionExplained: true,
    });
    const reconciliation = await registrationManager.reconcile();
    return createSitePolicyResponse(
      request.requestId,
      origin,
      request.policy,
      true,
      reconciliation.expected > 0 &&
        !reconciliation.missingPermissionOrigins.includes(origin),
    );
  } catch {
    return createHealthErrorResponse(
      "popup",
      createBtbError(
        "invalid-message",
        "platform",
        "browser-api",
        false,
        request.requestId,
      ),
    );
  }
}

async function handleRememberedPage(
  request: RememberedPageRequest,
  sender: chrome.runtime.MessageSender,
): Promise<RememberedPageResponse | HealthErrorResponse> {
  const tabId = sender.tab?.id;
  const frameId = sender.frameId;
  const origin = normalizeOrigin(sender.url ?? "");
  if (
    tabId === undefined ||
    frameId !== 0 ||
    origin === null ||
    isExtensionPageSender(sender)
  ) {
    return createHealthErrorResponse(
      "content",
      createBtbError(
        "invalid-sender",
        "messaging",
        "boundary",
        false,
        request.requestId,
      ),
    );
  }
  try {
    const preferences = await preferenceStore.get();
    const site = preferences.sites[origin];
    if (site === undefined || site.policy === "disabled") {
      await frameSessionStore.setRemembered(tabId, null);
      return createRememberedPageResponse(
        request.requestId,
        "inactive",
        originalPageSummary,
      );
    }
    const granted = await chrome.permissions.contains({
      origins: [originMatchPattern(origin)],
    });
    if (!granted) {
      await frameSessionStore.setRemembered(tabId, null);
      await preferenceStore.patch({ site: { origin, policy: null } });
      await registrationManager.reconcile();
      return createRememberedPageResponse(
        request.requestId,
        "inactive",
        originalPageSummary,
      );
    }
    const decision = decideRememberedPageAction(
      preferences,
      origin,
      granted,
      request.command,
    );
    if (decision === "inactive") {
      await frameSessionStore.setRemembered(tabId, null);
      return createRememberedPageResponse(
        request.requestId,
        "inactive",
        originalPageSummary,
      );
    }
    await frameSessionStore.setRemembered(tabId, origin);
    if (decision === "detect") {
      return createRememberedPageResponse(
        request.requestId,
        "ask",
        originalPageSummary,
      );
    }
    const rawResponse: unknown = await chrome.tabs.sendMessage(
      tabId,
      createContentCommandRequest(request.requestId, "start"),
      { frameId },
    );
    const response = validateContentCommandResponse(rawResponse);
    if (!response.ok || response.value.requestId !== request.requestId) {
      throw new Error("Remembered frame returned an invalid start response");
    }
    const active = response.value.state === "active";
    const count = await frameSessionStore.setActive(tabId, active);
    await releaseProcessorWhenUnused(count);
    return createRememberedPageResponse(
      request.requestId,
      active ? "active" : "inactive",
      response.value,
    );
  } catch {
    return createHealthErrorResponse(
      "content",
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
      const count = await frameSessionStore.setActive(
        tabId,
        response.value.state === "active",
      );
      await releaseProcessorWhenUnused(count);
    } else if (request.command === "stop") {
      const count = await frameSessionStore.setActive(tabId, false);
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
  void frameSessionStore.setActive(tabId, false)
    .then(releaseProcessorWhenUnused)
    .catch(() => undefined);
  void frameSessionStore.setRemembered(tabId, null).catch(() => undefined);
}

chrome.tabs.onRemoved.addListener((tabId) => {
  removeTabSession(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    removeTabSession(tabId);
  }
});

chrome.permissions.onRemoved.addListener((permissions) => {
  reconcileRegistrations();
  const origins = new Set(
    (permissions.origins ?? [])
      .map((pattern) => normalizeOrigin(pattern))
      .filter((origin): origin is string => origin !== null),
  );
  if (origins.size > 0) {
    void stopRememberedFrames(origins).catch(() => undefined);
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
    const sitePolicyRequest = validateSitePolicyRequest(message);
    const rememberedPageRequest = validateRememberedPageRequest(message);
    const target = callerTarget(sender);
    const validRequest =
      ensureRequest.ok ||
      batchRequest.ok ||
      diagnosticRequest.ok ||
      releaseRequest.ok ||
      pageCommandRequest.ok ||
      sitePolicyRequest.ok ||
      rememberedPageRequest.ok;
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
                      : sitePolicyRequest.ok
                        ? sitePolicyRequest.value.requestId
                        : rememberedPageRequest.ok
                          ? rememberedPageRequest.value.requestId
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
      if (sender.tab !== undefined && !isExtensionPageSender(sender)) {
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
    } else if (sitePolicyRequest.ok) {
      if (sender.tab !== undefined && !isExtensionPageSender(sender)) {
        sendResponse(
          createHealthErrorResponse(
            "content",
            createBtbError(
              "invalid-sender",
              "messaging",
              "boundary",
              false,
              sitePolicyRequest.value.requestId,
            ),
          ),
        );
        return false;
      }
      void handleSitePolicy(sitePolicyRequest.value).then(sendResponse);
    } else if (rememberedPageRequest.ok) {
      void handleRememberedPage(rememberedPageRequest.value, sender).then(
        sendResponse,
      );
    }
    return true;
  },
);
