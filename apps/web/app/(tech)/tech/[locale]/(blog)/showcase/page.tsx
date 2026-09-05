import { notFound } from "next/navigation";
import { isLocale, locales } from "#lib/content-model";
import { alternateLocale } from "#lib/locale";
import { getTechMessages } from "#lib/tech/copy";
import { techPageMetadata } from "#lib/tech/metadata";
import { DocsShell } from "#tech-components/DocsShell";
import { ShowcasePage } from "#tech-components/ShowcasePage";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/tech/[locale]/showcase">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const text = getTechMessages(locale).metadata;
  return techPageMetadata({
    title: text.showcaseTitle,
    description: text.showcaseDescription,
    locale,
    canonical: `/${locale}/showcase`,
    alternatePaths: { ko: "/ko/showcase", en: "/en/showcase" },
    imageId: "showcase",
  });
}

export default async function Page({
  params,
}: PageProps<"/tech/[locale]/showcase">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const alternate = alternateLocale(locale);
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
