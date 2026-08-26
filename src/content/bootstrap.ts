import { FrameController } from "./controller";
import { createContentCommandResponse } from "../shared/messages";
import { validateContentCommandRequest } from "../shared/validation";

interface ContentGlobal {
  __BTB_CONTENT_CONTROLLER_V1__?: FrameController;
  __BTB_CONTENT_LISTENER_V1__?: true;
}

const contentGlobal = globalThis as typeof globalThis & ContentGlobal;
contentGlobal.__BTB_CONTENT_CONTROLLER_V1__ ??= new FrameController(document);
const controller = contentGlobal.__BTB_CONTENT_CONTROLLER_V1__;

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
            controller.status(),
          ),
        );
        return false;
      }
      if (request.value.command === "stop") {
        sendResponse(
          createContentCommandResponse(
            request.value.requestId,
            controller.stop(),
          ),
        );
        return false;
      }
      void controller.start().then((summary) => {
        sendResponse(
          createContentCommandResponse(request.value.requestId, summary),
        );
      });
      return true;
    },
  );
}
