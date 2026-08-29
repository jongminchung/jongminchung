import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvestmentHome } from "#invest-components/InvestmentCollection";
import { getInvestmentMessages } from "#lib/invest/copy";
import { getInvestmentNotes } from "#lib/invest/notes";
import { alternateLocale, getLocaleProtocol } from "#lib/locale";
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
  const { title, description } = getInvestmentMessages(locale).homeMetadata;
  const protocol = getLocaleProtocol(locale);
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
      locale: protocol.openGraph,
      alternateLocale: [getLocaleProtocol(alternateLocale(locale)).openGraph],
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
