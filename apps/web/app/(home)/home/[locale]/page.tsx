import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HeroSection } from "#home-components/HomeHeroSection";
import { PrinciplesSection } from "#home-components/HomePrinciplesSection";
import {
  HomeFooter,
  HomeHeader,
  PersonStructuredData,
} from "#home-components/HomeShell";
import { WorkSection } from "#home-components/HomeWorkSection";
import { WritingSection } from "#home-components/HomeWritingSection";
import { getHomeMessages } from "#lib/home/content";
import { alternateLocale, getLocaleProtocol } from "#lib/locale";
import { isLocale, locales, siteOrigins } from "#lib/site-routing";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** 경로 매개변수에 맞는 페이지 메타데이터를 생성함 */
export async function generateMetadata({
  params,
}: PageProps<"/home/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const description = getHomeMessages(locale).metadataDescription;
  const url = `${siteOrigins.home}/${locale}`;
  const protocol = getLocaleProtocol(locale);
  return {
    title: "Jamie — Jongmin Chung",
    description,
    alternates: {
      canonical: url,
      languages: {
        ko: `${siteOrigins.home}/ko`,
        en: `${siteOrigins.home}/en`,
        "x-default": `${siteOrigins.home}/en`,
      },
    },
    openGraph: {
      type: "profile",
      title: "Jamie — Jongmin Chung",
      description,
      url,
      locale: protocol.openGraph,
      alternateLocale: [getLocaleProtocol(alternateLocale(locale)).openGraph],
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
