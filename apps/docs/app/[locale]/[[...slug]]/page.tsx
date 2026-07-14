import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DocsShell } from "@/components/DocsShell";
import { DocumentPage } from "@/components/DocumentPage";
import { isLocale } from "@/lib/content-model";
import { documents, findDocument, getLocalizedDocuments, loadDocument } from "@/lib/documents";

interface PageProps {
  readonly params: Promise<{
    readonly locale: string;
    readonly slug?: readonly string[];
  }>;
}

function idFromSlug(slug: readonly string[] | undefined): string {
  return slug?.join("/") ?? "";
}

export const dynamicParams = true;

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
  if (document === null) return {};
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
  if (id.length === 0) redirect(`/${locale}/overview`);
  const document = await loadDocument(locale, id);
  if (document === null) notFound();
  return (
    <DocsShell
      locale={locale}
      current={document.metadata}
      documents={getLocalizedDocuments(locale)}
    >
      <DocumentPage locale={locale} document={document} />
    </DocsShell>
  );
}

export const preferredRegion = "auto";
