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
import type { LinderaTokenData } from "./ipadic-schema";
import {
  formatJapaneseTokens,
  JAPANESE_SPACING_POLICY_VERSION,
} from "./spacing";

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

    const tokens = mapIpadicTokens(
      request.source,
      this.tokenizer.tokenize(request.source),
    );
    const hasUnknownHan = tokens.some(
      (token) => token.reading === null && /\p{Script=Han}/u.test(token.source),
    );

    return {
      itemId: request.itemId,
      source: request.source,
      rendered: formatJapaneseTokens(request.source, tokens),
      segments: tokens.map(
        ({ start, end, source, reading, romanized }) => ({
          start,
          end,
          source,
          reading,
          romanized,
        }),
      ),
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
