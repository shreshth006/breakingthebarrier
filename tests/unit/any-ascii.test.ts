import { describe, expect, it } from "vitest";
import { AnyAsciiAdapter } from "../../src/engines/universal/any-ascii-adapter";

describe("AnyAsciiAdapter universal transliteration", () => {
  const adapter = new AnyAsciiAdapter();

  it("transliterates Korean text into Romaja tokens", async () => {
    const results = await adapter.transliterate([
      {
        itemId: "1",
        source: "안녕하세요",
        language: "universal",
        romanizationPolicy: "universal-ascii-v1",
      },
    ]);

    expect(results[0]?.rendered).toBe("AnNyeongHaSeYo");
    expect(results[0]?.segments).toHaveLength(1);
    expect(results[0]?.segments[0]?.source).toBe("안녕하세요");
    expect(results[0]?.segments[0]?.romanized).toBe("AnNyeongHaSeYo");
  });

  it("transliterates Russian (Cyrillic) text", async () => {
    const results = await adapter.transliterate([
      {
        itemId: "2",
        source: "Привет мир",
        language: "universal",
        romanizationPolicy: "universal-ascii-v1",
      },
    ]);

    expect(results[0]?.rendered).toBe("Privet mir");
    expect(results[0]?.segments).toHaveLength(3); // Word, space, word
  });

  it("transliterates Hindi (Devanagari) text", async () => {
    const results = await adapter.transliterate([
      {
        itemId: "3",
        source: "नमस्ते",
        language: "universal",
        romanizationPolicy: "universal-ascii-v1",
      },
    ]);

    expect(results[0]?.rendered).toBe("nmste");
  });

  it("transliterates Punjabi (Gurmukhi) text", async () => {
    const results = await adapter.transliterate([
      {
        itemId: "4",
        source: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ",
        language: "universal",
        romanizationPolicy: "universal-ascii-v1",
      },
    ]);

    expect(results[0]?.rendered).toBe("sti sri akal");
  });

  it("transliterates Urdu (Arabic) text", async () => {
    const results = await adapter.transliterate([
      {
        itemId: "5",
        source: "سلام",
        language: "universal",
        romanizationPolicy: "universal-ascii-v1",
      },
    ]);

    expect(results[0]?.rendered).toBe("slm");
  });

  it("transliterates Greek text", async () => {
    const results = await adapter.transliterate([
      {
        itemId: "6",
        source: "Ελλάδα",
        language: "universal",
        romanizationPolicy: "universal-ascii-v1",
      },
    ]);

    expect(results[0]?.rendered).toBe("Ellada");
  });
});
