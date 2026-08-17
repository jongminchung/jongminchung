import { notFound } from "next/navigation";
import { NoteCollection } from "#components/invest/InvestmentShell";
import { getInvestmentNotes, investmentNotes } from "#lib/investment-notes";
import { isLocale } from "#lib/site-routing";

export const dynamicParams = false;
export function generateStaticParams() {
    return [
        ...new Set(
            investmentNotes.flatMap((note) =>
                note.tags.map((tag) => `${note.locale}:${tag}`),
            ),
        ),
    ].map((key) => {
        const [locale, slug] = key.split(":");
        return { locale, slug };
    });
}
export default async function TagPage({
    params,
}: {
    readonly params: Promise<{
        readonly locale: string;
        readonly slug: string;
    }>;
}) {
    const { locale, slug } = await params;
    if (!isLocale(locale)) notFound();
    const notes = getInvestmentNotes(locale).filter((note) =>
        note.tags.includes(slug),
    );
    if (notes.length === 0) notFound();
    return (
        <main>
            <NoteCollection locale={locale} notes={notes} title={`#${slug}`} />
        </main>
    );
}
