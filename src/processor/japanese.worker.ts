import {
  ASCII_HEPBURN_POLICY_VERSION,
  WANAKANA_VERSION,
  romanizeKana,
} from "../engines/japanese/ascii-hepburn";
import { INTERNAL_KANA_PROBE, INTERNAL_ROMAJI_PROBE } from "../shared/config";
import {
  createJapaneseWorkerProbeFailure,
  createJapaneseWorkerProbeResponse,
  isJapaneseWorkerProbeRequest,
} from "../shared/worker-messages";

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

function classifyEngineLoadFailure(
  error: unknown,
): "engine-module" | "engine-load" | "wasm-compile" | "wasm-link" | "wasm-runtime" {
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

workerScope.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (!isJapaneseWorkerProbeRequest(event.data)) {
    return;
  }
  const request = event.data;

  const romanizedProbe = romanizeKana(INTERNAL_KANA_PROBE);
  if (romanizedProbe !== INTERNAL_ROMAJI_PROBE) {
    workerScope.postMessage(
      createJapaneseWorkerProbeFailure(request.requestId, "self-test"),
    );
    return;
  }

  void import("lindera-wasm-bundler")
    .then(({ version: getLinderaVersion }) => {
      workerScope.postMessage(
        createJapaneseWorkerProbeResponse(request.requestId, {
          status: "ready",
          capabilities: ["lindera-wasm", "kana-romanizer"],
          versions: {
            lindera: getLinderaVersion(),
            wanakana: WANAKANA_VERSION,
            romanizationPolicy: ASCII_HEPBURN_POLICY_VERSION,
          },
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
