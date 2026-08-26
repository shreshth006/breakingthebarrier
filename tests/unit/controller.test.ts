import { describe, expect, it } from "vitest";
import { FrameController } from "../../src/content/controller";
import type { FrameEngineClient } from "../../src/content/engine-client";
import type { TransliterationResult } from "../../src/engines/contracts";

function result(source: string, rendered: string): TransliterationResult {
  return {
    itemId: source,
    source,
    rendered,
    segments: [
      {
        start: 0,
        end: source.length,
        source,
        reading: null,
        romanized: rendered,
      },
    ],
    warnings: [],
    versions: {
      engine: "test",
      dictionary: "test",
      romanizationPolicy: "ascii-hepburn-v1",
      spacingPolicy: "test",
    },
  };
}

class FakeEngine implements FrameEngineClient {
  readonly calls: string[][] = [];
  readonly #outputs: ReadonlyMap<string, TransliterationResult | null>;

  constructor(outputs: ReadonlyMap<string, TransliterationResult | null>) {
    this.#outputs = outputs;
  }

  transliterate(
    sources: readonly string[],
  ): Promise<ReadonlyMap<string, TransliterationResult | null>> {
    this.calls.push([...sources]);
    return Promise.resolve(this.#outputs);
  }

  clear(): void {
    return undefined;
  }
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

describe("static frame controller", () => {
  it("replaces Text.data only, preserves mixed content, and restores exactly", async () => {
    document.documentElement.lang = "ja";
    document.body.innerHTML = `<button id="target">  English 愛してる 123 🎵  </button>`;
    const element = document.querySelector("#target");
    const node = element?.firstChild;
    if (!(element instanceof HTMLButtonElement) || !(node instanceof Text)) {
      throw new Error("Missing controller fixture");
    }
    let clicks = 0;
    element.addEventListener("click", () => {
      clicks += 1;
    });
    const source = node.data;
    const rendered = "  English aishiteru 123 🎵  ";
    const controller = new FrameController(
      document,
      new FakeEngine(new Map([[source, result(source, rendered)]])),
    );

    await expect(controller.start()).resolves.toMatchObject({
      state: "active",
      eligibleNodes: 1,
      processedNodes: 1,
      failedNodes: 0,
    });
    expect(element.firstChild).toBe(node);
    expect(node.data).toBe(rendered);
    element.click();
    expect(clicks).toBe(1);

    expect(controller.stop().state).toBe("original");
    expect(element.firstChild).toBe(node);
    expect(node.data).toBe(source);
    element.click();
    expect(clicks).toBe(2);
  });

  it("isolates a failed item while rendering successful nodes", async () => {
    document.documentElement.lang = "ja";
    document.body.innerHTML = `<p id="one">東京</p><p id="two">愛してる</p>`;
    const controller = new FrameController(
      document,
      new FakeEngine(
        new Map([
          ["東京", result("東京", "toukyou")],
          ["愛してる", null],
        ]),
      ),
    );
    await expect(controller.start()).resolves.toMatchObject({
      state: "active",
      processedNodes: 1,
      failedNodes: 1,
    });
    expect(document.querySelector("#one")?.textContent).toBe("toukyou");
    expect(document.querySelector("#two")?.textContent).toBe("愛してる");
  });

  it("does not overwrite a newer page value with a stale result or restore", async () => {
    document.documentElement.lang = "ja";
    document.body.innerHTML = `<p id="target">東京</p>`;
    const node = document.querySelector("#target")?.firstChild;
    if (!(node instanceof Text)) {
      throw new Error("Missing stale fixture");
    }
    const pending = deferred<ReadonlyMap<string, TransliterationResult | null>>();
    const engine: FrameEngineClient = {
      transliterate: () => pending.promise,
      clear: () => undefined,
    };
    const controller = new FrameController(document, engine);
    const start = controller.start();
    await Promise.resolve();
    node.data = "大阪";
    pending.resolve(new Map([["東京", result("東京", "toukyou")]]));
    await expect(start).resolves.toMatchObject({ processedNodes: 0, failedNodes: 1 });
    controller.stop();
    expect(node.data).toBe("大阪");
  });

  it("does not restore over a page write made after rendering", async () => {
    document.documentElement.lang = "ja";
    document.body.innerHTML = `<p id="target">東京</p>`;
    const node = document.querySelector("#target")?.firstChild;
    if (!(node instanceof Text)) {
      throw new Error("Missing post-render fixture");
    }
    const controller = new FrameController(
      document,
      new FakeEngine(new Map([["東京", result("東京", "toukyou")]])),
    );
    await controller.start();
    expect(node.data).toBe("toukyou");
    node.data = "大阪";
    controller.stop();
    expect(node.data).toBe("大阪");
  });

  it("invalidates in-flight work when stopped", async () => {
    document.documentElement.lang = "ja";
    document.body.innerHTML = `<p id="target">東京</p>`;
    const node = document.querySelector("#target")?.firstChild;
    if (!(node instanceof Text)) {
      throw new Error("Missing in-flight fixture");
    }
    const pending = deferred<ReadonlyMap<string, TransliterationResult | null>>();
    const controller = new FrameController(document, {
      transliterate: () => pending.promise,
      clear: () => undefined,
    });
    const start = controller.start();
    await Promise.resolve();
    controller.stop();
    pending.resolve(new Map([["東京", result("東京", "toukyou")]]));
    await start;
    expect(node.data).toBe("東京");
    expect(controller.status().state).toBe("original");
  });

  it("reports unsupported content without invoking the engine", async () => {
    document.documentElement.lang = "en";
    document.body.innerHTML = `<p>Only English 123 🎵</p>`;
    const engine = new FakeEngine(new Map());
    const controller = new FrameController(document, engine);
    await expect(controller.start()).resolves.toMatchObject({
      state: "original",
      reason: "no-supported-text",
      eligibleNodes: 0,
    });
    expect(engine.calls).toHaveLength(0);
  });
});
