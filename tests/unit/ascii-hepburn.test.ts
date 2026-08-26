import { describe, expect, it } from "vitest";
import {
  ASCII_HEPBURN_POLICY_VERSION,
  WANAKANA_VERSION,
  romanizeKana,
} from "../../src/engines/japanese/ascii-hepburn";

describe("ASCII Hepburn adapter", () => {
  it("uses pinned, versioned policy metadata", () => {
    expect(ASCII_HEPBURN_POLICY_VERSION).toBe("ascii-hepburn-v1");
    expect(WANAKANA_VERSION).toBe("5.3.1");
  });

  it.each([
    ["とうきょう", "toukyou"],
    ["あいしてる", "aishiteru"],
    ["きっぷ", "kippu"],
  ])("romanizes deterministic Kana %s", (source, expected) => {
    expect(romanizeKana(source)).toBe(expected);
  });

  it.each([
    ["ファ", "fa"],
    ["フィ", "fi"],
    ["フェ", "fe"],
    ["フォ", "fo"],
    ["ウィ", "wi"],
    ["ウェ", "we"],
    ["ウォ", "wo"],
    ["ティ", "ti"],
    ["ディ", "di"],
    ["ファーストライト", "faasutoraito"],
    ["フィクション", "fikushon"],
    ["インフォメーション", "infomeeshon"],
    ["ウィキペディア", "wikipedia"],
  ])("applies the product extended-Katakana policy for %s", (source, expected) => {
    expect(romanizeKana(source)).toBe(expected);
  });

  it("does not rewrite ordinary adjacent Kana as a loanword digraph", () => {
    expect(romanizeKana("ふあ")).toBe("fua");
  });
});
