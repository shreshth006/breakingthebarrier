import { hasJapaneseLanguageEvidence } from "../detector/language-evidence";
import {
  CONTENT_IGNORE_ATTRIBUTE,
  MAX_TRANSLITERATION_SOURCE_UTF16,
} from "../shared/config";
import {
  browserSliceScheduler,
  defaultSliceLimits,
} from "./scheduler";
import type { SliceLimits, SliceScheduler } from "./scheduler";

const EXCLUDED_ELEMENTS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "CODE",
  "PRE",
  "KBD",
  "SAMP",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "OPTION",
  "SVG",
  "MATH",
]);

function isSemanticallyHidden(element: Element): boolean {
  return (
    element.hasAttribute("hidden") ||
    element.hasAttribute("inert") ||
    element.getAttribute("aria-hidden") === "true"
  );
}

function hasExcludedAncestor(element: Element): boolean {
  for (let current: Element | null = element; current !== null; current = current.parentElement) {
    if (
      EXCLUDED_ELEMENTS.has(current.localName.toUpperCase()) ||
      current.hasAttribute(CONTENT_IGNORE_ATTRIBUTE) ||
      current.closest(`[${CONTENT_IGNORE_ATTRIBUTE}]`) !== null ||
      current instanceof HTMLElement && current.isContentEditable ||
      current.getAttribute("contenteditable") !== null &&
        current.getAttribute("contenteditable") !== "false" ||
      isSemanticallyHidden(current)
    ) {
      return true;
    }
  }
  return false;
}

function isStyleVisible(element: Element): boolean {
  if (typeof element.checkVisibility === "function") {
    return element.checkVisibility({
      checkOpacity: false,
      checkVisibilityCSS: true,
      contentVisibilityAuto: true,
    });
  }
  const view = element.ownerDocument.defaultView;
  if (view === null) {
    return true;
  }
  const style = view.getComputedStyle(element);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.visibility !== "collapse" &&
    style.contentVisibility !== "hidden"
  );
}

export function isEligibleTextNode(node: Text): boolean {
  const source = node.data;
  const parent = node.parentElement;
  return (
    node.isConnected &&
    parent !== null &&
    source.trim().length > 0 &&
    source.length <= MAX_TRANSLITERATION_SOURCE_UTF16 &&
    !hasExcludedAncestor(parent) &&
    hasJapaneseLanguageEvidence(source, parent) &&
    isStyleVisible(parent)
  );
}

export interface ScanDiagnostics {
  readonly visitedNodes: number;
  readonly sliceCount: number;
  readonly maximumSliceMs: number;
}

export interface ScanResult {
  readonly nodes: readonly Text[];
  readonly diagnostics: ScanDiagnostics;
}

export type ScanRoot = Document | Element | DocumentFragment;

export async function collectEligibleTextNodes(
  root: ScanRoot,
  scheduler: SliceScheduler = browserSliceScheduler,
  limits: SliceLimits = defaultSliceLimits,
): Promise<ScanResult> {
  const ownerDocument =
    root.nodeType === Node.DOCUMENT_NODE ? (root as Document) : root.ownerDocument;
  if (ownerDocument === null) {
    return {
      nodes: [],
      diagnostics: { visitedNodes: 0, sliceCount: 0, maximumSliceMs: 0 },
    };
  }
  const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let visitedNodes = 0;
  let sliceCount = 0;
  let maximumSliceMs = 0;
  let current = walker.nextNode();

  while (current !== null) {
    sliceCount += 1;
    const startedAt = scheduler.now();
    let sliceNodes = 0;
    while (current !== null) {
      visitedNodes += 1;
      sliceNodes += 1;
      if (current instanceof Text && isEligibleTextNode(current)) {
        nodes.push(current);
      }
      current = walker.nextNode();
      const elapsed = scheduler.now() - startedAt;
      if (
        current !== null &&
        (sliceNodes >= limits.nodeLimit || elapsed >= limits.budgetMs)
      ) {
        maximumSliceMs = Math.max(maximumSliceMs, elapsed);
        await scheduler.yield();
        break;
      }
    }
    maximumSliceMs = Math.max(maximumSliceMs, scheduler.now() - startedAt);
  }

  return {
    nodes,
    diagnostics: { visitedNodes, sliceCount, maximumSliceMs },
  };
}
