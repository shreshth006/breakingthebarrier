import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { romanizeKana } from "../../src/engines/japanese/ascii-hepburn";

interface GoldenEntry {
  readonly source: string;
  readonly expected: string;
  readonly category: string;
  readonly gate: "kana-adapter" | "dictionary-required" | "quality-review";
  readonly rationale: string;
}

async function readCorpus(): Promise<readonly GoldenEntry[]> {
  const corpusPath = resolve(
    process.cwd(),
    "tests/corpus/japanese/golden.json",
  );
  const value: unknown = JSON.parse(await readFile(corpusPath, "utf8"));

  if (!Array.isArray(value)) {
    throw new Error("Golden Japanese corpus must be an array");
  }

  return value.map((entry: unknown) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("source" in entry) ||
      !("expected" in entry) ||
      !("category" in entry) ||
      !("gate" in entry) ||
      !("rationale" in entry) ||
      typeof entry.source !== "string" ||
      typeof entry.expected !== "string" ||
      typeof entry.category !== "string" ||
      (entry.gate !== "kana-adapter" &&
        entry.gate !== "dictionary-required" &&
        entry.gate !== "quality-review") ||
      typeof entry.rationale !== "string"
    ) {
      throw new Error("Golden Japanese corpus entry is invalid");
    }

    return {
      source: entry.source,
      expected: entry.expected,
      category: entry.category,
      gate: entry.gate,
      rationale: entry.rationale,
    };
  });
}

describe("golden Japanese corpus", () => {
  it("contains the required authoritative examples without duplicates", async () => {
    const corpus = await readCorpus();
    const sources = corpus.map((entry) => entry.source);

    expect(new Set(sources).size).toBe(sources.length);
    expect(sources).toEqual(
      expect.arrayContaining(["星座になれたら", "愛してる", "東京", "龘"]),
    );
    expect(corpus.every((entry) => entry.rationale.length > 0)).toBe(true);
  });

  it("executes entries supported by the Kana-only adapter", async () => {
    const corpus = await readCorpus();
    const kanaEntries = corpus.filter((entry) => entry.gate === "kana-adapter");

    expect(kanaEntries.length).toBeGreaterThan(0);
    for (const entry of kanaEntries) {
      expect(romanizeKana(entry.source)).toBe(entry.expected);
    }
  });

  it("keeps proper-name observations in a separate quality-review gate", async () => {
    const corpus = await readCorpus();
    const qualityEntries = corpus.filter((entry) => entry.gate === "quality-review");
    expect(qualityEntries).toHaveLength(4);
    expect(qualityEntries.every((entry) => entry.category === "proper-noun-quality")).toBe(true);
  });
});
