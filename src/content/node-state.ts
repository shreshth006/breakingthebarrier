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
}

export class NodeStateRegistry {
  readonly #states = new WeakMap<Text, NodeState>();
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
    };
    this.#states.set(node, state);
    return state;
  }

  get(node: Text): NodeState | undefined {
    return this.#states.get(node);
  }

  markActive(node: Text): void {
    this.#activeNodes.add(node);
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
    return restored;
  }

  clearUnrendered(nodes: readonly Text[]): void {
    for (const node of nodes) {
      if (!this.#activeNodes.has(node)) {
        this.#states.delete(node);
      }
    }
  }
}
