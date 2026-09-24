import anyAsciiModule from "any-ascii";
import type {
  SourceAlignedSegment,
  TransliterationEngine,
  TransliterationRequest,
  TransliterationResult,
} from "../contracts";

function toAscii(input: string): string {
  const fn =
    typeof anyAsciiModule === "function"
      ? anyAsciiModule
      : (anyAsciiModule as unknown as { default?: (s: string) => string }).default;
  if (typeof fn === "function") {
    return fn(input);
  }
  return input;
}

export class AnyAsciiAdapter implements TransliterationEngine {
  readonly language = "universal";

  async transliterate(
    requests: readonly TransliterationRequest[],
  ): Promise<readonly TransliterationResult[]> {
    return Promise.resolve(requests.map((request) => this.transliterateOne(request)));
  }

  private transliterateOne(
    request: TransliterationRequest,
  ): TransliterationResult {
    const text = request.source;
    const segments: SourceAlignedSegment[] = [];

    // Regex to capture words (letters/marks) vs non-word delimiters
    const wordPattern = /[\p{L}\p{M}\p{N}]+/gu;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = wordPattern.exec(text)) !== null) {
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;

      // Add preceding non-word text as passthrough segment
      if (matchStart > lastIndex) {
        const passthrough = text.slice(lastIndex, matchStart);
        segments.push({
          start: lastIndex,
          end: matchStart,
          source: passthrough,
          reading: passthrough,
          romanized: passthrough,
        });
      }

      const wordSource = match[0];
      const wordRomanized = toAscii(wordSource);

      segments.push({
        start: matchStart,
        end: matchEnd,
        source: wordSource,
        reading: wordRomanized,
        romanized: wordRomanized,
      });

      lastIndex = matchEnd;
    }

    // Add trailing non-word text
    if (lastIndex < text.length) {
      const passthrough = text.slice(lastIndex);
      segments.push({
        start: lastIndex,
        end: text.length,
        source: passthrough,
        reading: passthrough,
        romanized: passthrough,
      });
    }

    const rendered = segments.map((seg) => seg.romanized).join("");

    return {
      itemId: request.itemId,
      source: request.source,
      rendered,
      segments,
      warnings: [],
      versions: {
        engine: "any-ascii-0.3.2",
        dictionary: "any-ascii-cldr",
        romanizationPolicy: "universal-ascii-v1",
        spacingPolicy: "passthrough-v1",
      },
    };
  }
}
