import { notFound } from "next/navigation";
import { NoteCollection } from "#invest-components/InvestmentShell";
import { getInvestmentNotes } from "#lib/invest/notes";
import { isLocale, locales } from "#lib/site-routing";

export const dynamicParams = false;
/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export function generateStaticParams() {
    return locales.map((locale) => ({ locale }));
}

/** `NotesIndex` 공개 기능을 제공함 */
export default async function NotesIndex({
    params,
}: PageProps<"/invest/[locale]/notes">): Promise<React.JSX.Element> {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    return (
        <main>
            <NoteCollection
                locale={locale}
                notes={await getInvestmentNotes(locale)}
                title={locale === "ko" ? "모든 노트" : "All notes"}
            />
        </main>
    );
}
