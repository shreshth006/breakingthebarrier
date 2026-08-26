const KANA_PATTERN = /[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f]/u;
const HAN_PATTERN = /\p{Script=Han}/u;

export interface ScriptEvidence {
  readonly hasKana: boolean;
  readonly hasHan: boolean;
  readonly hasJapaneseScript: boolean;
}

export function analyzeJapaneseScripts(source: string): ScriptEvidence {
  const hasKana = KANA_PATTERN.test(source);
  const hasHan = HAN_PATTERN.test(source);
  return {
    hasKana,
    hasHan,
    hasJapaneseScript: hasKana || hasHan,
  };
}
