import { createPageCommandRequest } from "../../shared/messages";
import type { FrameSessionSummary, PageCommand } from "../../shared/messages";
import {
  validateHealthErrorResponse,
  validatePageCommandResponse,
} from "../../shared/validation";

const buttonElement = document.querySelector("#page-action");
const statusElement = document.querySelector("#status");

if (
  !(buttonElement instanceof HTMLButtonElement) ||
  !(statusElement instanceof HTMLElement)
) {
  throw new Error("Required popup controls are missing");
}

const actionButton = buttonElement;
const status = statusElement;
let currentState: FrameSessionSummary["state"] = "original";

function setStatus(
  message: string,
  state: "idle" | "loading" | "success" | "error",
): void {
  status.textContent = message;
  status.dataset.state = state;
  delete status.dataset.errorCode;
  delete status.dataset.errorCause;
}

function renderSummary(summary: FrameSessionSummary): void {
  currentState = summary.state;
  if (summary.reason === "restricted-page") {
    actionButton.textContent = "Romanize this page";
    actionButton.disabled = true;
    setStatus("This browser page cannot be changed.", "error");
    return;
  }
  actionButton.disabled = false;
  if (summary.state === "active") {
    actionButton.textContent = "Show original";
    setStatus(
      summary.failedNodes > 0
        ? "Showing romaji. Some text was left original."
        : `Showing romaji · ${String(summary.processedNodes)} text nodes`,
      "success",
    );
    return;
  }
  if (summary.state === "degraded") {
    actionButton.textContent = "Retry";
    setStatus("Readings are unavailable. The page was left original.", "error");
    return;
  }
  actionButton.textContent = "Romanize this page";
  setStatus(
    summary.reason === "no-supported-text"
      ? "No supported Japanese text found."
      : "Current page is original",
    "idle",
  );
}

async function sendCommand(command: PageCommand): Promise<void> {
  const requestId = crypto.randomUUID();
  const rawResponse: unknown = await chrome.runtime.sendMessage(
    createPageCommandRequest(requestId, command),
  );
  const response = validatePageCommandResponse(rawResponse);
  if (response.ok && response.value.requestId === requestId) {
    renderSummary(response.value);
    return;
  }
  const errorResponse = validateHealthErrorResponse(rawResponse);
  setStatus("Readings are unavailable. Try again.", "error");
  if (errorResponse.ok) {
    status.dataset.errorCode = errorResponse.value.error.code;
    status.dataset.errorCause = errorResponse.value.error.causeCategory;
  }
}

actionButton.addEventListener("click", () => {
  actionButton.disabled = true;
  const command = currentState === "active" ? "stop" : "start";
  setStatus(
    command === "start"
      ? "Preparing Japanese readings…"
      : "Restoring original text…",
    "loading",
  );
  void sendCommand(command).catch(() => {
    actionButton.disabled = false;
    setStatus("Readings are unavailable. Try again.", "error");
  });
});

void sendCommand("status").catch(() => {
  setStatus("Current page is original", "idle");
});
