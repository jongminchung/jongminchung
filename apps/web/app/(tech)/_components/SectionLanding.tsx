import type { SectionPage } from "#lib/tech/section-pages";
import { DocumentCard } from "./DocumentCard";
import styles from "./SectionLanding.module.css";

const copy = {
    ko: {
        collection: "문서 컬렉션",
        latest: "최근 업데이트",
        all: "모든 문서",
    },
    en: {
        collection: "Documentation collection",
        latest: "Recently updated",
        all: "All documents",
    },
} as const;

/** `SectionLandingPage` 페이지 UI를 렌더링함 */
export function SectionLandingPage({
    page,
}: {
    readonly page: SectionPage;
}): React.JSX.Element {
    const featured = page.documents[0];
    if (featured === undefined)
        throw new Error(
            `Missing documents for ${page.locale}/${page.section}.`,
        );
    const remaining = page.documents.slice(1);
    const text = copy[page.locale];
    return (
        <div className={styles.page} lang={page.locale}>
            <header className={styles.header}>
                <p className={styles.rule}>{text.collection}</p>
                <h1 className={styles.title}>{page.title}</h1>
                <p className={styles.description}>{page.description}</p>
            </header>
            <section aria-labelledby="recently-updated">
                <h2 className={styles.sectionLabel} id="recently-updated">
                    {text.latest}
                </h2>
                <DocumentCard
                    document={featured}
                    eager
                    label={text.latest}
                    locale={page.locale}
                    variant="featured"
                />
            </section>
            {remaining.length === 0 ? null : (
                <section
                    aria-labelledby="all-documents"
                    className={styles.allDocuments}
                >
                    <h2 className={styles.sectionLabel} id="all-documents">
                        {text.all}
                    </h2>
                    <div className={styles.list}>
                        {remaining.map((document) => (
                            <DocumentCard
                                document={document}
                                key={document.id}
                                locale={page.locale}
                                variant="list"
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
