import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvestmentCollection } from "#invest-components/InvestmentCollection";
import {
  investmentSourceKinds,
  type InvestmentSourceKind,
} from "#lib/invest/content";
import { getNotesBySource } from "#lib/invest/notes";
import {
  createInvestmentSourceHref,
  sourceDescription,
  sourceTitle,
} from "#lib/invest/routing";
import { createInvestmentCollectionMetadata } from "#lib/invest/seo";
import { alternateLocale } from "#lib/locale";
import { isLocale, locales, type Locale } from "#lib/site-routing";

/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export function generateStaticParams() {
  return locales.flatMap((locale) =>
    investmentSourceKinds.map((kind) => ({ locale, kind })),
  );
}

function isSourceKind(value: string): value is InvestmentSourceKind {
  return investmentSourceKinds.some((kind) => kind === value);
}

function getSourceCollection(locale: Locale, kind: InvestmentSourceKind) {
  return {
    notes: getNotesBySource(locale, kind),
    title: sourceTitle(locale, kind),
    description: sourceDescription(locale, kind),
    pathname: createInvestmentSourceHref(locale, kind),
  };
}

/** source collection의 메타데이터를 생성함 */
export async function generateMetadata({
  params,
}: PageProps<"/invest/[locale]/sources/[kind]">): Promise<Metadata> {
  const { locale, kind } = await params;
  if (!isLocale(locale) || !isSourceKind(kind)) notFound();
  const collection = getSourceCollection(locale, kind);
  const otherLocale = alternateLocale(locale);
  const alternateNotes = getNotesBySource(otherLocale, kind);
  return createInvestmentCollectionMetadata({
    locale,
    title: collection.title,
    description: collection.description,
    pathname: collection.pathname,
    alternatePathname:
      alternateNotes.length < 2
        ? undefined
        : createInvestmentSourceHref(otherLocale, kind),
    index: collection.notes.length >= 2,
  });
}

/** `SourceIndex` 공개 기능을 제공함 */
export default async function SourceIndex({
  params,
  searchParams,
}: PageProps<"/invest/[locale]/sources/[kind]">): Promise<React.JSX.Element> {
  const { locale, kind } = await params;
  if (!isLocale(locale) || !isSourceKind(kind)) notFound();
  return (
    <InvestmentCollection
      {...getSourceCollection(locale, kind)}
      locale={locale}
      searchParams={await searchParams}
    />
  );
}
