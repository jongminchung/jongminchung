import type { MetadataRoute } from "next";
import { locales } from "#lib/site-routing";

export default function sitemap(): MetadataRoute.Sitemap {
    return locales.map((locale) => ({
        url: `https://jamie.kr/${locale}`,
        changeFrequency: "monthly",
        priority: 1,
        alternates: {
            languages: {
                ko: "https://jamie.kr/ko",
                en: "https://jamie.kr/en",
            },
        },
    }));
}
