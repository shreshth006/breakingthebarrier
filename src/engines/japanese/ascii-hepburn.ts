import { ROMANIZATIONS, VERSION as WANAKANA_VERSION, toRomaji } from "wanakana";

export const ASCII_HEPBURN_POLICY_VERSION = "ascii-hepburn-v1";
export { WANAKANA_VERSION };

export function romanizeKana(source: string): string {
  return toRomaji(source, {
    romanization: ROMANIZATIONS.HEPBURN,
    convertLongVowelMark: true,
    upcaseKatakana: false,
  });
}
