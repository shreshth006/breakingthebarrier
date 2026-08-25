export const PROTOCOL_VERSION = 1 as const;

export const MAX_REQUEST_ID_LENGTH = 128;
export const MAX_TRANSLITERATION_ITEM_ID_LENGTH = 128;
export const MAX_TRANSLITERATION_BATCH_ITEMS = 100;
export const MAX_TRANSLITERATION_SOURCE_UTF16 = 2_000;
export const MAX_TRANSLITERATION_BATCH_UTF16 = 20_000;
export const MAX_TRANSLITERATION_RENDERED_UTF16 = 16_000;
export const MAX_TRANSLITERATION_SEGMENTS = 4_096;

export const OFFSCREEN_DOCUMENT_PATH = "src/processor/offscreen.html";

export const OFFSCREEN_DOCUMENT_JUSTIFICATION =
  "Runs packaged language workers without keeping the service worker alive.";

export const PROCESSOR_PROBE_TIMEOUT_MS = 15_000;
export const PROCESSOR_BATCH_TIMEOUT_MS = 15_000;
export const PROCESSOR_MEMORY_DIAGNOSTIC_STAGE_PAUSE_MS = 300;

export const INTERNAL_KANA_PROBE = "とうきょう";

export const INTERNAL_ROMAJI_PROBE = "toukyou";
