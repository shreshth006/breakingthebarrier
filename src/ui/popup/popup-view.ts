import type { FrameSessionSummary } from "../../shared/messages";

export interface PopupView {
  readonly badge: "Original" | "Starting" | "On" | "Partial" | "Unavailable";
  readonly actionLabel: string;
  readonly actionDisabled: boolean;
  readonly status: string;
  readonly statusState: "idle" | "loading" | "success" | "error";
}

export function popupViewForSummary(
  summary: FrameSessionSummary,
): PopupView {
  if (summary.reason === "restricted-page") {
    return {
      badge: "Unavailable",
      actionLabel: "Transliterate this page",
      actionDisabled: true,
      status: "This browser page cannot be changed.",
      statusState: "error",
    };
  }
  if (summary.state === "inspecting") {
    return {
      badge: "Starting",
      actionLabel: "Checking this page…",
      actionDisabled: true,
      status: "Checking this page for foreign text…",
      statusState: "loading",
    };
  }
  if (summary.state === "starting") {
    return {
      badge: "Starting",
      actionLabel: "Preparing readings…",
      actionDisabled: true,
      status: "Preparing transliteration readings…",
      statusState: "loading",
    };
  }
  if (summary.state === "stopping") {
    return {
      badge: "Starting",
      actionLabel: "Restoring original…",
      actionDisabled: true,
      status: "Restoring original text…",
      statusState: "loading",
    };
  }
  if (summary.state === "active") {
    const partial = summary.failedNodes > 0;
    return {
      badge: partial ? "Partial" : "On",
      actionLabel: "Show original",
      actionDisabled: false,
      status: partial
        ? "Showing transliteration. Some text could not be read and was left original."
        : `Showing transliteration · ${String(summary.processedNodes)} text nodes`,
      statusState: "success",
    };
  }
  if (summary.state === "degraded") {
    return {
      badge: "Unavailable",
      actionLabel: "Retry",
      actionDisabled: false,
      status: "Readings are unavailable right now. The page was left original.",
      statusState: "error",
    };
  }
  if (summary.reason === "japanese-detected") {
    return {
      badge: "Original",
      actionLabel: "Transliterate this page",
      actionDisabled: false,
      status: "Foreign text detected (Japanese, Punjabi, Hindi, Urdu & more). Transliterate this page?",
      statusState: "idle",
    };
  }
  return {
    badge: "Original",
    actionLabel: "Transliterate this page",
    actionDisabled: false,
    status:
      summary.reason === "no-supported-text"
        ? "No supported foreign text found."
        : "Current page is original",
    statusState: "idle",
  };
}
