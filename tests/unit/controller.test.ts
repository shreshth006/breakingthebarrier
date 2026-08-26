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

async function flushDynamicWork(): Promise<void> {
  for (let index = 0; index < 10; index += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    await Promise.resolve();
  }
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
    controller.stop();
  });

  it("adds only safe inline boundary spaces and removes them on restore", async () => {
    document.documentElement.lang = "ja";
    document.body.innerHTML =
      `<p id="inline"><span id="first">東京</span><span id="second">です</span></p>` +
      `<p id="blocks">東京</p><p id="next-block">です</p>`;
    const controller = new FrameController(
      document,
      new FakeEngine(
        new Map([
          ["東京", result("東京", "toukyou")],
          ["です", result("です", "desu")],
        ]),
      ),
    );

    await controller.start();
    expect(document.querySelector("#inline")?.textContent).toBe("toukyou desu");
    expect(document.querySelector("#second")?.textContent).toBe(" desu");
    expect(document.querySelector("#next-block")?.textContent).toBe("desu");

    controller.stop();
    expect(document.querySelector("#inline")?.textContent).toBe("東京です");
    expect(document.querySelector("#second")?.textContent).toBe("です");
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
    controller.stop();
  });

  it("romanizes a same-node page overwrite and restores the latest source", async () => {
    document.documentElement.lang = "ja";
    document.body.innerHTML = `<p id="target">東京</p>`;
    const node = document.querySelector("#target")?.firstChild;
    if (!(node instanceof Text)) throw new Error("Missing dynamic fixture");
    const controller = new FrameController(
      document,
      new FakeEngine(
        new Map([
          ["東京", result("東京", "toukyou")],
          ["大阪", result("大阪", "oosaka")],
        ]),
      ),
    );

    await controller.start();
    node.data = "大阪";
    await flushDynamicWork();
    expect(node.data).toBe("oosaka");
    controller.stop();
    expect(node.data).toBe("大阪");
  });

  it("coalesces a rapid same-node mutation burst to the latest source", async () => {
    document.documentElement.lang = "ja";
    document.body.innerHTML = `<p id="target">東京</p>`;
    const node = document.querySelector("#target")?.firstChild;
    if (!(node instanceof Text)) throw new Error("Missing rapid mutation fixture");
    const controller = new FrameController(
      document,
      new FakeEngine(
        new Map([
          ["東京", result("東京", "toukyou")],
          ["大阪", result("大阪", "oosaka")],
          ["京都", result("京都", "kyouto")],
          ["名古屋", result("名古屋", "nagoya")],
        ]),
      ),
    );
    await controller.start();
    node.data = "大阪";
    node.data = "京都";
    node.data = "名古屋";
    await flushDynamicWork();
    expect(node.data).toBe("nagoya");
    controller.stop();
    expect(node.data).toBe("名古屋");
  });

  it("processes added text, added subtrees, and replacement nodes incrementally", async () => {
    document.documentElement.lang = "ja";
    document.body.innerHTML = `<main id="root"><p id="lyrics"></p></main>`;
    const root = document.querySelector("#root");
    const lyrics = document.querySelector("#lyrics");
    if (!(root instanceof HTMLElement) || !(lyrics instanceof HTMLElement)) {
      throw new Error("Missing subtree fixture");
    }
    const engine = new FakeEngine(
      new Map([
        ["星座になれたら", result("星座になれたら", "seiza ni naretara")],
        ["愛してる", result("愛してる", "aishiteru")],
        ["東京", result("東京", "toukyou")],
        ["大阪", result("大阪", "oosaka")],
      ]),
    );
    const controller = new FrameController(document, engine);

    await controller.start();
    lyrics.textContent = "星座になれたら";
    await flushDynamicWork();
    expect(lyrics.textContent).toBe("seiza ni naretara");

    const section = document.createElement("section");
    section.innerHTML = "<span>愛してる</span><span>東京</span>";
    root.append(section);
    await flushDynamicWork();
    expect(section.textContent).toBe("aishiteru toukyou");

    const replacement = document.createElement("span");
    replacement.textContent = "大阪";
    lyrics.replaceChildren(replacement);
    await flushDynamicWork();
    expect(replacement.textContent).toBe("oosaka");
    controller.stop();
  });

  it("does not recursively process renderer self-writes and cleans removed nodes", async () => {
    document.documentElement.lang = "ja";
    document.body.innerHTML = `<main id="root"><p id="target">東京</p></main>`;
    const root = document.querySelector("#root");
    const target = document.querySelector("#target");
    if (!(root instanceof HTMLElement) || !(target instanceof HTMLElement)) {
      throw new Error("Missing cleanup fixture");
    }
    const engine = new FakeEngine(
      new Map([["東京", result("東京", "toukyou")]]),
    );
    const controller = new FrameController(document, engine);
    await controller.start();
    await flushDynamicWork();
    expect(engine.calls).toHaveLength(1);
    target.remove();
    await flushDynamicWork();
    expect(controller.status()).toMatchObject({
      eligibleNodes: 0,
      processedNodes: 0,
      failedNodes: 0,
    });
    controller.stop();
    root.replaceChildren();
  });

  it("discards a dynamic result when Stop interrupts an in-flight request", async () => {
    document.documentElement.lang = "ja";
    document.body.innerHTML = `<p id="target">東京</p>`;
    const node = document.querySelector("#target")?.firstChild;
    if (!(node instanceof Text)) throw new Error("Missing in-flight dynamic fixture");
    const pending = deferred<ReadonlyMap<string, TransliterationResult | null>>();
    let calls = 0;
    const controller = new FrameController(document, {
      transliterate: (sources) => {
        calls += 1;
        if (calls === 1) {
          return Promise.resolve(
            new Map([[sources[0] ?? "", result("東京", "toukyou")]]),
          );
        }
        return pending.promise;
      },
      clear: () => undefined,
    });
    await controller.start();
    node.data = "大阪";
    for (let index = 0; index < 20 && calls < 2; index += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
    expect(calls).toBe(2);
    controller.stop();
    pending.resolve(new Map([["大阪", result("大阪", "oosaka")]]));
    await flushDynamicWork();
    expect(node.data).toBe("大阪");
    expect(controller.status().state).toBe("original");
  });
});
