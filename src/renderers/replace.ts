import type { TransliterationResult } from "../engines/contracts";
import type { NodeState } from "../content/node-state";
import type { NodeStateRegistry } from "../content/node-state";
import type { Renderer } from "./contracts";

export const replaceRenderer: Renderer = {
  id: "replace-v1",
  apply(target: Text, result: TransliterationResult, state: NodeState): boolean {
    if (target.data !== state.source || result.source !== state.source) {
      return false;
    }
    state.rendered = result.rendered;
    state.status = "rendered";
    target.data = result.rendered;
    return true;
  },
};

const ASCII_WORD_END = /[A-Za-z0-9]$/u;
const ASCII_WORD_START = /^[A-Za-z0-9]/u;
const INLINE_ELEMENTS = new Set([
  "A", "ABBR", "BDI", "BDO", "B", "CITE", "DATA", "DEL", "EM",
  "I", "IMG", "INS", "LABEL", "MARK", "Q", "S", "SMALL", "SPAN",
  "STRONG", "SUB", "SUP", "TIME", "U", "VAR", "WBR",
]);
const HARD_BREAK_ELEMENTS = new Set(["BR", "HR"]);

interface NextTextResult {
  readonly node: Text | null;
  readonly hardBreak: boolean;
}

function firstTextDescendant(node: Node): Text | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return node as Text;
  }
  for (const child of node.childNodes) {
    const text = firstTextDescendant(child);
    if (text !== null) {
      return text;
    }
  }
  return null;
}

function lastTextDescendant(node: Node): Text | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return node as Text;
  }
  for (let index = node.childNodes.length - 1; index >= 0; index -= 1) {
    const child = node.childNodes[index];
    if (child === undefined) {
      continue;
    }
    const text = lastTextDescendant(child);
    if (text !== null) {
      return text;
    }
  }
  return null;
}

function nextTextNode(node: Text): NextTextResult {
  let current: Node | null = node;
  let hardBreak = false;
  while (current !== null) {
    if (current.nextSibling !== null) {
      current = current.nextSibling;
      if (
        current.nodeType === Node.ELEMENT_NODE &&
        HARD_BREAK_ELEMENTS.has((current as Element).localName.toUpperCase())
      ) {
        hardBreak = true;
      }
      const text = firstTextDescendant(current);
      if (text !== null) {
        return { node: text, hardBreak };
      }
      continue;
    }
    current = current.parentNode;
  }
  return { node: null, hardBreak };
}

function previousTextNode(node: Text): Text | null {
  let current: Node | null = node;
  while (current !== null) {
    if (current.previousSibling !== null) {
      current = current.previousSibling;
      const text = lastTextDescendant(current);
      if (text !== null) {
        return text;
      }
      continue;
    }
    current = current.parentNode;
  }
  return null;
}

function isActiveRenderedNode(
  node: Text,
  registry: NodeStateRegistry,
): boolean {
  const state = registry.get(node);
  return state?.status === "rendered" && state.rendered !== null;
}

export function collectInlineBoundaryNodes(
  nodes: readonly Text[],
  registry: NodeStateRegistry,
): readonly Text[] {
  const expanded = new Set<Text>();
  for (const node of nodes) {
    if (!node.isConnected) {
      continue;
    }
    expanded.add(node);
    const previous = previousTextNode(node);
    if (previous !== null && isActiveRenderedNode(previous, registry)) {
      expanded.add(previous);
    }
    const next = nextTextNode(node).node;
    if (next !== null && isActiveRenderedNode(next, registry)) {
      expanded.add(next);
    }
  }
  return [...expanded].sort((left, right) => {
    if (left === right) {
      return 0;
    }
    return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : 1;
  });
}

function crossesBlockBoundary(left: Text, right: Text): boolean {
  const leftAncestors = new Set<Element>();
  for (let current = left.parentElement; current !== null; current = current.parentElement) {
    leftAncestors.add(current);
  }
  for (let current = right.parentElement; current !== null; current = current.parentElement) {
    if (leftAncestors.has(current)) {
      return false;
    }
    if (!INLINE_ELEMENTS.has(current.localName.toUpperCase())) {
      return true;
    }
  }
  return true;
}

export function applyInlineBoundarySpacing(
  nodes: readonly Text[],
  registry: NodeStateRegistry,
): number {
  let inserted = 0;
  for (let index = 0; index + 1 < nodes.length; index += 1) {
    const left = nodes[index];
    const right = nodes[index + 1];
    if (left === undefined || right === undefined) {
      continue;
    }
    const leftState = registry.get(left);
    const rightState = registry.get(right);
    if (
      !left.isConnected ||
      !right.isConnected ||
      leftState === undefined ||
      rightState === undefined ||
      /\s$/u.test(leftState.source) ||
      /^\s/u.test(rightState.source)
    ) {
      continue;
    }
    const next = nextTextNode(left);
    if (
      next.node !== right ||
      next.hardBreak ||
      crossesBlockBoundary(left, right)
    ) {
      continue;
    }
    if (
      leftState.rendered === null ||
      rightState.rendered === null ||
      !ASCII_WORD_END.test(leftState.rendered) ||
      !ASCII_WORD_START.test(rightState.rendered)
    ) {
      continue;
    }
    if (registry.addBoundaryPrefix(right, " ")) {
      inserted += 1;
    }
  }
  return inserted;
}
