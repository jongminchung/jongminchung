import type { Locale } from "./content-contracts.ts";

const dateFormatters = {
  ko: new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }),
  en: new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }),
} as const satisfies Readonly<Record<Locale, Intl.DateTimeFormat>>;

/** ISO 날짜를 문서 로케일의 사람이 읽는 표기로 변환함 */
export function formatEditorialDate(locale: Locale, isoDate: string): string {
  return dateFormatters[locale].format(new Date(`${isoDate}T00:00:00Z`));
}
