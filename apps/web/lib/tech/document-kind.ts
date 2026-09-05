import type { Locale } from "../content-contracts.ts";

export const documentKinds = [
  "tutorial",
  "how-to",
  "reference",
  "explanation",
] as const;

export type DocumentKind = (typeof documentKinds)[number];

/** 서버 schema를 로드하지 않고 외부 응답의 문서 유형을 판별함 */
export function isDocumentKind(value: unknown): value is DocumentKind {
  return documentKinds.some((kind) => kind === value);
}

const documentKindLabels = {
  ko: {
    tutorial: "튜토리얼",
    "how-to": "방법 안내",
    reference: "기술 참조",
    explanation: "설명",
  },
  en: {
    tutorial: "Tutorial",
    "how-to": "How-to guide",
    reference: "Reference",
    explanation: "Explanation",
  },
} as const satisfies Record<Locale, Record<DocumentKind, string>>;

/** Diátaxis 문서 유형의 canonical 지역화 label을 반환함 */
export function documentKindLabel(locale: Locale, kind: DocumentKind): string {
  return documentKindLabels[locale][kind];
}
