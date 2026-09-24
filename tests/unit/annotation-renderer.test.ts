import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { annotationRenderer } from "../../src/renderers/annotation";
import type { NodeState } from "../../src/content/node-state";
import type { TransliterationResult } from "../../src/engines/contracts";

describe("AnnotationRenderer", () => {
  it("wraps transliterated tokens in isolated <ruby> and <rt> elements", () => {
    const dom = new JSDOM("<!DOCTYPE html><html><body><p id='target'>勉強</p></body></html>");
    const doc = dom.window.document;
    const p = doc.querySelector("#target");
    const targetText = p?.firstChild as Text;

    const state: NodeState = {
      source: "勉強",
      rendered: null,
      revision: 1,
      sessionEpoch: 1,
      rendererId: "annotation-v1",
      optionsKey: "default",
      status: "queued",
      boundaryPrefix: "",
    };

    const result: TransliterationResult = {
      itemId: "1",
      source: "勉強",
      rendered: "benkyou",
      segments: [
        {
          start: 0,
          end: 2,
          source: "勉強",
          reading: "benkyou",
          romanized: "benkyou",
        },
      ],
      warnings: [],
      versions: {
        engine: "5.3.0",
        dictionary: "5.3.0",
        romanizationPolicy: "ascii-hepburn-v1",
        spacingPolicy: "japanese-spacing-v1",
      },
    };

    const success = annotationRenderer.apply(targetText, result, state);
    expect(success).toBe(true);
    expect(state.status).toBe("rendered");
    expect(state.container).toBeDefined();

    const ruby = p?.querySelector("ruby");
    expect(ruby).not.toBeNull();
    expect(ruby?.classList.contains("btb-ruby-token")).toBe(true);
    expect(ruby?.getAttribute("data-btb-ignore")).toBe("");
    expect(ruby?.textContent).toContain("勉強");

    const rt = ruby?.querySelector("rt");
    expect(rt).not.toBeNull();
    expect(rt?.textContent).toBe("benkyou");
  });

  it("aligns multi-word segments into individual word-level <ruby> tokens", () => {
    const dom = new JSDOM("<!DOCTYPE html><html><body><p id='target'>ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ</p></body></html>");
    const doc = dom.window.document;
    const p = doc.querySelector("#target");
    const targetText = p?.firstChild as Text;

    const state: NodeState = {
      source: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ",
      rendered: null,
      revision: 1,
      sessionEpoch: 1,
      rendererId: "annotation-v1",
      optionsKey: "default",
      status: "queued",
      boundaryPrefix: "",
    };

    const result: TransliterationResult = {
      itemId: "1",
      source: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ",
      rendered: "sat sri akal",
      segments: [
        { start: 0, end: 3, source: "ਸਤਿ", reading: "sat", romanized: "sat" },
        { start: 3, end: 4, source: " ", reading: " ", romanized: " " },
        { start: 4, end: 7, source: "ਸ੍ਰੀ", reading: "sri", romanized: "sri" },
        { start: 7, end: 8, source: " ", reading: " ", romanized: " " },
        { start: 8, end: 12, source: "ਅਕਾਲ", reading: "akal", romanized: "akal" },
      ],
      warnings: [],
      versions: {
        engine: "any-ascii-0.3.2",
        dictionary: "any-ascii-cldr",
        romanizationPolicy: "universal-ascii-v1",
        spacingPolicy: "passthrough-v1",
      },
    };

    const success = annotationRenderer.apply(targetText, result, state);
    expect(success).toBe(true);
    expect(state.status).toBe("rendered");

    const rubies = p?.querySelectorAll("ruby");
    expect(rubies?.length).toBe(3);

    const rts = p?.querySelectorAll("rt");
    expect(rts?.length).toBe(3);
    expect(rts?.[0]?.textContent).toBe("sat");
    expect(rts?.[1]?.textContent).toBe("sri");
    expect(rts?.[2]?.textContent).toBe("akal");
  });
});



