import Image from "next/image";
import Link from "next/link";
import type { ContentManifestEntry, Locale } from "#lib/content-model";
import { createOgImageHref, displayTitleFor } from "#lib/content-model";
import { techSectionLabels } from "#lib/tech/copy";
import styles from "./DocumentCard.module.css";

export type DocumentCardVariant = "featured" | "list" | "related";

/** `DocumentCard` UI 컴포넌트를 렌더링함 */
export function DocumentCard({
    document,
    locale,
    variant,
    label,
    eager = false,
}: {
    readonly document: ContentManifestEntry;
    readonly locale: Locale;
    readonly variant: DocumentCardVariant;
    readonly label?: string;
    readonly eager?: boolean;
}): React.JSX.Element {
    const title = displayTitleFor(document);
    return (
        <Link
            aria-label={title}
            className={styles.card}
            data-variant={variant}
            href={document.href}
        >
            <Image
                alt=""
                aria-hidden="true"
                className={styles.image}
                height={630}
                preload={eager}
                src={createOgImageHref(locale, document.id)}
                width={1200}
            />
            <span className={styles.body}>
                <span className={styles.eyebrow}>
                    {label === undefined
                        ? techSectionLabels[locale][document.section]
                        : label}
                    <span aria-hidden="true">·</span>
                    <time dateTime={document.updatedAt}>
                        {document.updatedAt}
                    </time>
                    <span aria-hidden="true">·</span>
                    {document.status}
                </span>
                <span className={styles.title}>{title}</span>
                <span className={styles.description}>
                    {document.description}
                </span>
            </span>
        </Link>
    );
}
