import type { Locale } from "./content-contracts.ts";

interface LocaleProtocol {
  readonly alternate: Locale;
  readonly openGraph: "en_US" | "ko_KR";
  readonly rss: "en-US" | "ko-KR";
}

const localeProtocols = {
  ko: { alternate: "en", openGraph: "ko_KR", rss: "ko-KR" },
  en: { alternate: "ko", openGraph: "en_US", rss: "en-US" },
} as const satisfies Record<Locale, LocaleProtocol>;

/** UI 번역과 분리된 외부 protocol용 locale 값을 반환함 */
export function getLocaleProtocol(locale: Locale): LocaleProtocol {
  return localeProtocols[locale];
}

/** 현재 locale의 반대 언어를 반환함 */
export function alternateLocale(locale: Locale): Locale {
  return localeProtocols[locale].alternate;
}
