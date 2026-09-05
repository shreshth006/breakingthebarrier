import { describe, expect, it } from "vitest";
import { popupViewForSummary } from "../../src/ui/popup/popup-view";
import type { FrameSessionSummary } from "../../src/shared/messages";

function summary(
  overrides: Partial<FrameSessionSummary> = {},
): FrameSessionSummary {
  return {
    state: "original",
    reason: null,
    eligibleNodes: 0,
    processedNodes: 0,
    failedNodes: 0,
    ...overrides,
  };
}

describe("popup current-page view", () => {
  it("shows a clear original action and no-text result", () => {
    expect(popupViewForSummary(summary())).toMatchObject({
      badge: "Original",
      actionLabel: "Romanize this page",
      actionDisabled: false,
      status: "Current page is original",
    });
    expect(
      popupViewForSummary(summary({ reason: "no-supported-text" })).status,
    ).toBe("No supported Japanese text found.");
    expect(
      popupViewForSummary(
        summary({ reason: "japanese-detected", eligibleNodes: 2 }),
      ),
    ).toMatchObject({
      badge: "Original",
      actionLabel: "Romanize this page",
      status: "Japanese detected. Romanize this page?",
    });
  });

  it("distinguishes fully active and partial results", () => {
    expect(
      popupViewForSummary(
        summary({ state: "active", eligibleNodes: 3, processedNodes: 3 }),
      ),
    ).toMatchObject({ badge: "On", actionLabel: "Show original" });
    expect(
      popupViewForSummary(
        summary({
          state: "active",
          eligibleNodes: 3,
          processedNodes: 2,
          failedNodes: 1,
        }),
      ),
    ).toMatchObject({
      badge: "Partial",
      status:
        "Showing romaji. Some text could not be read and was left original.",
    });
  });

  it("represents progress, retry, and restricted pages without ambiguity", () => {
    expect(popupViewForSummary(summary({ state: "inspecting" }))).toMatchObject(
      { badge: "Starting", actionDisabled: true, statusState: "loading" },
    );
    expect(popupViewForSummary(summary({ state: "degraded" }))).toMatchObject({
      badge: "Unavailable",
      actionLabel: "Retry",
      actionDisabled: false,
    });
    expect(
      popupViewForSummary(
        summary({ state: "degraded", reason: "restricted-page" }),
      ),
    ).toMatchObject({
      badge: "Unavailable",
      actionLabel: "Romanize this page",
      actionDisabled: true,
    });
  });
});
