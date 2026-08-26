import type { TransliterationResult } from "../engines/contracts";
import type {
  FrameSessionState,
  FrameSessionSummary,
  PageStatusReason,
} from "../shared/messages";
import { CONTENT_WRITE_SLICE_NODE_LIMIT } from "../shared/config";
import {
  applyInlineBoundarySpacing,
  collectInlineBoundaryNodes,
  replaceRenderer,
} from "../renderers/replace";
import type { Renderer } from "../renderers/contracts";
import { LocalFrameEngineClient } from "./engine-client";
import type { FrameEngineClient } from "./engine-client";
import { NodeStateRegistry } from "./node-state";
import { isEligibleTextNode, collectEligibleTextNodes } from "./scanner";
import type { ScanRoot, ScanResult } from "./scanner";
import { browserSliceScheduler } from "./scheduler";
import type { SliceScheduler } from "./scheduler";

type Scanner = (root: ScanRoot) => Promise<ScanResult>;

function isTextNode(node: Node): node is Text {
  return node.nodeType === Node.TEXT_NODE;
}

function walkTextNodes(root: Node, visit: (node: Text) => void): void {
  if (isTextNode(root)) {
    visit(root);
    return;
  }
  const walker = root.ownerDocument?.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
  );
  if (walker === undefined) {
    return;
  }
  let current = walker.nextNode();
  while (current !== null) {
    if (isTextNode(current)) {
      visit(current);
    }
    current = walker.nextNode();
  }
}

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
  #observer: MutationObserver | undefined;
  #pendingNodes = new Set<Text>();
  #pendingRoots = new Set<Node>();
  #pendingRemovedRoots = new Set<Node>();
  #drainScheduled = false;
  #drainRunning = false;

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
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#pendingNodes.clear();
    this.#pendingRoots.clear();
    this.#pendingRemovedRoots.clear();
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
    this.#installObserver(epoch);

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
    await this.#applyResults(snapshots, results, epoch, true);
    this.#registry.clearUnrendered(scan.nodes);
    if (epoch !== this.#sessionEpoch) {
      return this.status();
    }
    if (this.#processedNodes === 0 && this.#failedNodes > 0) {
      this.#state = "degraded";
      this.#reason = "processor-failure";
    }
    this.#scheduleDrain(epoch);
    return this.status();
  }

  #installObserver(epoch: number): void {
    this.#observer?.disconnect();
    this.#observer = new MutationObserver((records) => {
      if (epoch !== this.#sessionEpoch) {
        return;
      }
      for (const record of records) {
        if (record.type === "characterData" && isTextNode(record.target)) {
          this.#queueNode(record.target, epoch);
          continue;
        }
        if (record.type !== "childList") {
          continue;
        }
        for (const node of record.removedNodes) {
          this.#pendingRemovedRoots.add(node);
        }
        for (const node of record.addedNodes) {
          this.#pendingRoots.add(node);
        }
      }
      this.#scheduleDrain(epoch);
    });
    this.#observer.observe(this.#document, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  #queueNode(node: Text, epoch: number): void {
    if (epoch !== this.#sessionEpoch || !node.isConnected) {
      return;
    }
    const existing = this.#registry.get(node);
    if (
      existing?.sessionEpoch === epoch &&
      this.#registry.isExpectedRenderedValue(node)
    ) {
      return;
    }
    if (
      existing?.sessionEpoch === epoch &&
      existing.rendered === null &&
      existing.source === node.data &&
      (existing.status === "queued" ||
        existing.status === "processing" ||
        existing.status === "failed")
    ) {
      if (existing.status !== "failed") {
        this.#pendingNodes.add(node);
      }
      return;
    }
    if (!isEligibleTextNode(node)) {
      if (existing?.sessionEpoch === epoch && existing.source !== node.data) {
        this.#adjustCountsForSourceUpdate(existing.status);
        this.#registry.updateSource(node, epoch);
        this.#registry.markFailed(node);
        this.#failedNodes += 1;
      }
      return;
    }
    if (existing?.sessionEpoch !== epoch) {
      this.#registry.capture(node, epoch);
      this.#eligibleNodes += 1;
    } else {
      this.#adjustCountsForSourceUpdate(existing.status);
      this.#registry.updateSource(node, epoch);
    }
    this.#pendingNodes.add(node);
  }

  #adjustCountsForSourceUpdate(status: string): void {
    if (status === "rendered") {
      this.#processedNodes = Math.max(0, this.#processedNodes - 1);
    }
    if (status === "failed") {
      this.#failedNodes = Math.max(0, this.#failedNodes - 1);
    }
  }

  #scheduleDrain(epoch: number): void {
    if (
      this.#drainScheduled ||
      epoch !== this.#sessionEpoch ||
      this.#state === "stopping"
    ) {
      return;
    }
    this.#drainScheduled = true;
    setTimeout(() => {
      this.#drainScheduled = false;
      void this.#drain(epoch);
    }, 0);
  }

  async #drain(epoch: number): Promise<void> {
    if (this.#drainRunning || epoch !== this.#sessionEpoch) {
      return;
    }
    this.#drainRunning = true;
    try {
      while (epoch === this.#sessionEpoch) {
        const removed = [...this.#pendingRemovedRoots];
        this.#pendingRemovedRoots.clear();
        for (const root of removed) {
          walkTextNodes(root, (node) => {
            const state = this.#registry.get(node);
            if (state !== undefined && this.#registry.forget(node)) {
              this.#eligibleNodes = Math.max(0, this.#eligibleNodes - 1);
              if (state.status === "rendered") {
                this.#processedNodes = Math.max(0, this.#processedNodes - 1);
              } else if (state.status === "failed") {
                this.#failedNodes = Math.max(0, this.#failedNodes - 1);
              }
            }
          });
        }

        const roots = this.#takeNonNestedRoots();
        for (const root of roots) {
          if (root.isConnected || root === this.#document) {
            if (isTextNode(root)) {
              this.#queueNode(root, epoch);
            } else {
              const scan = await this.#scanner(root as ScanRoot);
              for (const node of scan.nodes) {
                this.#queueNode(node, epoch);
              }
            }
          }
          if (epoch !== this.#sessionEpoch) {
            return;
          }
        }

        const nodes = [...this.#pendingNodes];
        this.#pendingNodes.clear();
        if (nodes.length > 0) {
          const snapshots = nodes
            .filter((node) => node.isConnected && isEligibleTextNode(node))
            .map((node) => {
              const state = this.#registry.get(node);
              if (state?.sessionEpoch !== epoch) {
                return { node, state: this.#registry.capture(node, epoch) };
              }
              state.status = "processing";
              return { node, state };
            });
          if (snapshots.length > 0) {
            this.#state = "active";
            this.#reason = null;
            let results: ReadonlyMap<string, TransliterationResult | null>;
            try {
              results = await this.#engine.transliterate(
                snapshots.map(({ state }) => state.source),
              );
            } catch {
              results = new Map();
            }
            await this.#applyResults(snapshots, results, epoch, false);
            applyInlineBoundarySpacing(
              collectInlineBoundaryNodes(
                snapshots.map(({ node }) => node),
                this.#registry,
              ),
              this.#registry,
            );
          }
        }

        if (
          this.#pendingNodes.size === 0 &&
          this.#pendingRoots.size === 0 &&
          this.#pendingRemovedRoots.size === 0
        ) {
          break;
        }
        await this.#scheduler.yield();
      }
    } finally {
      this.#drainRunning = false;
      if (
        epoch === this.#sessionEpoch &&
        (this.#pendingNodes.size > 0 ||
          this.#pendingRoots.size > 0 ||
          this.#pendingRemovedRoots.size > 0)
      ) {
        this.#scheduleDrain(epoch);
      }
    }
  }

  #takeNonNestedRoots(): readonly Node[] {
    const roots = [...this.#pendingRoots];
    this.#pendingRoots.clear();
    return roots.filter((root) =>
      !roots.some(
        (candidate) => candidate !== root && candidate.contains(root),
      ),
    );
  }

  async #applyResults(
    snapshots: readonly { node: Text; state: ReturnType<NodeStateRegistry["capture"]> }[],
    results: ReadonlyMap<string, TransliterationResult | null>,
    epoch: number,
    initial: boolean,
  ): Promise<void> {
    for (const [index, snapshot] of snapshots.entries()) {
      if (epoch !== this.#sessionEpoch) {
        break;
      }
      const current = this.#registry.get(snapshot.node);
      if (
        current?.sessionEpoch === epoch &&
        (current.source !== snapshot.state.source ||
          snapshot.node.data !== snapshot.state.source)
      ) {
        this.#queueNode(snapshot.node, epoch);
      }
      const latest = this.#registry.get(snapshot.node);
      const result = results.get(snapshot.state.source) ?? null;
      if (
        result === null ||
        latest?.sessionEpoch !== epoch ||
        latest.revision !== snapshot.state.revision ||
        latest.source !== snapshot.state.source ||
        snapshot.node.data !== snapshot.state.source ||
        !snapshot.node.isConnected
      ) {
        if (
          latest?.revision === snapshot.state.revision &&
          latest.status !== "failed"
        ) {
          latest.status = "failed";
          this.#failedNodes += 1;
        }
      } else if (this.#renderer.apply(snapshot.node, result, latest)) {
        this.#registry.markActive(snapshot.node);
        this.#processedNodes += 1;
      } else {
        latest.status = "failed";
        this.#failedNodes += 1;
      }
      if (
        index + 1 < snapshots.length &&
        (index + 1) % CONTENT_WRITE_SLICE_NODE_LIMIT === 0
      ) {
        await this.#scheduler.yield();
      }
    }
    if (initial) {
      applyInlineBoundarySpacing(
        snapshots.map(({ node }) => node),
        this.#registry,
      );
    }
  }
}
