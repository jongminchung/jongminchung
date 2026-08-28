import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  HeroSection,
  PrinciplesSection,
  WorkSection,
  WritingSection,
} from "#home-components/HomeSections";
import {
  HomeFooter,
  HomeHeader,
  PersonStructuredData,
} from "#home-components/HomeShell";
import { isLocale, locales } from "#lib/site-routing";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** 경로 매개변수에 맞는 페이지 메타데이터를 생성함 */
export async function generateMetadata({
  params,
}: PageProps<"/home/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const description =
    locale === "ko"
      ? "Jamie 정민의 소개와 프로젝트, 최근 기술·투자 기록을 연결하는 프로필 허브"
      : "Jamie's profile, projects, and latest engineering and investment writing";
  const url = `https://www.jamie.kr/${locale}`;
  return {
    title: "Jamie — Jongmin Chung",
    description,
    alternates: {
      canonical: url,
      languages: {
        ko: "https://www.jamie.kr/ko",
        en: "https://www.jamie.kr/en",
        "x-default": "https://www.jamie.kr/en",
      },
    },
    openGraph: {
      type: "profile",
      title: "Jamie — Jongmin Chung",
      description,
      url,
      locale: locale === "ko" ? "ko_KR" : "en_US",
      alternateLocale: [locale === "ko" ? "en_US" : "ko_KR"],
      images: [
        {
          url: "/og",
          width: 1200,
          height: 630,
          alt: "Jamie — Jongmin Chung",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Jamie — Jongmin Chung",
      description,
      images: ["/og"],
    },
  };
}

/** `HomePage` 페이지 UI를 렌더링함 */
export default async function HomePage({
  params,
}: PageProps<"/home/[locale]">) {
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
      <PersonStructuredData locale={locale} />
    </>
  );
}
