import { ROMANIZATIONS, VERSION as WANAKANA_VERSION, toRomaji } from "wanakana";

export const ASCII_HEPBURN_POLICY_VERSION = "ascii-hepburn-v1";
export { WANAKANA_VERSION };

/**
 * WanaKana intentionally follows its historical Hepburn table for extended
 * Katakana, which yields forms such as `fua` and `fyi`.  Breaking the Barrier's
 * product policy uses the familiar compact loanword spellings instead.  Keep
 * this table narrow and source-based so ordinary Kana sequences such as ふあ
 * are not rewritten accidentally.
 */
const EXTENDED_KATAKANA = [
  ["ファー", "faa"],
  ["フィー", "fii"],
  ["フェー", "fee"],
  ["フォー", "foo"],
  ["ウィー", "wii"],
  ["ウェー", "wee"],
  ["ウォー", "woo"],
  ["ティー", "tii"],
  ["ディー", "dii"],
  ["ファ", "fa"],
  ["フィ", "fi"],
  ["フェ", "fe"],
  ["フォ", "fo"],
  ["ウィ", "wi"],
  ["ウェ", "we"],
  ["ウォ", "wo"],
  ["ティ", "ti"],
  ["ディ", "di"],
] as const;

const EXTENDED_KATAKANA_PATTERN = new RegExp(
  EXTENDED_KATAKANA.map(([source]) => source).join("|"),
  "gu",
);

export function romanizeKana(source: string): string {
  const options = {
    romanization: ROMANIZATIONS.HEPBURN,
    convertLongVowelMark: true,
    upcaseKatakana: false,
  } as const;
  const policy = new Map<string, string>(EXTENDED_KATAKANA);
  let output = "";
  let cursor = 0;
  for (const match of source.matchAll(EXTENDED_KATAKANA_PATTERN)) {
    const start = match.index;
    const value = match[0];
    output += toRomaji(source.slice(cursor, start), options);
    output += policy.get(value) ?? toRomaji(value, options);
    cursor = start + value.length;
  }
  return output + toRomaji(source.slice(cursor), options);
}
