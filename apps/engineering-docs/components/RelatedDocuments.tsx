import type { ContentManifestEntry, Locale } from "#lib/content-model";
import { DocumentCard } from "./DocumentCard";
import styles from "./RelatedDocuments.module.css";

export function RelatedDocuments({
    documents,
    locale,
}: {
    readonly documents: readonly ContentManifestEntry[];
    readonly locale: Locale;
}): React.JSX.Element | null {
    if (documents.length === 0) return null;
    const title = locale === "ko" ? "관련 문서" : "Related documentation";
    return (
        <section
            aria-labelledby="related-documentation"
            className={styles.container}
        >
            <h2 className={styles.title} id="related-documentation">
                {title}
            </h2>
            <div className={styles.grid}>
                {documents.map((document) => (
                    <DocumentCard
                        document={document}
                        key={document.id}
                        locale={locale}
                        variant="related"
                    />
                ))}
            </div>
        </section>
    );
}
