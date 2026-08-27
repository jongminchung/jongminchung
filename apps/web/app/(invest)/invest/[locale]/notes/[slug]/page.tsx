import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvestmentNotePage } from "#invest-components/InvestmentShell";
import {
  findInvestmentNote,
  getInvestmentNotes,
  loadInvestmentNote,
} from "#lib/invest/notes";
import { isLocale, locales } from "#lib/site-routing";
import { mdxComponents } from "#mdx-components";

/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export async function generateStaticParams() {
  const notes = await Promise.all(locales.map(getInvestmentNotes));
  const params = notes
    .flat()
    .map((note) => ({ locale: note.locale, slug: note.id }));
  return params.length > 0
    ? params
    : locales.map((locale) => ({ locale, slug: "__empty__" }));
}

/** 경로 매개변수에 맞는 페이지 메타데이터를 생성함 */
export async function generateMetadata({
  params,
}: PageProps<"/invest/[locale]/notes/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const metadata = await findInvestmentNote(locale, slug);
  if (metadata === null) notFound();
  return {
    title: metadata.title,
    description: metadata.description,
    alternates: {
      canonical: metadata.href,
      languages: { ko: `/ko/notes/${slug}`, en: `/en/notes/${slug}` },
    },
    openGraph: {
      type: "article",
      title: metadata.title,
      description: metadata.description,
      url: metadata.href,
      images: ["/investment-notes-og.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: metadata.title,
      description: metadata.description,
      images: ["/investment-notes-og.png"],
    },
  };
}

/** `NotePage` 페이지 UI를 렌더링함 */
export default async function NotePage({
  params,
}: PageProps<"/invest/[locale]/notes/[slug]">): Promise<React.JSX.Element> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const loaded = await loadInvestmentNote(locale, slug);
  if (loaded === null) notFound();
  return (
    <InvestmentNotePage
      locale={locale}
      note={loaded.metadata}
      related={await getInvestmentNotes(locale)}
    >
      <loaded.Content components={mdxComponents} />
    </InvestmentNotePage>
  );
}
