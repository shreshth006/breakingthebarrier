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
  readonly gate: "kana-adapter" | "dictionary-required" | "quality-review";
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
    const metadataHandle = dictionary.metadata;
    try {
      const schemaHandle = metadataHandle.dictionary_schema;
      try {
        assertIpadicSchema(schemaHandle.get_all_fields());
      } finally {
        schemaHandle.free();
      }
    } finally {
      metadataHandle.free();
    }

    const builder = new TokenizerBuilder();
    builder.setDictionaryInstance(dictionary);
    builder.setMode("normal");
    builder.setKeepWhitespace(true);
    const tokenizer = builder.build();
    const adapter = new JapaneseLinderaAdapter(
      {
        tokenize(source: string): readonly LinderaTokenData[] {
          return tokenizer.tokenize(source).map((token) => {
            try {
              const value: unknown = token.toJSON();
              return value as LinderaTokenData;
            } finally {
              token.free();
            }
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

  it("keeps numeric context and protects uncertain compounds", async () => {
    const files = await readVerifiedIpadicArchive();
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
    const builder = new TokenizerBuilder();
    builder.setDictionaryInstance(dictionary);
    builder.setMode("normal");
    builder.setKeepWhitespace(true);
    const tokenizer = builder.build();
    const adapter = new JapaneseLinderaAdapter(
      {
        tokenize(source: string): readonly LinderaTokenData[] {
          return tokenizer.tokenize(source).map((token) => {
            try {
              const value: unknown = token.toJSON();
              return value as LinderaTokenData;
            } finally {
              token.free();
            }
          });
        },
      },
      version(),
    );
    const sources = [
      "1928年",
      "2024年",
      "2月29日",
      "490人",
      "12名",
      "24時間",
      "第1回",
      "ファーストライト",
      "フィクション",
      "インフォメーション",
      "ウィキペディア",
      "巨椋池",
      "諏訪頼嗣",
    ] as const;
    const results = await adapter.transliterate(
      sources.map((source) => ({
        itemId: source,
        source,
        language: "ja" as const,
        romanizationPolicy: "ascii-hepburn-v1",
      })),
    );
    expect(results.map((result) => result.rendered)).toEqual([
      "1928 nen",
      "2024 nen",
      "2 gatsu 29 nichi",
      "490 nin",
      "12 mei",
      "24 jikan",
      "dai 1 kai",
      "faasuto raito",
      "fikushon",
      "infomeeshon",
      "wikipedia",
      "巨椋池",
      "諏訪頼嗣",
    ]);
    expect(results.at(-2)?.warnings).toEqual(["unknown-reading"]);
    expect(results.at(-1)?.warnings).toEqual(["unknown-reading"]);
  });
});
