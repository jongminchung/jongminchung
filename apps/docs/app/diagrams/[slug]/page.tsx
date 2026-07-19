import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExcalidrawDiagram } from "@/components/ExcalidrawDiagram";
import {
  findStandaloneExcalidrawAsset,
  listStandaloneExcalidrawAssets,
} from "@/lib/excalidraw-files";
import styles from "./page.module.css";

interface PageProps {
  readonly params: Promise<{ readonly slug: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ readonly slug: string }[]> {
  const assets = await listStandaloneExcalidrawAssets();
  return assets.map((asset) => ({ slug: asset.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const asset = await findStandaloneExcalidrawAsset(slug);
  if (asset === null) return {};
  return {
    title: { absolute: asset.filename },
    alternates: { canonical: `/diagrams/${asset.slug}` },
  };
}

export default async function StandaloneExcalidrawPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  const asset = await findStandaloneExcalidrawAsset(slug);
  if (asset === null) notFound();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link aria-label="All diagrams" className={styles.backLink} href="/diagrams">
          Diagrams
        </Link>
        <h1 className={styles.title}>{asset.filename}</h1>
      </header>
      <div className={styles.viewer}>
        <ExcalidrawDiagram ariaLabel={asset.filename} src={asset.src} variant="standalone" />
      </div>
    </main>
  );
}
