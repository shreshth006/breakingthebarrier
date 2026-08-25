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
import { PROCESSOR_MEMORY_DIAGNOSTIC_STAGE_PAUSE_MS } from "../shared/config";
import type {
  ProcessorMemoryStage,
  ProcessorProbeDetails,
} from "../shared/messages";
import {
  createJapaneseWorkerBatchFailure,
  createJapaneseWorkerBatchResponse,
  createJapaneseWorkerMemoryDiagnosticResponse,
  createJapaneseWorkerMemoryStageEvent,
  createJapaneseWorkerProbeFailure,
  createJapaneseWorkerProbeResponse,
  isJapaneseWorkerBatchRequest,
  isJapaneseWorkerMemoryDiagnosticRequest,
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

type MemoryStageReporter = (stage: ProcessorMemoryStage) => Promise<void>;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, milliseconds);
  });
}

function requireDictionaryFile(
  files: readonly Uint8Array[],
  index: number,
): Uint8Array {
  const file = files[index];
  if (file === undefined) {
    throw new EngineLoadError("dictionary-fetch");
  }
  return file;
}

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

async function createJapaneseEngine(
  reportStage: MemoryStageReporter = () => Promise.resolve(),
): Promise<LoadedJapaneseEngine> {
  await reportStage("worker-created");
  const lindera = await import("lindera-wasm-bundler");
  await reportStage("wasm-initialized");
  const files = await Promise.all(
    DICTIONARY_FILE_NAMES.map(fetchDictionaryFile),
  );
  await reportStage("dictionary-files-fetched");

  const dictionary = lindera.loadDictionaryFromBytes(
    requireDictionaryFile(files, 0),
    requireDictionaryFile(files, 1),
    requireDictionaryFile(files, 2),
    requireDictionaryFile(files, 3),
    requireDictionaryFile(files, 4),
    requireDictionaryFile(files, 5),
    requireDictionaryFile(files, 6),
    requireDictionaryFile(files, 7),
    requireDictionaryFile(files, 8),
  );
  await reportStage("dictionary-constructed");

  const metadataHandle = dictionary.metadata;
  try {
    const schemaHandle = metadataHandle.dictionary_schema;
    try {
      assertIpadicSchema(schemaHandle.get_all_fields());
    } finally {
      schemaHandle.free();
    }
  } catch {
    throw new EngineLoadError("dictionary-schema");
  } finally {
    metadataHandle.free();
  }

  const builder = new lindera.TokenizerBuilder();
  builder.setDictionaryInstance(dictionary);
  builder.setMode("normal");
  builder.setKeepWhitespace(true);
  const tokenizer = builder.build();
  await reportStage("tokenizer-constructed");

  // wasm-bindgen copies each file into WASM memory. Drop the corresponding
  // JavaScript ArrayBuffer references as soon as the tokenizer owns the
  // dictionary so they become eligible for collection before self-tests.
  files.length = 0;
  await reportStage("temporary-buffers-released");

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
  await reportStage("batch-completed");
  await reportStage("stabilized");

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

function getJapaneseEngine(
  reportStage?: MemoryStageReporter,
): Promise<LoadedJapaneseEngine> {
  enginePromise ??= createJapaneseEngine(reportStage).catch((error: unknown) => {
    enginePromise = undefined;
    throw error;
  });
  return enginePromise;
}

function toProbeDetails(engine: LoadedJapaneseEngine): ProcessorProbeDetails {
  return {
    status: "ready",
    capabilities: [
      "lindera-wasm",
      "ipadic-tokenizer",
      "kana-romanizer",
    ],
    versions: {
      lindera: engine.linderaVersion,
      wanakana: WANAKANA_VERSION,
      dictionary: IPADIC_DICTIONARY_VERSION,
      romanizationPolicy: ASCII_HEPBURN_POLICY_VERSION,
      spacingPolicy: JAPANESE_SPACING_POLICY_VERSION,
    },
    measurements: engine.measurements,
    selfTestPassed: true,
  };
}

workerScope.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (isJapaneseWorkerMemoryDiagnosticRequest(event.data)) {
    const request = event.data;
    const reportStage: MemoryStageReporter = async (stage) => {
      workerScope.postMessage(
        createJapaneseWorkerMemoryStageEvent(request.requestId, stage),
      );
      await delay(PROCESSOR_MEMORY_DIAGNOSTIC_STAGE_PAUSE_MS);
    };
    void getJapaneseEngine(reportStage)
      .then((engine) => {
        workerScope.postMessage(
          createJapaneseWorkerMemoryDiagnosticResponse(
            request.requestId,
            toProbeDetails(engine),
          ),
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
    return;
  }

  if (isJapaneseWorkerBatchRequest(event.data)) {
    const request = event.data;
    void getJapaneseEngine()
      .then(({ adapter }) => adapter.transliterate(request.items))
      .then((results) => {
        workerScope.postMessage(
          createJapaneseWorkerBatchResponse(request.requestId, results),
        );
      })
      .catch((error: unknown) => {
        const reason = classifyEngineLoadFailure(error);
        workerScope.postMessage(
          createJapaneseWorkerBatchFailure(
            request.requestId,
            reason === "engine-load" ? "transliteration" : reason,
          ),
        );
      });
    return;
  }

  if (!isJapaneseWorkerProbeRequest(event.data)) {
    return;
  }
  const request = event.data;

  void getJapaneseEngine()
    .then((engine) => {
      workerScope.postMessage(
        createJapaneseWorkerProbeResponse(
          request.requestId,
          toProbeDetails(engine),
        ),
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
