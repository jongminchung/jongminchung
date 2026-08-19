import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { evaluate } from "@mdx-js/mdx";
import { cache } from "react";
import * as runtime from "react/jsx-runtime";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import {
    readInvestmentNotes,
    validateInvestmentTranslations,
} from "../scripts/build-investment-content.ts";
import {
    createSearchBody,
    readDocuments,
    type SourceDocument,
} from "../scripts/content-source.ts";
import { validateDocuments } from "../scripts/content-validation.ts";
import {
    compareDocumentMetadata,
    createDocHref,
    type ContentManifestEntry,
    type Locale,
    type SearchDocument,
} from "./content-model.ts";
import {
    createInvestmentNoteHref,
    type InvestmentNoteManifestEntry,
    type InvestmentSourceKind,
} from "./invest/content.ts";

const appRoot = process.cwd().endsWith("/apps/web")
    ? process.cwd()
    : resolve(process.cwd(), "apps/web");
const techContentRoot = resolve(appRoot, "content/tech");
const investmentContentRoot = resolve(appRoot, "content/invest");

export interface ContentSnapshot {
    readonly documents: readonly ContentManifestEntry[];
    readonly sources: ReadonlyMap<string, SourceDocument>;
    readonly investmentNotes: readonly InvestmentNoteManifestEntry[];
}

let productionSnapshot: Promise<ContentSnapshot> | undefined;

function documentKey(locale: Locale, id: string): string {
    return `${locale}/${id}`;
}

async function createContentSnapshot(): Promise<ContentSnapshot> {
    const sourceDocuments = await readDocuments();
    validateDocuments(sourceDocuments);
    const sourceNotes = await readInvestmentNotes();
    validateInvestmentTranslations(sourceNotes);

    const documents = sourceDocuments
        .map(({ metadata, outline }) => ({
            ...metadata,
            href: createDocHref(metadata.locale, metadata.id),
            outline,
        }))
        .sort(compareDocumentMetadata);
    const sources = new Map(
        sourceDocuments.map((source) => [
            documentKey(source.metadata.locale, source.metadata.id),
            source,
        ]),
    );
    const investmentNotes = sourceNotes
        .map(({ metadata }) => ({
            ...metadata,
            href: createInvestmentNoteHref(metadata.locale, metadata.id),
        }))
        .toSorted(
            (left, right) =>
                left.locale.localeCompare(right.locale) ||
                right.publishedAt.localeCompare(left.publishedAt) ||
                left.id.localeCompare(right.id),
        );

    return Object.freeze({
        documents: Object.freeze(documents),
        sources,
        investmentNotes: Object.freeze(investmentNotes),
    });
}

/** `readContentSnapshot` 데이터를 조회함 */
export function readContentSnapshot(): Promise<ContentSnapshot> {
    if (process.env.NODE_ENV === "development") return createContentSnapshot();
    productionSnapshot ??= createContentSnapshot();
    return productionSnapshot;
}

/** `renderTechMdx` 결과를 렌더링함 */
export const renderTechMdx = cache(async (locale: Locale, id: string) => {
    const filePath = resolve(techContentRoot, `${locale}/${id}.mdx`);
    const source = await readFile(filePath, "utf8");
    const { useMDXComponents } = await import("../mdx-components.tsx");
    return evaluate(source, {
        ...runtime,
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug],
        useMDXComponents,
    });
});

/** `renderInvestmentMdx` 결과를 렌더링함 */
export const renderInvestmentMdx = cache(async (locale: Locale, id: string) => {
    const filePath = resolve(
        investmentContentRoot,
        `${locale}/notes/${id}.mdx`,
    );
    const source = await readFile(filePath, "utf8");
    const { useMDXComponents } = await import("../mdx-components.tsx");
    return evaluate(source, {
        ...runtime,
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug],
        useMDXComponents,
    });
});

/** `createSearchDocuments` 결과를 생성함 */
export function createSearchDocuments(
    documents: readonly ContentManifestEntry[],
    sources: ReadonlyMap<string, SourceDocument>,
    locale: Locale,
): readonly SearchDocument[] {
    return documents
        .filter((document) => document.locale === locale)
        .map((document) => {
            const source = sources.get(documentKey(locale, document.id));
            if (source === undefined)
                throw new Error(`Missing source for ${locale}/${document.id}.`);
            return Object.freeze({
                id: document.id,
                locale: document.locale,
                section: document.section,
                title: document.title,
                description: document.description,
                href: document.href,
                headings: document.outline.map((item) => item.label),
                tags: document.tags,
                apiSymbols: document.apiSymbols ?? [],
                body: createSearchBody(source.body),
                order: document.order,
            });
        });
}

/** `publishedInvestmentNotes` 공개 기능을 제공함 */
export function publishedInvestmentNotes(
    notes: readonly InvestmentNoteManifestEntry[],
    locale: Locale,
): readonly InvestmentNoteManifestEntry[] {
    return notes.filter(
        (note) => note.locale === locale && note.status === "published",
    );
}

/** `notesBySource` 공개 기능을 제공함 */
export function notesBySource(
    notes: readonly InvestmentNoteManifestEntry[],
    locale: Locale,
    kind: InvestmentSourceKind,
): readonly InvestmentNoteManifestEntry[] {
    return publishedInvestmentNotes(notes, locale).filter((note) =>
        note.sources.some((source) => source.kind === kind),
    );
}
