import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoteCollection } from "#invest-components/InvestmentCollection";
import { investmentTagDescription } from "#lib/invest/copy";
import { getInvestmentNotes, getNotesByTag } from "#lib/invest/notes";
import { createInvestmentTagHref } from "#lib/invest/routing";
import { createInvestmentCollectionMetadata } from "#lib/invest/seo";
import { alternateLocale } from "#lib/locale";
import { isLocale, locales } from "#lib/site-routing";

/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export async function generateStaticParams() {
  const investmentNotes = (
    await Promise.all(locales.map(getInvestmentNotes))
  ).flat();
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

/** tag collection의 메타데이터를 생성함 */
export async function generateMetadata({
  params,
}: PageProps<"/invest/[locale]/tags/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const notes = await getNotesByTag(locale, slug);
  if (notes.length === 0) notFound();
  const otherLocale = alternateLocale(locale);
  const alternateNotes = await getNotesByTag(otherLocale, slug);
  return createInvestmentCollectionMetadata({
    locale,
    title: `#${slug}`,
    description: investmentTagDescription(locale, slug),
    pathname: createInvestmentTagHref(locale, slug),
    alternatePathname:
      alternateNotes.length < 2
        ? undefined
        : createInvestmentTagHref(otherLocale, slug),
    index: notes.length >= 2,
  });
}
/** `TagPage` 페이지 UI를 렌더링함 */
export default async function TagPage({
  params,
}: PageProps<"/invest/[locale]/tags/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const notes = await getNotesByTag(locale, slug);
  if (notes.length === 0) notFound();
  return (
    <main>
      <NoteCollection
        locale={locale}
        notes={notes}
        description={investmentTagDescription(locale, slug)}
        pathname={createInvestmentTagHref(locale, slug)}
        title={`#${slug}`}
      />
    </main>
  );
}
