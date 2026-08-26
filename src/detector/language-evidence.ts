import { analyzeJapaneseScripts } from "./scripts";

function normalizeLanguage(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized === undefined || normalized.length === 0 ? null : normalized;
}

export function inheritedLanguage(element: Element | null): string | null {
  for (let current = element; current !== null; current = current.parentElement) {
    const language = normalizeLanguage(current.getAttribute("lang"));
    if (language !== null) {
      return language;
    }
  }
  return normalizeLanguage(element?.ownerDocument.documentElement.lang ?? null);
}

export function hasJapaneseLanguageEvidence(
  source: string,
  element: Element | null,
): boolean {
  const scripts = analyzeJapaneseScripts(source);
  if (scripts.hasKana) {
    return true;
  }
  if (!scripts.hasHan) {
    return false;
  }
  const language = inheritedLanguage(element);
  return language === "ja" || language?.startsWith("ja-") === true;
}
