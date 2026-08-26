import type {
  TransliterationEngine,
  TransliterationRequest,
  TransliterationResult,
} from "../contracts";
import { ASCII_HEPBURN_POLICY_VERSION } from "./ascii-hepburn";
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
] as const;

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

    for (const run of runs) {
      if (run.start > sourceCursor) {
        const preserved = request.source.slice(sourceCursor, run.start);
        renderedParts.push(preserved);
        segments.push({
          start: sourceCursor,
          end: run.start,
          source: preserved,
          reading: null,
          romanized: null,
        });
      }
      const tokens = protectUnknownHanCompounds(mapIpadicTokens(
        run.source,
        this.tokenizer.tokenize(run.source),
      ));
      renderedParts.push(formatJapaneseTokens(run.source, tokens));
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
      renderedParts.push(preserved);
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
