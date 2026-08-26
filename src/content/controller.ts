import type { TransliterationResult } from "../engines/contracts";
import type {
  FrameSessionState,
  FrameSessionSummary,
  PageStatusReason,
} from "../shared/messages";
import { CONTENT_WRITE_SLICE_NODE_LIMIT } from "../shared/config";
import { replaceRenderer } from "../renderers/replace";
import type { Renderer } from "../renderers/contracts";
import { LocalFrameEngineClient } from "./engine-client";
import type { FrameEngineClient } from "./engine-client";
import { NodeStateRegistry } from "./node-state";
import { collectEligibleTextNodes } from "./scanner";
import type { ScanResult } from "./scanner";
import { browserSliceScheduler } from "./scheduler";
import type { SliceScheduler } from "./scheduler";

type Scanner = (document: Document) => Promise<ScanResult>;

export class FrameController {
  readonly #document: Document;
  readonly #engine: FrameEngineClient;
  readonly #renderer: Renderer;
  readonly #registry = new NodeStateRegistry();
  readonly #scanner: Scanner;
  readonly #scheduler: SliceScheduler;
  #state: FrameSessionState = "original";
  #reason: PageStatusReason = null;
  #eligibleNodes = 0;
  #processedNodes = 0;
  #failedNodes = 0;
  #sessionEpoch = 0;
  #startPromise: Promise<FrameSessionSummary> | undefined;

  constructor(
    document: Document,
    engine: FrameEngineClient = new LocalFrameEngineClient(),
    renderer: Renderer = replaceRenderer,
    scanner: Scanner = collectEligibleTextNodes,
    scheduler: SliceScheduler = browserSliceScheduler,
  ) {
    this.#document = document;
    this.#engine = engine;
    this.#renderer = renderer;
    this.#scanner = scanner;
    this.#scheduler = scheduler;
  }

  status(): FrameSessionSummary {
    return {
      state: this.#state,
      reason: this.#reason,
      eligibleNodes: this.#eligibleNodes,
      processedNodes: this.#processedNodes,
      failedNodes: this.#failedNodes,
    };
  }

  start(): Promise<FrameSessionSummary> {
    if (this.#state === "active" || this.#state === "degraded") {
      return Promise.resolve(this.status());
    }
    this.#startPromise ??= this.#runStart().finally(() => {
      this.#startPromise = undefined;
    });
    return this.#startPromise;
  }

  stop(): FrameSessionSummary {
    this.#sessionEpoch += 1;
    this.#state = "stopping";
    this.#registry.restoreOwned();
    this.#engine.clear();
    this.#state = "original";
    this.#reason = null;
    this.#eligibleNodes = 0;
    this.#processedNodes = 0;
    this.#failedNodes = 0;
    return this.status();
  }

  async #runStart(): Promise<FrameSessionSummary> {
    const epoch = ++this.#sessionEpoch;
    this.#state = "inspecting";
    this.#reason = null;
    this.#eligibleNodes = 0;
    this.#processedNodes = 0;
    this.#failedNodes = 0;

    const scan = await this.#scanner(this.#document);
    if (epoch !== this.#sessionEpoch) {
      return this.status();
    }
    this.#eligibleNodes = scan.nodes.length;
    if (scan.nodes.length === 0) {
      this.#state = "original";
      this.#reason = "no-supported-text";
      return this.status();
    }

    const snapshots = scan.nodes.map((node) => ({
      node,
      state: this.#registry.capture(node, epoch),
    }));
    this.#state = "starting";
    let results: ReadonlyMap<string, TransliterationResult | null>;
    try {
      results = await this.#engine.transliterate(
        snapshots.map(({ state }) => state.source),
      );
    } catch {
      results = new Map();
    }
    if (epoch !== this.#sessionEpoch) {
      this.#registry.clearUnrendered(scan.nodes);
      return this.status();
    }

    this.#state = "active";
    for (const [index, snapshot] of snapshots.entries()) {
      if (epoch !== this.#sessionEpoch) {
        break;
      }
      const result = results.get(snapshot.state.source) ?? null;
      const current = this.#registry.get(snapshot.node);
      if (
        result === null ||
        current?.sessionEpoch !== epoch ||
        current.revision !== snapshot.state.revision ||
        !snapshot.node.isConnected
      ) {
        snapshot.state.status = "failed";
        this.#failedNodes += 1;
      } else if (this.#renderer.apply(snapshot.node, result, current)) {
        this.#registry.markActive(snapshot.node);
        this.#processedNodes += 1;
      } else {
        current.status = "failed";
        this.#failedNodes += 1;
      }
      if (
        index + 1 < snapshots.length &&
        (index + 1) % CONTENT_WRITE_SLICE_NODE_LIMIT === 0
      ) {
        await this.#scheduler.yield();
      }
    }
    this.#registry.clearUnrendered(scan.nodes);
    if (epoch !== this.#sessionEpoch) {
      return this.status();
    }
    if (this.#processedNodes === 0 && this.#failedNodes > 0) {
      this.#state = "degraded";
      this.#reason = "processor-failure";
    }
    return this.status();
  }
}
