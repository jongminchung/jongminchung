import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsShell } from "@/components/DocsShell";
import { DocumentPage } from "@/components/DocumentPage";
import {
  type ContentManifestEntry,
  type CurrentNavigationEntry,
  isLocale,
  type NavigationEntry,
} from "@/lib/content-model";
import { documents, findDocument, getLocalizedDocuments, loadDocument } from "@/lib/documents";

interface PageProps {
  readonly params: Promise<{
    readonly locale: string;
    readonly slug: readonly string[];
  }>;
}

function idFromSlug(slug: readonly string[]): string {
  return slug.join("/");
}

function toNavigationEntry(document: ContentManifestEntry): NavigationEntry {
  return Object.freeze({
    id: document.id,
    section: document.section,
    title: document.title,
    ...(document.displayTitle === undefined ? {} : { displayTitle: document.displayTitle }),
    href: document.href,
  });
}

function toCurrentNavigationEntry(document: ContentManifestEntry): CurrentNavigationEntry {
  return Object.freeze({
    ...toNavigationEntry(document),
    outline: document.outline,
  });
}

export const dynamicParams = false;

export function generateStaticParams() {
  return documents.map((document) => ({
    locale: document.locale,
    slug: document.id.split("/"),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const id = idFromSlug(slug);
  const document = findDocument(locale, id);
  if (document === null) notFound();
  return {
    title: document.title,
    description: document.description,
    alternates: {
      canonical: document.href,
      languages: {
        ko: `/ko/${document.id}`,
        en: `/en/${document.id}`,
      },
    },
    openGraph: {
      type: "article",
      title: document.title,
      description: document.description,
      locale: document.locale === "ko" ? "ko_KR" : "en_US",
      url: document.href,
    },
  };
}

export default async function DocsPage({ params }: PageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const id = idFromSlug(slug);
  const document = await loadDocument(locale, id);
  if (document === null) notFound();
  const navigationEntries = getLocalizedDocuments(locale).map(toNavigationEntry);
  return (
    <DocsShell
      locale={locale}
      current={toCurrentNavigationEntry(document.metadata)}
      documents={navigationEntries}
    >
      <DocumentPage locale={locale} document={document} />
    </DocsShell>
  );
}

export const preferredRegion = "auto";
