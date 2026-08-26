import type {
  TransliterationEngine,
  TransliterationRequest,
  TransliterationResult,
} from "../contracts";
import {
  ASCII_HEPBURN_POLICY_VERSION,
  romanizeKana,
} from "./ascii-hepburn";
import {
  IPADIC_DICTIONARY_VERSION,
  mapIpadicTokens,
} from "./ipadic-schema";
import type { JapaneseToken, LinderaTokenData } from "./ipadic-schema";
import {
  formatJapaneseTokens,
  JAPANESE_SPACING_POLICY_VERSION,
} from "./spacing";

const TOKENIZABLE_JAPANESE_RUN =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Number}\u3000-\u303f\u30fc\uff65-\uff9f]+/gu;
const JAPANESE_CORE =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\uff66-\uff9f]/u;
const HAN_ONLY = /^[\p{Script=Han}]+$/u;
const ASCII_LETTER_END = /[A-Za-z]$/u;
const ASCII_LETTER_START = /^[A-Za-z]/u;

function protectUnknownHanCompounds(
  tokens: readonly JapaneseToken[],
): readonly JapaneseToken[] {
  const protectedIndexes = new Set<number>();
  let index = 0;
  while (index < tokens.length) {
    const first = tokens[index];
    if (first === undefined || !HAN_ONLY.test(first.source)) {
      index += 1;
      continue;
    }
    let end = index + 1;
    while (end < tokens.length) {
      const previous = tokens[end - 1];
      const current = tokens[end];
      if (
        current === undefined ||
        previous?.end !== current.start ||
        !HAN_ONLY.test(current.source)
      ) {
        break;
      }
      end += 1;
    }
    const compound = tokens.slice(index, end);
    if (
      compound.some(
        (token) => token.isUnknown || token.reading === null,
      )
    ) {
      for (let compoundIndex = index; compoundIndex < end; compoundIndex += 1) {
        protectedIndexes.add(compoundIndex);
      }
    }
    index = end;
  }
  return tokens.map((token, tokenIndex) =>
    protectedIndexes.has(tokenIndex)
      ? {
          ...token,
          reading: null,
          romanized: null,
          isUnknownCompound: true,
        }
      : token,
  );
}

interface JapaneseRun {
  readonly start: number;
  readonly end: number;
  readonly source: string;
}

export function findTokenizableJapaneseRuns(
  source: string,
): readonly JapaneseRun[] {
  const runs: JapaneseRun[] = [];
  for (const match of source.matchAll(TOKENIZABLE_JAPANESE_RUN)) {
    const value = match[0];
    if (!JAPANESE_CORE.test(value)) {
      continue;
    }
    runs.push({
      start: match.index,
      end: match.index + value.length,
      source: value,
    });
  }
  return runs;
}

export interface LinderaTokenizerAdapter {
  tokenize(source: string): readonly LinderaTokenData[];
}

export const JAPANESE_ENGINE_SELF_TESTS = [
  { source: "星座になれたら", expected: "seiza ni naretara" },
  { source: "愛してる", expected: "aishiteru" },
  { source: "東京", expected: "toukyou" },
  { source: "龘", expected: "龘" },
  { source: "たかせがわ", expected: "takasegawa" },
  { source: "なって", expected: "natte" },
] as const;

function isHiraganaOnlyRun(source: string): boolean {
  return (
    !HAN_ONLY.test(source) &&
    !/[\p{Script=Han}\p{Script=Katakana}\p{Number}]/u.test(source)
  );
}

export class JapaneseLinderaAdapter implements TransliterationEngine {
  readonly language = "ja" as const;

  constructor(
    private readonly tokenizer: LinderaTokenizerAdapter,
    private readonly engineVersion: string,
  ) {}

  transliterate(
    requests: readonly TransliterationRequest[],
  ): Promise<readonly TransliterationResult[]> {
    return Promise.resolve(
      requests.map((request) => this.transliterateOne(request)),
    );
  }

  private transliterateOne(
    request: TransliterationRequest,
  ): TransliterationResult {
    if (
      request.romanizationPolicy !== ASCII_HEPBURN_POLICY_VERSION
    ) {
      throw new Error("Unsupported Japanese transliteration request");
    }

    const runs = findTokenizableJapaneseRuns(request.source);
    const segments: TransliterationResult["segments"][number][] = [];
    const renderedParts: string[] = [];
    let sourceCursor = 0;
    let hasUnknownHan = false;

    const appendPart = (source: string, rendered: string): void => {
      const previousSource = request.source.slice(0, sourceCursor);
      const previousRendered = renderedParts.at(-1) ?? "";
      const followingSource = request.source.slice(sourceCursor + source.length);
      const adjacent = sourceCursor > 0 && source.length > 0;
      const needsLatinBoundary =
        adjacent &&
        !/\s$/u.test(previousSource) &&
        !/^\s/u.test(source) &&
        !/\p{Number}$/u.test(source) &&
        !/^\p{Number}/u.test(followingSource) &&
        ((ASCII_LETTER_END.test(previousRendered) &&
          ASCII_LETTER_START.test(rendered)) ||
          (ASCII_LETTER_END.test(rendered) &&
            ASCII_LETTER_START.test(source)));
      renderedParts.push(needsLatinBoundary ? ` ${rendered}` : rendered);
    };

    for (const run of runs) {
      if (run.start > sourceCursor) {
        const preserved = request.source.slice(sourceCursor, run.start);
        appendPart(preserved, preserved);
        segments.push({
          start: sourceCursor,
          end: run.start,
          source: preserved,
          reading: null,
          romanized: null,
        });
        sourceCursor = run.start;
      }
      if (isHiraganaOnlyRun(run.source)) {
        const romanized = romanizeKana(run.source);
        appendPart(run.source, romanized);
        segments.push({
          start: run.start,
          end: run.end,
          source: run.source,
          reading: run.source,
          romanized,
        });
        sourceCursor = run.end;
        continue;
      }
      const tokens = protectUnknownHanCompounds(
        mapIpadicTokens(run.source, this.tokenizer.tokenize(run.source)),
      );
      appendPart(run.source, formatJapaneseTokens(run.source, tokens));
      for (const token of tokens) {
        if (
          token.reading === null &&
          /\p{Script=Han}/u.test(token.source)
        ) {
          hasUnknownHan = true;
        }
        segments.push({
          start: run.start + token.start,
          end: run.start + token.end,
          source: token.source,
          reading: token.reading,
          romanized: token.romanized,
        });
      }
      sourceCursor = run.end;
    }
    if (sourceCursor < request.source.length) {
      const preserved = request.source.slice(sourceCursor);
      appendPart(preserved, preserved);
      segments.push({
        start: sourceCursor,
        end: request.source.length,
        source: preserved,
        reading: null,
        romanized: null,
      });
    }

    return {
      itemId: request.itemId,
      source: request.source,
      rendered: renderedParts.join(""),
      segments,
      warnings: hasUnknownHan ? ["unknown-reading"] : [],
      versions: {
        engine: this.engineVersion,
        dictionary: IPADIC_DICTIONARY_VERSION,
        romanizationPolicy: ASCII_HEPBURN_POLICY_VERSION,
        spacingPolicy: JAPANESE_SPACING_POLICY_VERSION,
      },
    };
  }
}
