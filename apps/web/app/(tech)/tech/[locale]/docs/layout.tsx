import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isLocale } from "#lib/content-model";
import { getDocsPages } from "#lib/documents";
import { docsSource } from "#lib/fumadocs-source";
import { publicPageTree } from "#lib/tech/publication";
import { DocsShell } from "#tech-components/DocsShell";
import { TechDocsMobileHeader } from "#tech-components/TechDocsMobileHeader";
import { TechFumadocsProvider } from "#tech-components/TechFumadocsProvider";

/** Fumadocs page tree와 Jamie editorial shell을 결합함 */
export default async function TechDocsLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ readonly locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const alternate = locale === "ko" ? "en" : "ko";
  const publicUrls = new Set(
    (await getDocsPages())
      .filter((page) => page.locale === locale)
      .map((page) => page.href),
  );
  return (
    <DocsShell
      active="docs"
      alternateHref={`/${alternate}/docs`}
      locale={locale}
    >
      <TechFumadocsProvider>
        <DocsLayout
          nav={{ enabled: false }}
          searchToggle={{ enabled: false }}
          sidebar={{ defaultOpenLevel: 1 }}
          tabs={false}
          themeSwitch={{ enabled: false }}
          tree={publicPageTree(docsSource.getPageTree(locale), publicUrls)}
        >
          <TechDocsMobileHeader locale={locale} />
          {children}
        </DocsLayout>
      </TechFumadocsProvider>
    </DocsShell>
  );
}
