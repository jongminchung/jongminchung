import type { MetadataRoute } from "next";
import { locales, siteOrigins } from "#lib/site-routing";

/** 사이트맵 항목을 생성함 */
export default function sitemap(): MetadataRoute.Sitemap {
  return locales.map((locale) => ({
    url: `${siteOrigins.home}/${locale}`,
    alternates: {
      languages: {
        ko: `${siteOrigins.home}/ko`,
        en: `${siteOrigins.home}/en`,
        "x-default": `${siteOrigins.home}/en`,
      },
    },
  }));
}
