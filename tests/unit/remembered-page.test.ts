import { describe, expect, it, vi } from "vitest";
import type { DetectionSummary } from "../../src/content/detection-controller";
import { RememberedPageCoordinator } from "../../src/content/remembered-page";
import type { RememberedPageResponse } from "../../src/shared/messages";
import type { DetectionPromptActions } from "../../src/ui/in-page/prompt";

function response(action: "inactive" | "ask" | "active"): RememberedPageResponse {
  return {
    protocolVersion: 1,
    target: "content",
    type: "remembered.page.response",
    requestId: action,
    action,
    state: action === "active" ? "active" : "original",
    reason: null,
    eligibleNodes: action === "active" ? 1 : 0,
    processedNodes: action === "active" ? 1 : 0,
    failedNodes: 0,
  };
}

describe("remembered-page coordinator", () => {
  it("does nothing when bootstrap policy is inactive", async () => {
    const createDetection = vi.fn();
    const showPrompt = vi.fn();
    const coordinator = new RememberedPageCoordinator({
      send: vi.fn(() => Promise.resolve(response("inactive"))),
      createDetection,
      showPrompt,
    });

    await coordinator.start();
    expect(createDetection).not.toHaveBeenCalled();
    expect(showPrompt).not.toHaveBeenCalled();
  });

  it("detects, prompts once, and starts only after confirmation", async () => {
    let detected!: (summary: DetectionSummary) => void;
    let promptActions!: DetectionPromptActions;
    const detection = {
      start: vi.fn((callback: (summary: DetectionSummary) => void) => {
        detected = callback;
        return Promise.resolve({ detected: false, eligibleNodes: 0 });
      }),
      stop: vi.fn(),
    };
    const send = vi
      .fn<(command: "bootstrap" | "start") => Promise<RememberedPageResponse>>()
      .mockResolvedValueOnce(response("ask"))
      .mockResolvedValueOnce(response("active"));
    const dismiss = vi.fn();
    const coordinator = new RememberedPageCoordinator({
      send,
      createDetection: () => detection,
      showPrompt: (actions) => {
        promptActions = actions;
        return { dismiss };
      },
    });

    await coordinator.start();
    expect(send).toHaveBeenCalledWith("bootstrap");
    expect(send).toHaveBeenCalledTimes(1);
    detected({ detected: true, eligibleNodes: 1 });
    expect(coordinator.detectedEligibleNodes()).toBe(1);
    expect(await promptActions.romanize()).toBe(true);
    expect(send).toHaveBeenLastCalledWith("start");
  });

  it("cancels pending detection and dismisses a mounted prompt", async () => {
    let detected!: (summary: DetectionSummary) => void;
    const detection = {
      start: vi.fn((callback: (summary: DetectionSummary) => void) => {
        detected = callback;
        return Promise.resolve({ detected: false, eligibleNodes: 0 });
      }),
      stop: vi.fn(),
    };
    const dismiss = vi.fn();
    const coordinator = new RememberedPageCoordinator({
      send: vi.fn(() => Promise.resolve(response("ask"))),
      createDetection: () => detection,
      showPrompt: () => ({ dismiss }),
    });

    await coordinator.start();
    coordinator.stop();
    detected({ detected: true, eligibleNodes: 1 });
    expect(dismiss).not.toHaveBeenCalled();

    await coordinator.start();
    detected({ detected: true, eligibleNodes: 1 });
    coordinator.stop();
    expect(dismiss).toHaveBeenCalledOnce();
  });
});
