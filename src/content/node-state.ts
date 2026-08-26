export type NodeProcessingStatus =
  | "queued"
  | "processing"
  | "rendered"
  | "failed"
  | "restoring";

export interface NodeState {
  source: string;
  rendered: string | null;
  revision: number;
  sessionEpoch: number;
  rendererId: "replace-v1";
  optionsKey: "ja:ascii-hepburn-v1";
  status: NodeProcessingStatus;
  boundaryPrefix: string;
}

export class NodeStateRegistry {
  readonly #states = new WeakMap<Text, NodeState>();
  readonly #trackedNodes = new Set<Text>();
  readonly #activeNodes = new Set<Text>();

  capture(node: Text, sessionEpoch: number): NodeState {
    const state: NodeState = {
      source: node.data,
      rendered: null,
      revision: 1,
      sessionEpoch,
      rendererId: "replace-v1",
      optionsKey: "ja:ascii-hepburn-v1",
      status: "queued",
      boundaryPrefix: "",
    };
    this.#states.set(node, state);
    this.#trackedNodes.add(node);
    return state;
  }

  updateSource(node: Text, sessionEpoch: number): NodeState {
    const state = this.#states.get(node);
    if (state?.sessionEpoch !== sessionEpoch) {
      return this.capture(node, sessionEpoch);
    }
    state.source = node.data;
    state.rendered = null;
    state.revision += 1;
    state.status = "queued";
    state.boundaryPrefix = "";
    this.#activeNodes.delete(node);
    return state;
  }

  get(node: Text): NodeState | undefined {
    return this.#states.get(node);
  }

  markActive(node: Text): void {
    this.#activeNodes.add(node);
  }

  markFailed(node: Text): void {
    const state = this.#states.get(node);
    if (state !== undefined) {
      state.status = "failed";
      this.#activeNodes.delete(node);
    }
  }

  isExpectedRenderedValue(node: Text): boolean {
    const state = this.#states.get(node);
    return state?.rendered !== null && state?.rendered === node.data;
  }

  addBoundaryPrefix(node: Text, prefix: string): boolean {
    const state = this.#states.get(node);
    if (
      state === undefined ||
      !this.#activeNodes.has(node) ||
      state.rendered === null ||
      state.boundaryPrefix.length > 0 ||
      node.data !== state.rendered
    ) {
      return false;
    }
    state.boundaryPrefix = prefix;
    state.rendered = prefix + state.rendered;
    node.data = state.rendered;
    return true;
  }

  restoreOwned(): number {
    let restored = 0;
    for (const node of this.#activeNodes) {
      const state = this.#states.get(node);
      if (state === undefined) {
        continue;
      }
      state.status = "restoring";
      if (state.rendered !== null && node.data === state.rendered) {
        node.data = state.source;
        restored += 1;
      }
      this.#states.delete(node);
    }
    this.#activeNodes.clear();
    this.#trackedNodes.clear();
    return restored;
  }

  clearUnrendered(nodes: readonly Text[]): void {
    for (const node of nodes) {
      if (!this.#activeNodes.has(node)) {
        this.#states.delete(node);
        this.#trackedNodes.delete(node);
      }
    }
  }

  forget(node: Text): boolean {
    const wasTracked = this.#trackedNodes.delete(node);
    this.#activeNodes.delete(node);
    this.#states.delete(node);
    return wasTracked;
  }

  trackedNodes(): readonly Text[] {
    return [...this.#trackedNodes];
  }

  activeCount(): number {
    return this.#activeNodes.size;
  }

  failedCount(): number {
    let failed = 0;
    for (const node of this.#trackedNodes) {
      if (this.#states.get(node)?.status === "failed") {
        failed += 1;
      }
    }
    return failed;
  }
}
