import {
  ASCII_HEPBURN_POLICY_VERSION,
  WANAKANA_VERSION,
} from "../engines/japanese/ascii-hepburn";
import {
  JAPANESE_ENGINE_SELF_TESTS,
  JapaneseLinderaAdapter,
} from "../engines/japanese/lindera-adapter";
import type { LinderaTokenData } from "../engines/japanese/ipadic-schema";
import {
  assertIpadicSchema,
  IPADIC_DICTIONARY_VERSION,
} from "../engines/japanese/ipadic-schema";
import { JAPANESE_SPACING_POLICY_VERSION } from "../engines/japanese/spacing";
import {
  createJapaneseWorkerProbeFailure,
  createJapaneseWorkerProbeResponse,
  isJapaneseWorkerProbeRequest,
} from "../shared/worker-messages";
import type { JapaneseWorkerProbeFailure } from "../shared/worker-messages";

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
const workerStartedAt = performance.now();
const DICTIONARY_FILE_NAMES = [
  "metadata.json",
  "dict.trie",
  "dict.valsidx",
  "dict.vals",
  "dict.wordsidx",
  "dict.words",
  "matrix.mtx",
  "char_def.bin",
  "unk.bin",
] as const;

type EngineLoadFailureReason = JapaneseWorkerProbeFailure["reason"];

class EngineLoadError extends Error {
  constructor(readonly reason: EngineLoadFailureReason) {
    super(`Japanese engine load failed: ${reason}`);
    this.name = "EngineLoadError";
  }
}

interface LoadedJapaneseEngine {
  readonly adapter: JapaneseLinderaAdapter;
  readonly linderaVersion: string;
  readonly measurements: {
    readonly coldReadyMs: number;
    readonly warmBatchItems: 100;
    readonly warmBatchMs: number;
  };
}

let enginePromise: Promise<LoadedJapaneseEngine> | undefined;

function classifyEngineLoadFailure(error: unknown): EngineLoadFailureReason {
  if (error instanceof EngineLoadError) {
    return error.reason;
  }
  if (error instanceof WebAssembly.CompileError) {
    return "wasm-compile";
  }
  if (error instanceof WebAssembly.LinkError) {
    return "wasm-link";
  }
  if (error instanceof WebAssembly.RuntimeError) {
    return "wasm-runtime";
  }
  if (
    error instanceof TypeError &&
    /(?:fetch|import|module)/iu.test(error.message)
  ) {
    return "engine-module";
  }
  return "engine-load";
}

async function fetchDictionaryFile(name: string): Promise<Uint8Array> {
  const baseUrl = new URL(
    "./dictionaries/ipadic-5.3.0/",
    workerScope.location.href,
  );
  const response = await fetch(new URL(name, baseUrl));
  if (!response.ok) {
    throw new EngineLoadError("dictionary-fetch");
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function createJapaneseEngine(): Promise<LoadedJapaneseEngine> {
  const [lindera, files] = await Promise.all([
    import("lindera-wasm-bundler"),
    Promise.all(DICTIONARY_FILE_NAMES.map(fetchDictionaryFile)),
  ]);

  const [
    metadata,
    dictTrie,
    dictValsIndex,
    dictVals,
    dictWordsIndex,
    dictWords,
    matrix,
    characterDefinitions,
    unknownWords,
  ] = files;
  if (
    metadata === undefined ||
    dictTrie === undefined ||
    dictValsIndex === undefined ||
    dictVals === undefined ||
    dictWordsIndex === undefined ||
    dictWords === undefined ||
    matrix === undefined ||
    characterDefinitions === undefined ||
    unknownWords === undefined
  ) {
    throw new EngineLoadError("dictionary-fetch");
  }

  const dictionary = lindera.loadDictionaryFromBytes(
    metadata,
    dictTrie,
    dictValsIndex,
    dictVals,
    dictWordsIndex,
    dictWords,
    matrix,
    characterDefinitions,
    unknownWords,
  );

  try {
    assertIpadicSchema(
      dictionary.metadata.dictionary_schema.get_all_fields(),
    );
  } catch {
    throw new EngineLoadError("dictionary-schema");
  }

  const builder = new lindera.TokenizerBuilder();
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
    lindera.version(),
  );

  const results = await adapter.transliterate(
    JAPANESE_ENGINE_SELF_TESTS.map(({ source }, index) => ({
      itemId: `self-test-${String(index)}`,
      source,
      language: "ja",
      romanizationPolicy: ASCII_HEPBURN_POLICY_VERSION,
    })),
  );
  if (
    results.some(
      (result, index) =>
        result.rendered !== JAPANESE_ENGINE_SELF_TESTS[index]?.expected,
    )
  ) {
    throw new EngineLoadError("self-test");
  }

  const warmBatchStartedAt = performance.now();
  const warmResults = await adapter.transliterate(
    Array.from({ length: 100 }, (_, index) => ({
      itemId: `warm-${String(index)}`,
      source: JAPANESE_ENGINE_SELF_TESTS[index % JAPANESE_ENGINE_SELF_TESTS.length]?.source ?? "東京",
      language: "ja",
      romanizationPolicy: ASCII_HEPBURN_POLICY_VERSION,
    })),
  );
  if (warmResults.length !== 100) {
    throw new EngineLoadError("self-test");
  }
  const warmBatchMs = performance.now() - warmBatchStartedAt;

  return {
    adapter,
    linderaVersion: lindera.version(),
    measurements: {
      coldReadyMs: Number((performance.now() - workerStartedAt).toFixed(2)),
      warmBatchItems: 100,
      warmBatchMs: Number(warmBatchMs.toFixed(2)),
    },
  };
}

function getJapaneseEngine(): Promise<LoadedJapaneseEngine> {
  enginePromise ??= createJapaneseEngine().catch((error: unknown) => {
    enginePromise = undefined;
    throw error;
  });
  return enginePromise;
}

workerScope.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (!isJapaneseWorkerProbeRequest(event.data)) {
    return;
  }
  const request = event.data;

  void getJapaneseEngine()
    .then(({ linderaVersion, measurements }) => {
      workerScope.postMessage(
        createJapaneseWorkerProbeResponse(request.requestId, {
          status: "ready",
          capabilities: [
            "lindera-wasm",
            "ipadic-tokenizer",
            "kana-romanizer",
          ],
          versions: {
            lindera: linderaVersion,
            wanakana: WANAKANA_VERSION,
            dictionary: IPADIC_DICTIONARY_VERSION,
            romanizationPolicy: ASCII_HEPBURN_POLICY_VERSION,
            spacingPolicy: JAPANESE_SPACING_POLICY_VERSION,
          },
          measurements,
          selfTestPassed: true,
        }),
      );
    })
    .catch((error: unknown) => {
      workerScope.postMessage(
        createJapaneseWorkerProbeFailure(
          request.requestId,
          classifyEngineLoadFailure(error),
        ),
      );
    });
});
