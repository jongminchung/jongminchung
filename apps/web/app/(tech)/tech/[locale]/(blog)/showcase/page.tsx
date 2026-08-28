import { notFound } from "next/navigation";
import { isLocale, locales } from "#lib/content-model";
import { techPageMetadata } from "#lib/tech/metadata";
import { DocsShell } from "#tech-components/DocsShell";
import { ShowcasePage } from "#tech-components/ShowcasePage";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ readonly locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return techPageMetadata({
    title: locale === "ko" ? "애니메이션 쇼케이스" : "Animation Showcase",
    description:
      locale === "ko"
        ? "인터랙티브 타임라인과 코드 기반 설명 애니메이션의 제작 모델을 비교합니다."
        : "Compare interactive timelines with code-authored explanatory animation.",
    locale,
    canonical: `/${locale}/showcase`,
    alternatePaths: { ko: "/ko/showcase", en: "/en/showcase" },
    imageId: "showcase",
  });
}

export default async function Page({
  params,
}: {
  readonly params: Promise<{ readonly locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const alternate = locale === "ko" ? "en" : "ko";
  return (
    <DocsShell
      active="showcase"
      alternateHref={`/${alternate}/showcase`}
      locale={locale}
    >
      <ShowcasePage locale={locale} />
    </DocsShell>
  );
}
