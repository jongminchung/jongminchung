import { relative, resolve } from "node:path";
import {
    createDocHref,
    locales,
    sections,
    type DocMetadata,
    type Locale,
} from "../lib/content-model.ts";
import type { SourceDocument } from "./content-source.ts";

const appRoot = process.cwd().endsWith("/apps/web")
    ? process.cwd()
    : resolve(process.cwd(), "apps/web");
const workspaceRoot = resolve(appRoot, "../..");

const localizedMetadataFields = [
    "section",
    "order",
    "status",
    "tags",
    "packageName",
    "packageVersion",
    "apiSymbols",
] as const satisfies readonly (keyof DocMetadata)[];

function containsBlockingTodo(body: string): boolean {
    const prose = body
        .replace(/```[\s\S]*?```/gu, "")
        .replace(/^>[^\n]*(?:\n|$)/gmu, "");
    return /\{\/\*\s*(?:TODO|FIXME)\b[\s\S]*?\*\/\}/u.test(prose);
}

/** 정규화된 기술 문서 집합의 locale·navigation·link 계약을 검증함 */
export function validateDocuments(documents: readonly SourceDocument[]): void {
    const byId = new Map<string, Map<Locale, DocMetadata>>();
    const hrefs = new Set<string>();
    const orders = new Set<string>();

    for (const document of documents) {
        const { metadata } = document;
        if (
            metadata.publicationStatus === "published" &&
            containsBlockingTodo(document.body)
        ) {
            throw new Error(
                `${document.relativePath}: published document contains a blocking TODO comment.`,
            );
        }
        const href = createDocHref(metadata.locale, metadata.id);
        if (hrefs.has(href)) throw new Error(`Duplicate document URL: ${href}`);
        hrefs.add(href);

        const orderKey = `${metadata.locale}:${metadata.section}:${metadata.order}`;
        if (orders.has(orderKey))
            throw new Error(`Duplicate navigation order: ${orderKey}`);
        orders.add(orderKey);

        const localized = byId.getOrInsertComputed(
            metadata.id,
            () => new Map<Locale, DocMetadata>(),
        );
        localized.set(metadata.locale, metadata);
    }

    for (const [id, localized] of byId) {
        const missing = locales.filter((locale) => !localized.has(locale));
        if (missing.length > 0)
            throw new Error(
                `Document ${id} is missing locales: ${missing.join(", ")}`,
            );

        const reference = localized.get(locales[0]);
        if (reference === undefined)
            throw new Error(`Document ${id} has no reference locale.`);
        for (const locale of locales.slice(1)) {
            const candidate = localized.get(locale);
            if (candidate === undefined) continue;
            for (const field of localizedMetadataFields) {
                if (
                    JSON.stringify(reference[field]) !==
                    JSON.stringify(candidate[field])
                ) {
                    throw new Error(
                        `Document ${id} has inconsistent "${field}" across locales.`,
                    );
                }
            }
        }
    }

    for (const locale of locales) {
        for (const section of sections) {
            const sectionDocuments = documents
                .filter(
                    ({ metadata }) =>
                        metadata.locale === locale &&
                        metadata.section === section,
                )
                .sort(
                    (left, right) => left.metadata.order - right.metadata.order,
                );
            if (sectionDocuments.length === 0) {
                throw new Error(
                    `Navigation section ${locale}:${section} must contain a document.`,
                );
            }
            for (const [index, document] of sectionDocuments.entries()) {
                if (document.metadata.order !== index) {
                    throw new Error(
                        `Navigation section ${locale}:${section} must use contiguous order values from 0.`,
                    );
                }
            }
        }
    }

    const knownPaths = new Set(
        documents.map(({ metadata }) =>
            createDocHref(metadata.locale, metadata.id),
        ),
    );
    for (const document of documents) {
        const internalLinks = document.body.matchAll(
            /\]\((\/(?:ko|en)\/[^)#?\s]+)(?:#[^)]*)?\)/gu,
        );
        for (const match of internalLinks) {
            const href = match[1];
            if (href !== undefined && !knownPaths.has(href)) {
                throw new Error(
                    `${relative(workspaceRoot, document.filePath)}: broken internal link ${href}`,
                );
            }
        }
    }
}
