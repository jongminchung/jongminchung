import { describe, expect, it } from "bun:test";
import { createInvestmentCollectionMetadata } from "./seo.ts";

const translatedPaths = {
  en: "/en/series/operating-notes",
  ko: "/ko/series/operating-notes",
} as const;

describe("투자 collection 다국어 검색 계약", () => {
  for (const locale of ["en", "ko"] as const) {
    const otherLocale = locale === "en" ? "ko" : "en";
    const input = {
      locale,
      title: "Operating notes",
      description: "Collection description",
      pathname: translatedPaths[locale],
    };

    it(`${locale}: 번역 쌍은 양쪽에서 같은 영어 x-default와 자기 canonical을 제공함`, () => {
      const metadata = createInvestmentCollectionMetadata({
        ...input,
        alternatePathname: translatedPaths[otherLocale],
        index: true,
      });
      expect(metadata.alternates).toMatchObject({
        canonical: translatedPaths[locale],
        languages: { ...translatedPaths, "x-default": translatedPaths.en },
        types: { "application/rss+xml": `/${locale}/rss.xml` },
      });
      expect(metadata.openGraph).toMatchObject({
        url: translatedPaths[locale],
        locale: locale === "en" ? "en_US" : "ko_KR",
        alternateLocale: [locale === "en" ? "ko_KR" : "en_US"],
      });
      expect(metadata.robots).toBeUndefined();
    });

    it(`${locale}: 번역이 없는 소규모 collection에 존재하지 않는 대체 URL을 만들지 않음`, () => {
      const metadata = createInvestmentCollectionMetadata({
        ...input,
        index: false,
      });
      expect(metadata.alternates?.canonical).toBe(translatedPaths[locale]);
      expect(metadata.alternates?.languages).toEqual({
        [locale]: translatedPaths[locale],
      });
      expect(metadata.robots).toEqual({ index: false, follow: true });
    });
  }
});
