import {
  OFFSCREEN_DOCUMENT_JUSTIFICATION,
  OFFSCREEN_DOCUMENT_PATH,
} from "../shared/config";
import type { ProcessorProbeRequest } from "../shared/messages";

let offscreenCreation: Promise<void> | undefined;

export async function ensureOffscreenDocument(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) {
    return;
  }

  offscreenCreation ??= chrome.offscreen
    .createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: OFFSCREEN_DOCUMENT_JUSTIFICATION,
    })
    .finally(() => {
      offscreenCreation = undefined;
    });

  await offscreenCreation;
}

export async function sendProcessorProbe(
  request: ProcessorProbeRequest,
): Promise<unknown> {
  return chrome.runtime.sendMessage(request);
}
