import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvestmentCollection } from "#invest-components/InvestmentCollection";
import { getInvestmentMessages } from "#lib/invest/copy";
import { getInvestmentNotes } from "#lib/invest/notes";
import { createInvestmentCollectionMetadata } from "#lib/invest/seo";
import { alternateLocale } from "#lib/locale";
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
  const pathname = `/${locale}`;
  return {
    ...createInvestmentCollectionMetadata({
      locale,
      title,
      description,
      pathname,
      alternatePathname: `/${alternateLocale(locale)}`,
      index: true,
    }),
    title: { absolute: `${title} · Investment Notes` },
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
  const { title, description } = getInvestmentMessages(locale).index;
  return (
    <InvestmentCollection
      description={description}
      locale={locale}
      notes={getInvestmentNotes(locale)}
      pathname={`/${locale}`}
      searchParams={query}
      title={title}
    />
  );
}
