import { describe, expect, it } from "vitest";
import { JapaneseLinderaAdapter } from "../../src/engines/japanese/lindera-adapter";
import type { LinderaTokenData } from "../../src/engines/japanese/ipadic-schema";

const details = {
  seiza: ["名詞", "一般", "*", "*", "*", "*", "星座", "セイザ", "セイザ"],
  ni: ["助詞", "格助詞", "一般", "*", "*", "*", "に", "ニ", "ニ"],
  nare: ["動詞", "自立", "*", "*", "一段", "連用形", "なれる", "ナレ", "ナレ"],
  tara: ["助動詞", "*", "*", "*", "特殊・タ", "仮定形", "た", "タラ", "タラ"],
} as const;

function token(
  surface: string,
  byteStart: number,
  byteEnd: number,
  tokenDetails: readonly string[],
  isUnknown = false,
): LinderaTokenData {
  return {
    surface,
    byteStart,
    byteEnd,
    position: 0,
    wordId: 1,
    isUnknown,
    details: tokenDetails,
  };
}

describe("Japanese Lindera adapter", () => {
  it("applies the versioned spacing policy and returns aligned segments", async () => {
    const adapter = new JapaneseLinderaAdapter(
      {
        tokenize: () => [
          token("星座", 0, 6, details.seiza),
          token("に", 6, 9, details.ni),
          token("なれ", 9, 15, details.nare),
          token("たら", 15, 21, details.tara),
        ],
      },
      "5.3.0",
    );

    const [result] = await adapter.transliterate([
      {
        itemId: "title",
        source: "星座になれたら",
        language: "ja",
        romanizationPolicy: "ascii-hepburn-v1",
      },
    ]);

    expect(result?.rendered).toBe("seiza ni naretara");
    expect(result?.segments).toEqual([
      { start: 0, end: 2, source: "星座", reading: "セイザ", romanized: "seiza" },
      { start: 2, end: 3, source: "に", reading: "ニ", romanized: "ni" },
      { start: 3, end: 5, source: "なれ", reading: "ナレ", romanized: "nare" },
      { start: 5, end: 7, source: "たら", reading: "タラ", romanized: "tara" },
    ]);
  });

  it("preserves unknown Han and emits an internal warning", async () => {
    const adapter = new JapaneseLinderaAdapter(
      {
        tokenize: () => [
          token(
            "龘",
            0,
            3,
            ["名詞", "固有名詞", "組織", "*", "*", "*", "*", "*", "*"],
            true,
          ),
        ],
      },
      "5.3.0",
    );

    const [result] = await adapter.transliterate([
      {
        itemId: "unknown",
        source: "龘",
        language: "ja",
        romanizationPolicy: "ascii-hepburn-v1",
      },
    ]);

    expect(result?.rendered).toBe("龘");
    expect(result?.warnings).toEqual(["unknown-reading"]);
    expect(result?.segments[0]?.reading).toBeNull();
  });
});
