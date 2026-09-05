import { describe, expect, it, vi } from "vitest";
import { JapaneseDetectionController } from "../../src/content/detection-controller";

function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("remembered-site Japanese detection", () => {
  it("detects eligible Japanese without invoking the language engine", async () => {
    document.documentElement.lang = "ja";
    document.body.textContent = "東京";
    const detected = vi.fn();
    const controller = new JapaneseDetectionController(document);

    expect(await controller.start(detected)).toEqual({
      detected: true,
      eligibleNodes: 1,
    });
    expect(detected).toHaveBeenCalledOnce();
  });

  it("waits for dynamic Japanese and reports only once", async () => {
    document.documentElement.lang = "ja";
    document.body.textContent = "English only";
    const detected = vi.fn();
    const controller = new JapaneseDetectionController(document);
    expect(await controller.start(detected)).toEqual({
      detected: false,
      eligibleNodes: 0,
    });

    const first = document.createElement("p");
    first.textContent = "愛してる";
    document.body.append(first);
    await nextTask();
    await nextTask();
    expect(detected).toHaveBeenCalledOnce();

    const second = document.createElement("p");
    second.textContent = "東京";
    document.body.append(second);
    await nextTask();
    expect(detected).toHaveBeenCalledOnce();
  });

  it("stops before a delayed scan can surface a prompt", async () => {
    document.documentElement.lang = "ja";
    document.body.textContent = "東京";
    let finishScan!: (value: {
      nodes: Text[];
      diagnostics: { visitedNodes: number; sliceCount: number; maximumSliceMs: number };
    }) => void;
    const scan = new Promise<{
      nodes: Text[];
      diagnostics: { visitedNodes: number; sliceCount: number; maximumSliceMs: number };
    }>((resolve) => {
      finishScan = resolve;
    });
    const detected = vi.fn();
    const controller = new JapaneseDetectionController(
      document,
      () => scan,
    );

    const starting = controller.start(detected);
    controller.stop();
    finishScan({
      nodes: [document.body.firstChild as Text],
      diagnostics: { visitedNodes: 1, sliceCount: 1, maximumSliceMs: 0 },
    });
    expect(await starting).toEqual({ detected: false, eligibleNodes: 0 });
    expect(detected).not.toHaveBeenCalled();
  });
});
