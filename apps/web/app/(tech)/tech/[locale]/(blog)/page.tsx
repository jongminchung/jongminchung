import { notFound } from "next/navigation";
import { isLocale, locales } from "#lib/content-model";
import { getLocalizedDocuments } from "#lib/documents";
import { blogIndexMetadata } from "#lib/tech/metadata";
import { BlogIndex } from "#tech-components/BlogIndex";
import { DocsShell } from "#tech-components/DocsShell";

export const instant = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** Blog index 메타데이터를 생성함 */
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ readonly locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return blogIndexMetadata(locale);
}

/** 독립 Blog index를 렌더링함 */
export default async function BlogPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const alternate = locale === "ko" ? "en" : "ko";
  return (
    <DocsShell alternateHref={`/${alternate}`} locale={locale}>
      <BlogIndex
        documents={await getLocalizedDocuments(locale)}
        locale={locale}
        searchParams={await searchParams}
      />
    </DocsShell>
  );
}
