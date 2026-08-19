import { notFound } from "next/navigation";
import { NoteCollection } from "#invest-components/InvestmentShell";
import { getInvestmentNotes } from "#lib/invest/notes";
import { isLocale, locales } from "#lib/site-routing";

/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export async function generateStaticParams() {
    const investmentNotes = (
        await Promise.all(locales.map(getInvestmentNotes))
    ).flat();
    const params = [
        ...new Set(
            investmentNotes.flatMap((note) =>
                note.series === undefined
                    ? []
                    : [`${note.locale}:${note.series}`],
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
/** `SeriesPage` 페이지 UI를 렌더링함 */
export default async function SeriesPage({
    params,
}: PageProps<"/invest/[locale]/series/[slug]">) {
    const { locale, slug } = await params;
    if (!isLocale(locale)) notFound();
    const notes = (await getInvestmentNotes(locale)).filter(
        (note) => note.series === slug,
    );
    if (notes.length === 0) notFound();
    return (
        <main>
            <NoteCollection locale={locale} notes={notes} title={slug} />
        </main>
    );
}
