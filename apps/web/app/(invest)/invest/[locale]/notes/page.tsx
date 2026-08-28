import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoteCollection } from "#invest-components/InvestmentShell";
import { getInvestmentNotes } from "#lib/invest/notes";
import { createInvestmentCollectionMetadata } from "#lib/invest/seo";
import { isLocale, locales } from "#lib/site-routing";

function copy(locale: "ko" | "en") {
  return locale === "ko"
    ? {
        title: "모든 투자 리서치 노트",
        description:
          "책과 공개 자료의 핵심 주장과 Jamie의 판단을 분리해 기록한 투자 리서치 노트 전체 모음",
      }
    : {
        title: "All investment research notes",
        description:
          "All source-grounded investment research notes separating original claims from Jamie's judgment.",
      };
}

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
    ...copy(locale),
    pathname: `/${locale}/notes`,
    alternatePathname: `/${locale === "ko" ? "en" : "ko"}/notes`,
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
  const text = copy(locale);
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
