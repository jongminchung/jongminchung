import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvestmentCollection } from "#invest-components/InvestmentCollection";
import { investmentTagDescription } from "#lib/invest/copy";
import { getInvestmentNotes, getNotesByTag } from "#lib/invest/notes";
import { createInvestmentTagHref } from "#lib/invest/routing";
import { createInvestmentCollectionMetadata } from "#lib/invest/seo";
import { alternateLocale } from "#lib/locale";
import { isLocale, locales, type Locale } from "#lib/site-routing";

/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export function generateStaticParams() {
  const investmentNotes = locales.flatMap(getInvestmentNotes);
  const params = [
    ...new Set(
      investmentNotes.flatMap((note) =>
        note.tags.map((tag) => `${note.locale}:${tag}`),
      ),
    ),
  ].map((key) => {
    const [locale, slug] = key.split(":");
    return { locale, slug };
  });
  return params.length > 0
    ? params
    : locales.map((locale) => ({ locale, slug: "__empty__" }));
}

function getTagCollection(locale: Locale, slug: string) {
  const notes = getNotesByTag(locale, slug);
  if (notes.length === 0) notFound();
  return {
    notes,
    title: `#${slug}`,
    description: investmentTagDescription(locale, slug),
    pathname: createInvestmentTagHref(locale, slug),
  };
}

/** tag collection의 메타데이터를 생성함 */
export async function generateMetadata({
  params,
}: PageProps<"/invest/[locale]/tags/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const collection = getTagCollection(locale, slug);
  const otherLocale = alternateLocale(locale);
  const alternateNotes = getNotesByTag(otherLocale, slug);
  return createInvestmentCollectionMetadata({
    locale,
    title: collection.title,
    description: collection.description,
    pathname: collection.pathname,
    alternatePathname:
      alternateNotes.length < 2
        ? undefined
        : createInvestmentTagHref(otherLocale, slug),
    index: collection.notes.length >= 2,
  });
}
/** `TagPage` 페이지 UI를 렌더링함 */
export default async function TagPage({
  params,
  searchParams,
}: PageProps<"/invest/[locale]/tags/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <InvestmentCollection
      {...getTagCollection(locale, slug)}
      locale={locale}
      searchParams={await searchParams}
    />
  );
}
