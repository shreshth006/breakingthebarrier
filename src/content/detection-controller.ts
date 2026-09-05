import { CONTENT_JAPANESE_DETECTION_MIN_NODES } from "../shared/config";
import { collectEligibleTextNodes, isEligibleTextNode } from "./scanner";
import type { ScanResult, ScanRoot } from "./scanner";

type Scanner = (root: ScanRoot) => Promise<ScanResult>;

function isTextNode(node: Node): node is Text {
  return node.nodeType === Node.TEXT_NODE;
}

export interface DetectionSummary {
  readonly detected: boolean;
  readonly eligibleNodes: number;
}

export class JapaneseDetectionController {
  readonly #document: Document;
  readonly #scanner: Scanner;
  readonly #minimumNodes: number;
  #observer: MutationObserver | undefined;
  #pendingRoots = new Set<Node>();
  #pendingNodes = new Set<Text>();
  #scheduled = false;
  #running = false;
  #epoch = 0;
  #onDetected: ((summary: DetectionSummary) => void) | undefined;

  constructor(
    document: Document,
    scanner: Scanner = collectEligibleTextNodes,
    minimumNodes = CONTENT_JAPANESE_DETECTION_MIN_NODES,
  ) {
    this.#document = document;
    this.#scanner = scanner;
    this.#minimumNodes = minimumNodes;
  }

  async start(
    onDetected: (summary: DetectionSummary) => void,
  ): Promise<DetectionSummary> {
    this.stop();
    const epoch = ++this.#epoch;
    this.#onDetected = onDetected;
    this.#installObserver(epoch);
    const scan = await this.#scanner(this.#document);
    if (epoch !== this.#epoch) {
      return { detected: false, eligibleNodes: 0 };
    }
    return this.#accept(scan.nodes.length);
  }

  stop(): void {
    this.#epoch += 1;
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#pendingRoots.clear();
    this.#pendingNodes.clear();
    this.#scheduled = false;
    this.#onDetected = undefined;
  }

  #installObserver(epoch: number): void {
    this.#observer = new MutationObserver((records) => {
      if (epoch !== this.#epoch) {
        return;
      }
      for (const record of records) {
        if (record.type === "characterData" && isTextNode(record.target)) {
          this.#pendingNodes.add(record.target);
        } else if (record.type === "childList") {
          for (const node of record.addedNodes) {
            this.#pendingRoots.add(node);
          }
        }
      }
      this.#schedule(epoch);
    });
    this.#observer.observe(this.#document, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  #schedule(epoch: number): void {
    if (this.#scheduled || epoch !== this.#epoch) {
      return;
    }
    this.#scheduled = true;
    setTimeout(() => {
      this.#scheduled = false;
      void this.#drain(epoch);
    }, 0);
  }

  async #drain(epoch: number): Promise<void> {
    if (this.#running || epoch !== this.#epoch) {
      return;
    }
    this.#running = true;
    try {
      let eligibleNodes = 0;
      for (const node of this.#pendingNodes) {
        if (isEligibleTextNode(node)) {
          eligibleNodes += 1;
        }
      }
      this.#pendingNodes.clear();
      const roots = [...this.#pendingRoots];
      this.#pendingRoots.clear();
      const topLevelRoots = roots.filter(
        (root) =>
          !roots.some(
            (candidate) => candidate !== root && candidate.contains(root),
          ),
      );
      for (const root of topLevelRoots) {
        if (epoch !== this.#epoch) {
          return;
        }
        if (!root.isConnected) {
          continue;
        }
        if (isTextNode(root)) {
          if (isEligibleTextNode(root)) {
            eligibleNodes += 1;
          }
        } else {
          const scan = await this.#scanner(root as ScanRoot);
          eligibleNodes += scan.nodes.length;
        }
        if (eligibleNodes >= this.#minimumNodes) {
          this.#accept(eligibleNodes);
          return;
        }
      }
      this.#accept(eligibleNodes);
    } finally {
      this.#running = false;
      if (
        epoch === this.#epoch &&
        (this.#pendingNodes.size > 0 || this.#pendingRoots.size > 0)
      ) {
        this.#schedule(epoch);
      }
    }
  }

  #accept(eligibleNodes: number): DetectionSummary {
    const summary = {
      detected: eligibleNodes >= this.#minimumNodes,
      eligibleNodes,
    };
    if (summary.detected) {
      const onDetected = this.#onDetected;
      this.stop();
      onDetected?.(summary);
    }
    return summary;
  }
}
