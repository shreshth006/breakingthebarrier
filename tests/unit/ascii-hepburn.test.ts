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
});
