import { describe, expect, it } from "vitest";
import {
  assertIpadicSchema,
  createUtf8ByteToUtf16Map,
  IPADIC_SCHEMA_FIELDS,
  mapIpadicTokens,
} from "../../src/engines/japanese/ipadic-schema";
import type { LinderaTokenData } from "../../src/engines/japanese/ipadic-schema";

function token(
  surface: string,
  byteStart: number,
  byteEnd: number,
  details: readonly string[],
  isUnknown = false,
): LinderaTokenData {
  return {
    surface,
    byteStart,
    byteEnd,
    position: 0,
    wordId: 1,
    isUnknown,
    details,
  };
}

describe("pinned IPADIC schema adapter", () => {
  it("accepts only the exact version-2 field order", () => {
    expect(() => assertIpadicSchema(IPADIC_SCHEMA_FIELDS)).not.toThrow();
    expect(() =>
      assertIpadicSchema([...IPADIC_SCHEMA_FIELDS].reverse()),
    ).toThrow(/schema/u);
  });

  it("maps UTF-8 byte boundaries to JavaScript UTF-16 offsets", () => {
    const source = "A𠮷東京";
    expect([...createUtf8ByteToUtf16Map(source)]).toEqual([
      [0, 0],
      [1, 1],
      [5, 3],
      [8, 4],
      [11, 5],
    ]);

    const mapped = mapIpadicTokens(source, [
      token("𠮷", 1, 5, ["記号", "一般"], true),
      token("東京", 5, 11, [
        "名詞",
        "固有名詞",
        "地域",
        "一般",
        "*",
        "*",
        "東京",
        "トウキョウ",
        "トーキョー",
      ]),
    ]);

    expect(mapped.map(({ start, end, source: value }) => ({ start, end, value }))).toEqual([
      { start: 1, end: 3, value: "𠮷" },
      { start: 3, end: 5, value: "東京" },
    ]);
  });

  it("uses orthographic reading except reliable particle pronunciation", () => {
    const mapped = mapIpadicTokens("東京は", [
      token("東京", 0, 6, [
        "名詞",
        "固有名詞",
        "地域",
        "一般",
        "*",
        "*",
        "東京",
        "トウキョウ",
        "トーキョー",
      ]),
      token("は", 6, 9, [
        "助詞",
        "係助詞",
        "*",
        "*",
        "*",
        "*",
        "は",
        "ハ",
        "ワ",
      ]),
    ]);

    expect(mapped.map((entry) => entry.romanized)).toEqual(["toukyou", "wa"]);
  });
});
