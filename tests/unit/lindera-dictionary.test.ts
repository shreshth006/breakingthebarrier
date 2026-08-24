// @vitest-environment node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TokenizerBuilder,
  loadDictionaryFromBytes,
  version,
} from "lindera-wasm-bundler";
import { JapaneseLinderaAdapter } from "../../src/engines/japanese/lindera-adapter";
import type { LinderaTokenData } from "../../src/engines/japanese/ipadic-schema";
import {
  assertIpadicSchema,
  IPADIC_DICTIONARY_VERSION,
} from "../../src/engines/japanese/ipadic-schema";
import {
  IPADIC_RUNTIME_FILES,
  readVerifiedIpadicArchive,
} from "../../scripts/ipadic-archive.mjs";

interface GoldenEntry {
  readonly source: string;
  readonly expected: string;
  readonly gate: "kana-adapter" | "dictionary-required";
}

function requireFile(files: ReadonlyMap<string, Buffer>, name: string): Buffer {
  const value = files.get(name);
  if (value === undefined) {
    throw new Error(`Verified dictionary file is unavailable: ${name}`);
  }
  return value;
}

describe("official Lindera IPADIC archive", () => {
  it("executes every dictionary-backed golden entry with aligned results", async () => {
    const files = await readVerifiedIpadicArchive();
    expect([...files.keys()]).toEqual(
      expect.arrayContaining([...IPADIC_RUNTIME_FILES, "NOTICE.txt"]),
    );

    const dictionary = loadDictionaryFromBytes(
      requireFile(files, "metadata.json"),
      requireFile(files, "dict.trie"),
      requireFile(files, "dict.valsidx"),
      requireFile(files, "dict.vals"),
      requireFile(files, "dict.wordsidx"),
      requireFile(files, "dict.words"),
      requireFile(files, "matrix.mtx"),
      requireFile(files, "char_def.bin"),
      requireFile(files, "unk.bin"),
    );
    assertIpadicSchema(dictionary.metadata.dictionary_schema.get_all_fields());

    const builder = new TokenizerBuilder();
    builder.setDictionaryInstance(dictionary);
    builder.setMode("normal");
    builder.setKeepWhitespace(true);
    const tokenizer = builder.build();
    const adapter = new JapaneseLinderaAdapter(
      {
        tokenize(source: string): readonly LinderaTokenData[] {
          return tokenizer.tokenize(source).map((token) => {
            const value: unknown = token.toJSON();
            return value as LinderaTokenData;
          });
        },
      },
      version(),
    );

    const corpusPath = resolve(
      process.cwd(),
      "tests/corpus/japanese/golden.json",
    );
    const corpus = JSON.parse(
      await readFile(corpusPath, "utf8"),
    ) as readonly GoldenEntry[];
    const entries = corpus.filter(
      (entry) => entry.gate === "dictionary-required",
    );
    const results = await adapter.transliterate(
      entries.map((entry, index) => ({
        itemId: `golden-${String(index)}`,
        source: entry.source,
        language: "ja",
        romanizationPolicy: "ascii-hepburn-v1",
      })),
    );

    expect(version()).toBe(IPADIC_DICTIONARY_VERSION);
    expect(results.map((result) => result.rendered)).toEqual(
      entries.map((entry) => entry.expected),
    );
    expect(
      results.every((result) =>
        result.segments.every(
          (segment) =>
            result.source.slice(segment.start, segment.end) === segment.source,
        ),
      ),
    ).toBe(true);
  });
});
