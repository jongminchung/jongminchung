import type { Metadata } from "next";
import {
  createOgImageHref,
  type ContentManifestEntry,
  type Locale,
} from "../content-model.ts";

/** Tech 페이지의 canonical·hreflang·공유 메타데이터를 생성함 */
export function techPageMetadata({
  title,
  description,
  locale,
  canonical,
  alternatePaths,
  imageId,
  article,
}: {
  readonly title: string;
  readonly description: string;
  readonly locale: Locale;
  readonly canonical: string;
  readonly alternatePaths: Record<Locale, string>;
  readonly imageId: string;
  readonly article?: ContentManifestEntry;
}): Metadata {
  const image = {
    url: createOgImageHref(locale, imageId),
    width: 1200,
    height: 630,
    alt: `${title} · Engineering Notes`,
  };
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { ...alternatePaths, "x-default": alternatePaths.en },
      types: { "application/rss+xml": `/${locale}/rss.xml` },
    },
    openGraph: {
      type: article === undefined ? "website" : "article",
      title,
      description,
      locale: locale === "ko" ? "ko_KR" : "en_US",
      alternateLocale: [locale === "ko" ? "en_US" : "ko_KR"],
      url: canonical,
      images: [image],
      ...(article === undefined
        ? {}
        : {
            publishedTime: article.publishedAt,
            modifiedTime: article.updatedAt,
            authors: ["https://www.jamie.kr"],
            tags: article.tags,
          }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

/** Blog index 메타데이터를 생성함 */
export function blogIndexMetadata(locale: Locale): Metadata {
  const copy =
    locale === "ko"
      ? {
          title: "기술 블로그",
          description: "소프트웨어를 이해하기 쉽게 만드는 방법에 관한 기술 글",
        }
      : {
          title: "Engineering Blog",
          description:
            "Technical articles about building understandable software.",
        };
  return techPageMetadata({
    ...copy,
    locale,
    canonical: `/${locale}`,
    alternatePaths: { ko: "/ko", en: "/en" },
    imageId: "blog",
  });
}
