import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvestmentHome } from "#invest-components/InvestmentShell";
import { getInvestmentNotes } from "#lib/invest/notes";
import { isLocale, locales } from "#lib/site-routing";

export const dynamicParams = false;

/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export function generateStaticParams() {
    return locales.map((locale) => ({ locale }));
}

/** 경로 매개변수에 맞는 페이지 메타데이터를 생성함 */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ readonly locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    const title =
        locale === "ko" ? "투자 리서치 노트" : "Investment research notes";
    const description =
        locale === "ko"
            ? "책과 공개 발언, 영상과 인터뷰를 요약하고 Jamie의 의견을 분리해 기록합니다"
            : "Source-grounded notes from books, public commentary, videos, and interviews";
    return {
        title: { absolute: `${title} · Investment Notes` },
        description,
        alternates: {
            canonical: `/${locale}`,
            languages: { ko: "/ko", en: "/en" },
        },
        openGraph: { title, description, url: `/${locale}` },
        twitter: { card: "summary", title, description },
    };
}

/** `InvestmentPage` 페이지 UI를 렌더링함 */
export default async function InvestmentPage({
    params,
}: {
    readonly params: Promise<{ readonly locale: string }>;
}): Promise<React.JSX.Element> {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    return (
        <InvestmentHome
            locale={locale}
            notes={await getInvestmentNotes(locale)}
        />
    );
}
