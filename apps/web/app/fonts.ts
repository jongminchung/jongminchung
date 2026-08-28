import localFont from "next/font/local";

/** 한국어 route에서 사용하는 자체 호스팅 가변 폰트임 */
export const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  display: "swap",
  preload: false,
  weight: "45 920",
  variable: "--font-pretendard",
});

/** 한국어 route에만 Pretendard CSS variable을 활성화함 */
export function localeFontClassName(locale: string): string | undefined {
  return locale === "ko" ? pretendard.variable : undefined;
}
