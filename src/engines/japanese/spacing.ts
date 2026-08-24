import type { JapaneseToken } from "./ipadic-schema";

export const JAPANESE_SPACING_POLICY_VERSION = "japanese-spacing-v1";

const ASCII_OR_NUMBER_PATTERN = /^[\p{ASCII}\p{Number}]+$/u;
const WHITESPACE_PATTERN = /^\s+$/u;

function isPunctuation(token: JapaneseToken): boolean {
  return token.partOfSpeech === "記号";
}

function attachesToPrevious(token: JapaneseToken): boolean {
  return (
    token.partOfSpeech === "助動詞" ||
    (token.partOfSpeech === "動詞" &&
      token.partOfSpeechSubcategory1 === "非自立") ||
    token.partOfSpeechSubcategory1 === "接尾"
  );
}

function keepsSourceBoundary(token: JapaneseToken): boolean {
  return ASCII_OR_NUMBER_PATTERN.test(token.source);
}

export function formatJapaneseTokens(
  source: string,
  tokens: readonly JapaneseToken[],
): string {
  let rendered = "";
  let previous: JapaneseToken | undefined;
  let sourceCursor = 0;

  for (const token of tokens) {
    const sourceGap = source.slice(sourceCursor, token.start);
    if (sourceGap.length > 0) {
      rendered += sourceGap;
    }

    const output = token.romanized ?? token.source;
    const shouldInsertSpace =
      sourceGap.length === 0 &&
      rendered.length > 0 &&
      previous !== undefined &&
      !WHITESPACE_PATTERN.test(token.source) &&
      !isPunctuation(token) &&
      !isPunctuation(previous) &&
      !attachesToPrevious(token) &&
      !keepsSourceBoundary(token) &&
      !keepsSourceBoundary(previous);

    if (shouldInsertSpace) {
      rendered += " ";
    }
    rendered += output;
    sourceCursor = token.end;
    previous = token;
  }

  return rendered + source.slice(sourceCursor);
}
