import { createPageCommandRequest } from "../../shared/messages";
import type { FrameSessionSummary, PageCommand } from "../../shared/messages";
import {
  validateHealthErrorResponse,
  validatePageCommandResponse,
} from "../../shared/validation";
import { popupViewForSummary } from "./popup-view";

const buttonElement = document.querySelector("#page-action");
const statusElement = document.querySelector("#status");
const badgeElement = document.querySelector("#page-state");

if (
  !(buttonElement instanceof HTMLButtonElement) ||
  !(statusElement instanceof HTMLElement) ||
  !(badgeElement instanceof HTMLElement)
) {
  throw new Error("Required popup controls are missing");
}

const actionButton = buttonElement;
const status = statusElement;
const badge = badgeElement;
let currentState: FrameSessionSummary["state"] = "original";

function setStatus(
  message: string,
  state: "idle" | "loading" | "success" | "error",
): void {
  status.textContent = message;
  status.dataset.state = state;
  delete status.dataset.errorCode;
  delete status.dataset.errorCause;
  actionButton.setAttribute(
    "aria-busy",
    state === "loading" ? "true" : "false",
  );
}

function renderSummary(summary: FrameSessionSummary): void {
  currentState = summary.state;
  const view = popupViewForSummary(summary);
  badge.textContent = view.badge;
  badge.dataset.state = view.statusState;
  actionButton.textContent = view.actionLabel;
  actionButton.disabled = view.actionDisabled;
  setStatus(view.status, view.statusState);
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
  badge.textContent = command === "start" ? "Starting" : "Original";
  badge.dataset.state = "loading";
  void sendCommand(command).catch(() => {
    actionButton.disabled = false;
    setStatus("Readings are unavailable. Try again.", "error");
  });
});

void sendCommand("status").catch(() => {
  setStatus("Current page is original", "idle");
});
