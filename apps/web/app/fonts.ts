import localFont from "next/font/local";
import type { Locale } from "#lib/content-contracts";

/** locale 없는 route에서 사용하는 자체 호스팅 가변 폰트임 */
export const pretendard = localFont({
  src: "./fonts/PretendardStdVariable.woff2",
  adjustFontFallback: "Arial",
  display: "swap",
  preload: false,
  weight: "45 920",
  variable: "--font-pretendard",
});

const localeFontClassNames = {
  en: "font-pretendard-latin",
  ko: "font-pretendard-dynamic",
} as const satisfies Readonly<Record<Locale, string>>;

/** locale route에서 glyph별 Pretendard dynamic subset을 활성화함 */
export function localeFontClassName(locale: Locale): string {
  return localeFontClassNames[locale];
}

/** locale route가 공유하는 dynamic subset stylesheet 경로임 */
export const pretendardStylesheetHref =
  "/fonts/pretendard-variable/dynamic-subset.css";
