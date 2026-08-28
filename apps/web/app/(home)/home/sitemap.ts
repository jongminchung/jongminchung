import type { MetadataRoute } from "next";
import { locales } from "#lib/site-routing";

/** 사이트맵 항목을 생성함 */
export default function sitemap(): MetadataRoute.Sitemap {
  return locales.map((locale) => ({
    url: `https://www.jamie.kr/${locale}`,
    alternates: {
      languages: {
        ko: "https://www.jamie.kr/ko",
        en: "https://www.jamie.kr/en",
        "x-default": "https://www.jamie.kr/en",
      },
    },
  }));
}
