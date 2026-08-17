import { notFound } from "next/navigation";
import { NoteCollection } from "#components/invest/InvestmentShell";
import { getInvestmentNotes } from "#lib/investment-notes";
import { isLocale, locales } from "#lib/site-routing";

export const dynamicParams = false;
export function generateStaticParams() {
    return locales.map((locale) => ({ locale }));
}

export default async function NotesIndex({
    params,
}: {
    readonly params: Promise<{ readonly locale: string }>;
}): Promise<React.JSX.Element> {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    return (
        <main>
            <NoteCollection
                locale={locale}
                notes={getInvestmentNotes(locale)}
                title={locale === "ko" ? "모든 노트" : "All notes"}
            />
        </main>
    );
}
