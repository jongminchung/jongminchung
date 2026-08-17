import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvestmentNotePage } from "#components/invest/InvestmentShell";
import { getInvestmentNotes, loadInvestmentNote } from "#lib/investment-notes";
import { isLocale, locales } from "#lib/site-routing";

export const dynamicParams = false;
/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export async function generateStaticParams() {
    const notes = await Promise.all(locales.map(getInvestmentNotes));
    return notes.flat().map((note) => ({ locale: note.locale, slug: note.id }));
}

/** 경로 매개변수에 맞는 페이지 메타데이터를 생성함 */
export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const { locale, slug } = await params;
    if (!isLocale(locale)) notFound();
    const loaded = await loadInvestmentNote(locale, slug);
    if (loaded === null) notFound();
    const { metadata } = loaded;
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

interface PageProps {
    readonly params: Promise<{
        readonly locale: string;
        readonly slug: string;
    }>;
}

/** `NotePage` 페이지 UI를 렌더링함 */
export default async function NotePage({
    params,
}: PageProps): Promise<React.JSX.Element> {
    const { locale, slug } = await params;
    if (!isLocale(locale)) notFound();
    const loaded = await loadInvestmentNote(locale, slug);
    if (loaded === null) notFound();
    return (
        <InvestmentNotePage locale={locale} note={loaded.metadata}>
            <loaded.Content />
        </InvestmentNotePage>
    );
}
