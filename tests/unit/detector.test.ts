import { describe, expect, it } from "vitest";
import { analyzeJapaneseScripts } from "../../src/detector/scripts";
import {
  hasJapaneseLanguageEvidence,
  inheritedLanguage,
} from "../../src/detector/language-evidence";

describe("Japanese script and language evidence", () => {
  it("separates Kana evidence from ambiguous Han", () => {
    expect(analyzeJapaneseScripts("愛してる")).toEqual({
      hasKana: true,
      hasHan: true,
      hasJapaneseScript: true,
    });
    expect(analyzeJapaneseScripts("東京")).toEqual({
      hasKana: false,
      hasHan: true,
      hasJapaneseScript: true,
    });
    expect(analyzeJapaneseScripts("hello 123 🎵").hasJapaneseScript).toBe(
      false,
    );
  });

  it("accepts Kana directly and requires Japanese language context for Han-only text", () => {
    document.body.innerHTML = `
      <main lang="ja-JP"><p id="ja">東京</p></main>
      <p id="unknown">東京</p>
    `;
    const ja = document.querySelector("#ja");
    const unknown = document.querySelector("#unknown");
    expect(inheritedLanguage(ja)).toBe("ja-jp");
    expect(hasJapaneseLanguageEvidence("東京", ja)).toBe(true);
    expect(hasJapaneseLanguageEvidence("東京", unknown)).toBe(false);
    expect(hasJapaneseLanguageEvidence("愛してる", unknown)).toBe(true);
  });
});
