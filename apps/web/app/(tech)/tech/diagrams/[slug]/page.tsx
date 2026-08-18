import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
    findStandaloneExcalidrawAsset,
    listStandaloneExcalidrawAssets,
} from "#lib/tech/excalidraw-files";
import { ExcalidrawDiagram } from "#tech-components/ExcalidrawDiagram";
import styles from "./page.module.css";

interface PageProps {
    readonly params: Promise<{ readonly slug: string }>;
}

export const dynamicParams = false;

/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export async function generateStaticParams(): Promise<
    { readonly slug: string }[]
> {
    const assets = await listStandaloneExcalidrawAssets();
    return assets.map((asset) => ({ slug: asset.slug }));
}

/** 경로 매개변수에 맞는 페이지 메타데이터를 생성함 */
export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const asset = await findStandaloneExcalidrawAsset(slug);
    if (asset === null) return {};
    return {
        title: { absolute: asset.filename },
        alternates: { canonical: `/diagrams/${asset.slug}` },
    };
}

/** `StandaloneExcalidrawPage` 페이지 UI를 렌더링함 */
export default async function StandaloneExcalidrawPage({
    params,
}: PageProps): Promise<React.JSX.Element> {
    const { slug } = await params;
    const asset = await findStandaloneExcalidrawAsset(slug);
    if (asset === null) notFound();

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <Link
                    aria-label="All diagrams"
                    className={styles.backLink}
                    href="/diagrams"
                >
                    Diagrams
                </Link>
                <h1 className={styles.title}>{asset.filename}</h1>
            </header>
            <div className={styles.viewer}>
                <ExcalidrawDiagram
                    ariaLabel={asset.filename}
                    src={asset.src}
                    variant="standalone"
                />
            </div>
        </main>
    );
}
