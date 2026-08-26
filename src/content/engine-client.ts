import type { TransliterationResult } from "../engines/contracts";
import {
  CONTENT_FRAME_CACHE_CAPACITY,
  CONTENT_JAPANESE_CACHE_NAMESPACE,
  MAX_TRANSLITERATION_BATCH_ITEMS,
  MAX_TRANSLITERATION_BATCH_UTF16,
} from "../shared/config";
import { LruCache } from "../shared/lru";
import { createTransliterationBatchRequest } from "../shared/messages";
import {
  validateHealthErrorResponse,
  validateTransliterationBatchResponse,
} from "../shared/validation";

export interface FrameEngineClient {
  transliterate(
    sources: readonly string[],
  ): Promise<ReadonlyMap<string, TransliterationResult | null>>;
  clear(): void;
}

interface DeferredResult {
  readonly promise: Promise<TransliterationResult>;
  readonly resolve: (value: TransliterationResult) => void;
  readonly reject: (reason?: unknown) => void;
}

function deferredResult(): DeferredResult {
  let resolvePromise!: (value: TransliterationResult) => void;
  let rejectPromise!: (reason?: unknown) => void;
  const promise = new Promise<TransliterationResult>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

function partitionSources(sources: readonly string[]): readonly string[][] {
  const batches: string[][] = [];
  let batch: string[] = [];
  let batchLength = 0;
  for (const source of sources) {
    if (
      batch.length > 0 &&
      (batch.length >= MAX_TRANSLITERATION_BATCH_ITEMS ||
        batchLength + source.length > MAX_TRANSLITERATION_BATCH_UTF16)
    ) {
      batches.push(batch);
      batch = [];
      batchLength = 0;
    }
    batch.push(source);
    batchLength += source.length;
  }
  if (batch.length > 0) {
    batches.push(batch);
  }
  return batches;
}

function cacheKey(source: string): string {
  return `${CONTENT_JAPANESE_CACHE_NAMESPACE}\u0000${source}`;
}

export class LocalFrameEngineClient implements FrameEngineClient {
  readonly #cache = new LruCache<string, TransliterationResult>(
    CONTENT_FRAME_CACHE_CAPACITY,
  );
  readonly #inflight = new Map<string, Promise<TransliterationResult>>();

  async transliterate(
    sources: readonly string[],
  ): Promise<ReadonlyMap<string, TransliterationResult | null>> {
    const uniqueSources = [...new Set(sources)];
    const requested = new Map<string, Promise<TransliterationResult>>();
    const newDeferred = new Map<string, DeferredResult>();

    for (const source of uniqueSources) {
      const key = cacheKey(source);
      const cached = this.#cache.get(key);
      if (cached !== undefined) {
        requested.set(source, Promise.resolve(cached));
        continue;
      }
      const pending = this.#inflight.get(key);
      if (pending !== undefined) {
        requested.set(source, pending);
        continue;
      }
      const deferred = deferredResult();
      this.#inflight.set(key, deferred.promise);
      requested.set(source, deferred.promise);
      newDeferred.set(source, deferred);
    }

    for (const batch of partitionSources([...newDeferred.keys()])) {
      void this.#dispatchBatch(batch, newDeferred);
    }

    const settled = await Promise.allSettled(requested.values());
    const output = new Map<string, TransliterationResult | null>();
    let index = 0;
    for (const source of requested.keys()) {
      const result = settled[index];
      output.set(
        source,
        result?.status === "fulfilled" ? result.value : null,
      );
      index += 1;
    }
    return output;
  }

  clear(): void {
    this.#cache.clear();
  }

  async #dispatchBatch(
    sources: readonly string[],
    deferredBySource: ReadonlyMap<string, DeferredResult>,
  ): Promise<void> {
    const requestId = crypto.randomUUID();
    const items = sources.map((source, index) => ({
      itemId: `${requestId}:${String(index)}`,
      source,
      language: "ja" as const,
      romanizationPolicy: "ascii-hepburn-v1",
    }));
    try {
      const rawResponse: unknown = await chrome.runtime.sendMessage(
        createTransliterationBatchRequest(requestId, items),
      );
      const response = validateTransliterationBatchResponse(
        rawResponse,
        "content",
      );
      if (!response.ok || response.value.requestId !== requestId) {
        const health = validateHealthErrorResponse(rawResponse);
        throw new Error(
          health.ok ? health.value.error.code : "Invalid processor response",
        );
      }
      for (const [index, source] of sources.entries()) {
        const deferred = deferredBySource.get(source);
        const result = response.value.results[index];
        if (
          deferred === undefined ||
          result?.source !== source
        ) {
          deferred?.reject(new Error("Missing correlated engine result"));
          continue;
        }
        this.#cache.set(cacheKey(source), result);
        deferred.resolve(result);
      }
    } catch (error) {
      for (const source of sources) {
        deferredBySource.get(source)?.reject(error);
      }
    } finally {
      for (const source of sources) {
        this.#inflight.delete(cacheKey(source));
      }
    }
  }
}
