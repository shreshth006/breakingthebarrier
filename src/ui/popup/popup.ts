import { createProcessorEnsureRequest } from "../../shared/messages";
import {
  validateHealthErrorResponse,
  validateProcessorEnsureResponse,
} from "../../shared/validation";

const buttonElement = document.querySelector("#check-processor");
const statusElement = document.querySelector("#status");

if (
  !(buttonElement instanceof HTMLButtonElement) ||
  !(statusElement instanceof HTMLElement)
) {
  throw new Error("Required popup controls are missing");
}

const checkButton = buttonElement;
const status = statusElement;

function setStatus(
  message: string,
  state: "idle" | "loading" | "success" | "error",
): void {
  status.textContent = message;
  status.dataset.state = state;
  delete status.dataset.errorCode;
  delete status.dataset.errorCause;
}

checkButton.addEventListener("click", () => {
  checkButton.disabled = true;
  setStatus("Starting packaged worker…", "loading");

  const requestId = crypto.randomUUID();
  void chrome.runtime
    .sendMessage(createProcessorEnsureRequest(requestId))
    .then((rawResponse: unknown) => {
      const response = validateProcessorEnsureResponse(rawResponse);
      if (response.ok && response.value.requestId === requestId) {
        const versions = response.value.versions;
        setStatus(
          `Ready · Lindera ${versions.lindera} · WanaKana ${versions.wanakana}`,
          "success",
        );
        return;
      }

      const errorResponse = validateHealthErrorResponse(rawResponse);
      if (errorResponse.ok && errorResponse.value.requestId === requestId) {
        setStatus("Processor unavailable. Try again.", "error");
        status.dataset.errorCode = errorResponse.value.error.code;
        status.dataset.errorCause = errorResponse.value.error.causeCategory;
        return;
      }

      setStatus("Unexpected processor response.", "error");
    })
    .catch(() => {
      setStatus("Processor unavailable. Try again.", "error");
    })
    .finally(() => {
      checkButton.disabled = false;
    });
});
