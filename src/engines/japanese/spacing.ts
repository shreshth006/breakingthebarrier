import type { JapaneseToken } from "./ipadic-schema";

export const JAPANESE_SPACING_POLICY_VERSION = "japanese-spacing-v1";

const ASCII_OR_NUMBER_PATTERN = /^[\p{ASCII}\p{Number}]+$/u;
const WHITESPACE_PATTERN = /^\s+$/u;
const NUMBER_TOKEN_PATTERN = /^\p{Number}+$/u;

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

function isNumberToken(token: JapaneseToken): boolean {
  return (
    NUMBER_TOKEN_PATTERN.test(token.source) ||
    (token.partOfSpeech === "名詞" && token.partOfSpeechSubcategory1 === "数")
  );
}

function isCounterToken(token: JapaneseToken): boolean {
  return (
    (token.partOfSpeechSubcategory1 === "接尾" &&
      token.partOfSpeechSubcategory2 === "助数詞") ||
    token.source === "月"
  );
}

function numericContextBoundary(
  token: JapaneseToken,
  previous: JapaneseToken,
  next: JapaneseToken | undefined,
): boolean {
  return (
    (isNumberToken(token) && next !== undefined && isCounterToken(next)) ||
    (isNumberToken(previous) && isCounterToken(token))
  );
}

export function formatJapaneseTokens(
  source: string,
  tokens: readonly JapaneseToken[],
): string {
  let rendered = "";
  let previous: JapaneseToken | undefined;
  let sourceCursor = 0;

  for (const [index, token] of tokens.entries()) {
    const sourceGap = source.slice(sourceCursor, token.start);
    if (sourceGap.length > 0) {
      rendered += sourceGap;
    }

    const output = token.romanized ?? token.source;
    const protectedCompoundBoundary =
      previous?.isUnknownCompound === true && token.isUnknownCompound;
    const numericBoundary =
      previous !== undefined &&
      numericContextBoundary(token, previous, tokens[index + 1]);
    const shouldInsertSpace =
      sourceGap.length === 0 &&
      rendered.length > 0 &&
      previous !== undefined &&
      !WHITESPACE_PATTERN.test(token.source) &&
      !isPunctuation(token) &&
      !isPunctuation(previous) &&
      !protectedCompoundBoundary &&
      (numericBoundary || !attachesToPrevious(token)) &&
      (numericBoundary || !keepsSourceBoundary(token)) &&
      (numericBoundary || !keepsSourceBoundary(previous));

    if (shouldInsertSpace) {
      rendered += " ";
    }
    rendered += output;
    sourceCursor = token.end;
    previous = token;
  }

  return rendered + source.slice(sourceCursor);
}
