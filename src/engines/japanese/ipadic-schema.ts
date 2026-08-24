import type { SourceAlignedSegment } from "../contracts";
import { romanizeKana } from "./ascii-hepburn";

export const IPADIC_DICTIONARY_VERSION = "5.3.0";
export const IPADIC_FORMAT_VERSION = 2;

export const IPADIC_SCHEMA_FIELDS = [
  "surface",
  "left_context_id",
  "right_context_id",
  "cost",
  "part_of_speech",
  "part_of_speech_subcategory_1",
  "part_of_speech_subcategory_2",
  "part_of_speech_subcategory_3",
  "conjugation_form",
  "conjugation_type",
  "base_form",
  "reading",
  "pronunciation",
] as const;

const DETAIL_INDEX = Object.freeze({
  partOfSpeech: 0,
  partOfSpeechSubcategory1: 1,
  partOfSpeechSubcategory2: 2,
  partOfSpeechSubcategory3: 3,
  conjugationType: 4,
  conjugationForm: 5,
  baseForm: 6,
  reading: 7,
  pronunciation: 8,
});

const HAN_PATTERN = /\p{Script=Han}/u;
const KANA_READING_PATTERN = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;

export interface LinderaTokenData {
  readonly surface: string;
  readonly byteStart: number;
  readonly byteEnd: number;
  readonly position: number;
  readonly wordId: number;
  readonly isUnknown: boolean;
  readonly details: readonly string[];
}

export interface JapaneseToken extends SourceAlignedSegment {
  readonly partOfSpeech: string;
  readonly partOfSpeechSubcategory1: string;
  readonly partOfSpeechSubcategory2: string;
  readonly partOfSpeechSubcategory3: string;
  readonly conjugationType: string;
  readonly conjugationForm: string;
  readonly baseForm: string | null;
  readonly pronunciation: string | null;
  readonly isUnknown: boolean;
}

function nullableDetail(value: string | undefined): string | null {
  return value === undefined || value === "*" || value.length === 0
    ? null
    : value;
}

function detail(token: LinderaTokenData, index: number): string {
  return token.details[index] ?? "*";
}

function isKanaReading(value: string | null): value is string {
  return value !== null && KANA_READING_PATTERN.test(value);
}

function selectReading(
  surface: string,
  partOfSpeech: string,
  reading: string | null,
  pronunciation: string | null,
): string | null {
  if (partOfSpeech === "助詞" && isKanaReading(pronunciation)) {
    return pronunciation;
  }
  if (isKanaReading(reading)) {
    return reading;
  }
  if (isKanaReading(pronunciation)) {
    return pronunciation;
  }
  if (!HAN_PATTERN.test(surface) && KANA_READING_PATTERN.test(surface)) {
    return surface;
  }
  return null;
}

export function assertIpadicSchema(fields: readonly string[]): void {
  if (
    fields.length !== IPADIC_SCHEMA_FIELDS.length ||
    fields.some((field, index) => field !== IPADIC_SCHEMA_FIELDS[index])
  ) {
    throw new Error("Lindera IPADIC schema does not match the pinned adapter");
  }
}

export function createUtf8ByteToUtf16Map(source: string): ReadonlyMap<number, number> {
  const map = new Map<number, number>([[0, 0]]);
  const encoder = new TextEncoder();
  let byteOffset = 0;
  let utf16Offset = 0;

  while (utf16Offset < source.length) {
    const codePoint = source.codePointAt(utf16Offset);
    if (codePoint === undefined) {
      throw new Error("Unable to read source code point");
    }
    const character = String.fromCodePoint(codePoint);
    byteOffset += encoder.encode(character).length;
    utf16Offset += character.length;
    map.set(byteOffset, utf16Offset);
  }

  return map;
}

export function mapIpadicTokens(
  source: string,
  tokens: readonly LinderaTokenData[],
): readonly JapaneseToken[] {
  const offsetMap = createUtf8ByteToUtf16Map(source);

  return tokens.map((token) => {
    const start = offsetMap.get(token.byteStart);
    const end = offsetMap.get(token.byteEnd);
    if (start === undefined || end === undefined || start > end) {
      throw new Error("Lindera returned an invalid UTF-8 token boundary");
    }

    const surface = source.slice(start, end);
    if (surface !== token.surface) {
      throw new Error("Lindera token surface does not match its source offsets");
    }

    const partOfSpeech = detail(token, DETAIL_INDEX.partOfSpeech);
    const readingDetail = nullableDetail(detail(token, DETAIL_INDEX.reading));
    const pronunciation = nullableDetail(
      detail(token, DETAIL_INDEX.pronunciation),
    );
    const reading = selectReading(
      surface,
      partOfSpeech,
      readingDetail,
      pronunciation,
    );

    return {
      start,
      end,
      source: surface,
      reading,
      romanized: reading === null ? null : romanizeKana(reading),
      partOfSpeech,
      partOfSpeechSubcategory1: detail(
        token,
        DETAIL_INDEX.partOfSpeechSubcategory1,
      ),
      partOfSpeechSubcategory2: detail(
        token,
        DETAIL_INDEX.partOfSpeechSubcategory2,
      ),
      partOfSpeechSubcategory3: detail(
        token,
        DETAIL_INDEX.partOfSpeechSubcategory3,
      ),
      conjugationType: detail(token, DETAIL_INDEX.conjugationType),
      conjugationForm: detail(token, DETAIL_INDEX.conjugationForm),
      baseForm: nullableDetail(detail(token, DETAIL_INDEX.baseForm)),
      pronunciation,
      isUnknown: token.isUnknown,
    };
  });
}
