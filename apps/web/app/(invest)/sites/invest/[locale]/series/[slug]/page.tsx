import { notFound } from "next/navigation";
import { NoteCollection } from "#components/invest/InvestmentShell";
import { getInvestmentNotes, investmentNotes } from "#lib/investment-notes";
import { isLocale } from "#lib/site-routing";

export const dynamicParams = false;
export function generateStaticParams() {
    return [
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
}
export default async function SeriesPage({
    params,
}: {
    readonly params: Promise<{
        readonly locale: string;
        readonly slug: string;
    }>;
}) {
    const { locale, slug } = await params;
    if (!isLocale(locale)) notFound();
    const notes = getInvestmentNotes(locale).filter(
        (note) => note.series === slug,
    );
    if (notes.length === 0) notFound();
    return (
        <main>
            <NoteCollection locale={locale} notes={notes} title={slug} />
        </main>
    );
}
