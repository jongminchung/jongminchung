import type { Locale } from "#lib/content-model";
import type { LoadedDocument } from "#lib/documents";
import { DocumentOutline } from "./DocumentOutline";
import { DocumentPageHeader } from "./DocumentPageHeader";
import { DocumentPager } from "./DocumentPager";
import { RelatedDocuments } from "./RelatedDocuments";
import styles from "./DocumentPage.module.css";

export function DocumentPage({
    locale,
    document,
}: {
    readonly locale: Locale;
    readonly document: LoadedDocument;
}) {
    const { metadata, Content, previous, next } = document;
    const isOverview = metadata.id === "overview";
    return (
        <div className="mx-auto grid w-full max-w-[1160px] grid-cols-[minmax(0,1fr)_224px] gap-8 px-[50px] pt-[50px] pb-24 max-[1400px]:block max-[1400px]:max-w-[860px] max-[1400px]:px-8 min-[769px]:max-[1024px]:pt-7 max-[600px]:px-4 max-[600px]:pt-8 max-[600px]:pb-[72px]">
            <article
                className={
                    isOverview
                        ? "col-span-full min-w-0"
                        : "min-w-0 w-full max-w-[80ch] justify-self-center text-[14px]"
                }
                lang={locale}
            >
                {isOverview ? null : (
                    <DocumentPageHeader locale={locale} document={document} />
                )}
                <div
                    className={`${styles.prose} ${isOverview ? "" : "pt-[18px]"}`}
                    data-docs-prose="true"
                >
                    <Content />
                </div>
                {isOverview ? null : (
                    <RelatedDocuments
                        documents={document.related}
                        locale={locale}
                    />
                )}
                <DocumentPager
                    locale={locale}
                    previous={previous}
                    next={next}
                />
            </article>
            {isOverview ? null : (
                <DocumentOutline locale={locale} items={metadata.outline} />
            )}
        </div>
    );
}
