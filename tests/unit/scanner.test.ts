import { describe, expect, it } from "vitest";
import {
  collectEligibleTextNodes,
  isEligibleTextNode,
} from "../../src/content/scanner";
import type { SliceScheduler } from "../../src/content/scheduler";

function text(selector: string): Text {
  const node = document.querySelector(selector)?.firstChild;
  if (!(node instanceof Text)) {
    throw new Error(`Missing text fixture ${selector}`);
  }
  return node;
}

describe("static DOM scanner", () => {
  it("accepts eligible Japanese and rejects unsafe or hidden regions", () => {
    document.documentElement.lang = "ja";
    document.body.innerHTML = `
      <p id="allowed">English 愛してる 123 🎵</p>
      <code id="code">東京</code>
      <pre id="pre">東京</pre>
      <label>Field <textarea id="textarea">東京</textarea></label>
      <div id="editable" contenteditable="true">東京</div>
      <div id="ignored" data-btb-ignore>東京</div>
      <div id="hidden" hidden>東京</div>
      <div id="aria-hidden" aria-hidden="true">東京</div>
      <div id="display-none" style="display:none">東京</div>
      <svg><text id="svg">東京</text></svg>
      <math><mtext id="math">東京</mtext></math>
    `;
    expect(isEligibleTextNode(text("#allowed"))).toBe(true);
    for (const selector of [
      "#code",
      "#pre",
      "#textarea",
      "#editable",
      "#ignored",
      "#hidden",
      "#aria-hidden",
      "#display-none",
      "#svg",
      "#math",
    ]) {
      expect(isEligibleTextNode(text(selector)), selector).toBe(false);
    }
  });

  it("walks a 5,000-node fixture in bounded yielding slices", async () => {
    document.documentElement.lang = "ja";
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 5_000; index += 1) {
      const span = document.createElement("span");
      span.textContent = `東京 ${String(index)}`;
      fragment.append(span);
    }
    document.body.replaceChildren(fragment);
    let clock = 0;
    let yields = 0;
    const scheduler: SliceScheduler = {
      now: () => {
        clock += 0.01;
        return clock;
      },
      yield: () => {
        yields += 1;
        return Promise.resolve();
      },
    };
    const result = await collectEligibleTextNodes(document, scheduler, {
      budgetMs: 8,
      nodeLimit: 100,
    });
    expect(result.nodes).toHaveLength(5_000);
    expect(result.diagnostics.sliceCount).toBe(50);
    expect(result.diagnostics.maximumSliceMs).toBeLessThan(8);
    expect(yields).toBe(49);
  });
});
