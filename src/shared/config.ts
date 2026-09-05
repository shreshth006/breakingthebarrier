export const PROTOCOL_VERSION = 1 as const;

export const MAX_REQUEST_ID_LENGTH = 128;
export const MAX_ORIGIN_LENGTH = 2_048;
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

export const CONTENT_SCAN_SLICE_BUDGET_MS = 8;
export const CONTENT_SCAN_SLICE_NODE_LIMIT = 250;
export const CONTENT_WRITE_SLICE_NODE_LIMIT = 100;
export const CONTENT_FRAME_CACHE_CAPACITY = 256;
export const CONTENT_JAPANESE_CACHE_NAMESPACE =
  "ja:lindera-5.3.0:ipadic-5.3.0:ascii-hepburn-v1:japanese-spacing-v1";
export const CONTENT_SCRIPT_PATH = "assets/content-script.js";
export const CONTENT_IGNORE_ATTRIBUTE = "data-btb-ignore";
export const CONTENT_UI_ATTRIBUTE = "data-btb-ui";
export const CONTENT_JAPANESE_DETECTION_MIN_NODES = 1;
export const ACTIVE_FRAME_SESSION_STORAGE_KEY = "activeFrameSessionsV1";
export const REMEMBERED_FRAME_SESSION_STORAGE_KEY =
  "rememberedFrameSessionsV1";

export const INTERNAL_KANA_PROBE = "とうきょう";

export const INTERNAL_ROMAJI_PROBE = "toukyou";
