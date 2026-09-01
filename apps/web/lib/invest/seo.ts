import type { Metadata } from "next";
import type { Locale } from "../content-contracts.ts";
import { alternateLocale, getLocaleProtocol } from "../locale.ts";

export const investmentOgImage = "/investment-notes-og.png";

/** `createInvestmentCollectionMetadata` 투자 collection의 검색·소셜 계약을 생성함 */
export function createInvestmentCollectionMetadata({
  locale,
  title,
  description,
  pathname,
  alternatePathname,
  index,
}: {
  readonly locale: Locale;
  readonly title: string;
  readonly description: string;
  readonly pathname: string;
  readonly alternatePathname?: string;
  readonly index: boolean;
}): Metadata {
  const otherLocale = alternateLocale(locale);
  const protocol = getLocaleProtocol(locale);
  const languages: Record<string, string> = { [locale]: pathname };
  if (alternatePathname !== undefined) {
    languages[otherLocale] = alternatePathname;
    languages["x-default"] = locale === "en" ? pathname : alternatePathname;
  }
  return {
    title,
    description,
    alternates: {
      canonical: pathname,
      languages,
      types: { "application/rss+xml": `/${locale}/rss.xml` },
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: pathname,
      locale: protocol.openGraph,
      alternateLocale: [getLocaleProtocol(otherLocale).openGraph],
      images: [investmentOgImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [investmentOgImage],
    },
    robots: index ? undefined : { index: false, follow: true },
  };
}
