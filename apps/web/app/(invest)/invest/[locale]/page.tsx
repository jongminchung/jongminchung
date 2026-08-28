import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvestmentHome } from "#invest-components/InvestmentShell";
import { getInvestmentNotes } from "#lib/invest/notes";
import { isLocale, locales } from "#lib/site-routing";

/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** 경로 매개변수에 맞는 페이지 메타데이터를 생성함 */
export async function generateMetadata({
  params,
}: PageProps<"/invest/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const title =
    locale === "ko" ? "투자 리서치 노트" : "Investment research notes";
  const description =
    locale === "ko"
      ? "13F 공시와 원문 자료를 분석하고 사실과 Jamie의 판단을 분리해 기록합니다"
      : "Source-grounded analysis of 13F filings and original investment materials";
  return {
    title: { absolute: `${title} · Investment Notes` },
    description,
    alternates: {
      canonical: `/${locale}`,
      languages: { ko: "/ko", en: "/en", "x-default": "/en" },
      types: { "application/rss+xml": `/${locale}/rss.xml` },
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: `/${locale}`,
      locale: locale === "ko" ? "ko_KR" : "en_US",
      alternateLocale: [locale === "ko" ? "en_US" : "ko_KR"],
      images: ["/investment-notes-og.png"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/investment-notes-og.png"],
    },
  };
}

/** `InvestmentPage` 페이지 UI를 렌더링함 */
export default async function InvestmentPage({
  params,
  searchParams,
}: PageProps<"/invest/[locale]">): Promise<React.JSX.Element> {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  return (
    <InvestmentHome
      locale={locale}
      notes={await getInvestmentNotes(locale)}
      searchParams={query}
    />
  );
}
