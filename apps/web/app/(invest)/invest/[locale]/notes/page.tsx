import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoteCollection } from "#invest-components/InvestmentCollection";
import { getInvestmentMessages } from "#lib/invest/copy";
import { getInvestmentNotes } from "#lib/invest/notes";
import { createInvestmentCollectionMetadata } from "#lib/invest/seo";
import { alternateLocale } from "#lib/locale";
import { isLocale, locales } from "#lib/site-routing";

/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** 모든 투자 노트 collection의 메타데이터를 생성함 */
export async function generateMetadata({
  params,
}: PageProps<"/invest/[locale]/notes">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return createInvestmentCollectionMetadata({
    locale,
    ...getInvestmentMessages(locale).allNotes,
    pathname: `/${locale}/notes`,
    alternatePathname: `/${alternateLocale(locale)}/notes`,
  });
}

/** `NotesIndex` 공개 기능을 제공함 */
export default async function NotesIndex({
  params,
  searchParams,
}: PageProps<"/invest/[locale]/notes">): Promise<React.JSX.Element> {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const text = getInvestmentMessages(locale).allNotes;
  return (
    <main>
      <NoteCollection
        locale={locale}
        notes={await getInvestmentNotes(locale)}
        description={text.description}
        searchParams={query}
        title={text.title}
      />
    </main>
  );
}
