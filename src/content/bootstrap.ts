import { FrameController } from "./controller";
import { JapaneseDetectionController } from "./detection-controller";
import { RememberedPageCoordinator } from "./remembered-page";
import {
  createContentCommandResponse,
  createRememberedPageRequest,
} from "../shared/messages";
import type {
  RememberedPageCommand,
  RememberedPageResponse,
} from "../shared/messages";
import {
  validateContentCommandRequest,
  validateRememberedPageResponse,
} from "../shared/validation";
import { showJapaneseDetectionPrompt } from "../ui/in-page/prompt";

interface ContentGlobal {
  __BTB_CONTENT_CONTROLLER_V1__?: FrameController;
  __BTB_CONTENT_LISTENER_V1__?: true;
  __BTB_REMEMBERED_BOOTSTRAP_V1__?: true;
  __BTB_REMEMBERED_PAGE_V1__?: RememberedPageCoordinator;
}

const contentGlobal = globalThis as typeof globalThis & ContentGlobal;
contentGlobal.__BTB_CONTENT_CONTROLLER_V1__ ??= new FrameController(document);
const controller = contentGlobal.__BTB_CONTENT_CONTROLLER_V1__;

function currentSummary() {
  const summary = controller.status();
  const detected = contentGlobal.__BTB_REMEMBERED_PAGE_V1__
    ?.detectedEligibleNodes() ?? 0;
  return summary.state === "original" && detected > 0
    ? {
        ...summary,
        reason: "japanese-detected" as const,
        eligibleNodes: detected,
      }
    : summary;
}

async function sendRememberedCommand(
  command: RememberedPageCommand,
): Promise<RememberedPageResponse | null> {
  const requestId = crypto.randomUUID();
  const rawResponse: unknown = await chrome.runtime.sendMessage(
    createRememberedPageRequest(requestId, command),
  );
  const response = validateRememberedPageResponse(rawResponse);
  return response.ok && response.value.requestId === requestId
    ? response.value
    : null;
}

if (contentGlobal.__BTB_CONTENT_LISTENER_V1__ !== true) {
  contentGlobal.__BTB_CONTENT_LISTENER_V1__ = true;
  chrome.runtime.onMessage.addListener(
    (
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void,
    ): boolean => {
      const request = validateContentCommandRequest(message);
      if (!request.ok || sender.id !== chrome.runtime.id) {
        return false;
      }
      if (request.value.command === "status") {
        sendResponse(
          createContentCommandResponse(
            request.value.requestId,
            currentSummary(),
          ),
        );
        return false;
      }
      if (request.value.command === "stop") {
        contentGlobal.__BTB_REMEMBERED_PAGE_V1__?.stop();
        sendResponse(
          createContentCommandResponse(
            request.value.requestId,
            controller.stop(),
          ),
        );
        return false;
      }
      contentGlobal.__BTB_REMEMBERED_PAGE_V1__?.stop();
      void controller.start().then((summary) => {
        sendResponse(
          createContentCommandResponse(request.value.requestId, summary),
        );
      });
      return true;
    },
  );
}

if (contentGlobal.__BTB_REMEMBERED_BOOTSTRAP_V1__ !== true) {
  contentGlobal.__BTB_REMEMBERED_BOOTSTRAP_V1__ = true;
  contentGlobal.__BTB_REMEMBERED_PAGE_V1__ = new RememberedPageCoordinator({
    send: sendRememberedCommand,
    createDetection: () => new JapaneseDetectionController(document),
    showPrompt: (actions) =>
      showJapaneseDetectionPrompt(document, actions),
  });
  void contentGlobal.__BTB_REMEMBERED_PAGE_V1__.start().catch(() => undefined);
}
