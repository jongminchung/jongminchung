import type { Metadata } from "next";
import Link from "next/link";
import { listStandaloneExcalidrawAssets } from "@/lib/excalidraw-files";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: { absolute: "Diagrams" },
  alternates: { canonical: "/diagrams" },
};

export default async function DiagramsPage(): Promise<React.JSX.Element> {
  const assets = await listStandaloneExcalidrawAssets();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Excalidraw</p>
        <h1 className={styles.title}>Diagrams</h1>
      </header>

      {assets.length === 0 ? (
        <p className={styles.empty}>No diagrams available.</p>
      ) : (
        <ul className={styles.list}>
          {assets.map((asset) => (
            <li className={styles.item} key={asset.filename}>
              <Link className={styles.diagramLink} href={`/diagrams/${asset.slug}`}>
                {asset.filename}
              </Link>
              <a
                aria-label={`Download ${asset.filename}`}
                className={styles.download}
                download
                href={asset.src}
              >
                Download source
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
