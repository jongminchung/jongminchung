import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
    HeroSection,
    PrinciplesSection,
    WorkSection,
    WritingSection,
} from "#components/home/HomeSections";
import {
    HomeFooter,
    HomeHeader,
    PersonStructuredData,
} from "#components/home/HomeShell";
import { isLocale } from "#lib/site-routing";

/** 경로 매개변수에 맞는 페이지 메타데이터를 생성함 */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ readonly locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    if (!isLocale(locale)) return {};
    const description =
        locale === "ko"
            ? "Jamie 정민의 소개와 프로젝트, 최근 기술·투자 기록을 연결하는 프로필 허브"
            : "Jamie's profile, projects, and latest engineering and investment writing";
    return {
        title: "Jamie — Jongmin Chung",
        description,
        alternates: {
            canonical: `https://jamie.kr/${locale}`,
            languages: { ko: "https://jamie.kr/ko", en: "https://jamie.kr/en" },
        },
    };
}

/** `HomePage` 페이지 UI를 렌더링함 */
export default async function HomePage({
    params,
}: {
    readonly params: Promise<{ readonly locale: string }>;
}) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    return (
        <>
            <HomeHeader locale={locale} />
            <main id="main-content">
                <HeroSection locale={locale} />
                <WorkSection locale={locale} />
                <WritingSection locale={locale} />
                <PrinciplesSection locale={locale} />
            </main>
            <HomeFooter locale={locale} />
            <PersonStructuredData />
        </>
    );
}
