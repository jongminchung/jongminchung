import { notFound } from "next/navigation";
import {
    NoteCollection,
    sourceTitle,
} from "#components/invest/InvestmentShell";
import {
    investmentSourceKinds,
    type InvestmentSourceKind,
} from "#lib/investment-content";
import { getNotesBySource } from "#lib/investment-notes";
import { isLocale, locales } from "#lib/site-routing";

export const dynamicParams = false;
/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export function generateStaticParams() {
    return locales.flatMap((locale) =>
        investmentSourceKinds.map((kind) => ({ locale, kind })),
    );
}

function isSourceKind(value: string): value is InvestmentSourceKind {
    return investmentSourceKinds.some((kind) => kind === value);
}

/** `SourceIndex` 공개 기능을 제공함 */
export default async function SourceIndex({
    params,
}: {
    readonly params: Promise<{
        readonly locale: string;
        readonly kind: string;
    }>;
}): Promise<React.JSX.Element> {
    const { locale, kind } = await params;
    if (!isLocale(locale) || !isSourceKind(kind)) notFound();
    return (
        <main>
            <NoteCollection
                locale={locale}
                notes={await getNotesBySource(locale, kind)}
                title={sourceTitle(locale, kind)}
            />
        </main>
    );
}
