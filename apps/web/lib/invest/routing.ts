import type { Locale } from "../content-contracts.ts";
import type { InvestmentSourceKind } from "./content.ts";

const sourceLabels = {
  ko: {
    book: "책",
    social: "공개 의견",
    video: "영상",
    interview: "인터뷰",
    article: "아티클",
  },
  en: {
    book: "Books",
    social: "Public voices",
    video: "Videos",
    interview: "Interviews",
    article: "Articles",
  },
} as const;

/** `sourceTitle` 투자 원자료 유형의 지역화된 제목을 반환함 */
export function sourceTitle(
  locale: Locale,
  kind: InvestmentSourceKind,
): string {
  return sourceLabels[locale][kind];
}

/** `sourceDescription` 원자료별 collection의 검색 설명을 반환함 */
export function sourceDescription(
  locale: Locale,
  kind: InvestmentSourceKind,
): string {
  const title = sourceTitle(locale, kind);
  return locale === "ko"
    ? `${title}을 바탕으로 투자 아이디어와 시장 구조를 분석한 글 모음`
    : `Investment research essays grounded in ${title.toLowerCase()}.`;
}

/** `investmentSeriesSlug` 표시용 series 이름을 안정적인 URL slug로 변환함 */
export function investmentSeriesSlug(series: string): string {
  let decodedSeries = series;
  try {
    decodedSeries = decodeURIComponent(series);
  } catch {
    // 잘못된 percent encoding은 원문을 기준으로 안전하게 slug화함
  }
  return decodedSeries
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

/** `createInvestmentSeriesHref` 투자 series URL을 생성함 */
export function createInvestmentSeriesHref(
  locale: Locale,
  series: string,
): string {
  return `/${locale}/series/${investmentSeriesSlug(series)}`;
}

/** `createInvestmentTagHref` 투자 tag URL을 생성함 */
export function createInvestmentTagHref(locale: Locale, tag: string): string {
  return `/${locale}/tags/${encodeURIComponent(tag)}`;
}

/** `createInvestmentSourceHref` 투자 source URL을 생성함 */
export function createInvestmentSourceHref(
  locale: Locale,
  kind: InvestmentSourceKind,
): string {
  return `/${locale}/sources/${kind}`;
}
