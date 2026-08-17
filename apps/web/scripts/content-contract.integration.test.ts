import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import manifest from "../generated/content-manifest.json";
import { documentLoaders } from "../generated/document-loaders";
import investmentManifest from "../generated/investment-manifest.json";
import {
    contentManifestEntrySchema,
    createDocumentKey,
    searchDocumentSchema,
} from "../lib/content-model";
import { investmentNoteManifestEntrySchema } from "../lib/investment-content";
import englishSearch from "../public/search/en.json";
import koreanSearch from "../public/search/ko.json";
import {
    checkGeneratedFiles,
    createOutline,
    readDocuments,
    validateDocuments,
} from "./build-content";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("문서 내용 계약", () => {
    it("[성공] 생성된 모든 매니페스트와 검색 문서를 공유하여 분석했습니다", () => {
        expect(() =>
            contentManifestEntrySchema.array().parse(manifest),
        ).not.toThrow();
        expect(() =>
            investmentNoteManifestEntrySchema.array().parse(investmentManifest),
        ).not.toThrow();
        expect(() =>
            searchDocumentSchema
                .array()
                .parse([...englishSearch, ...koreanSearch]),
        ).not.toThrow();
    });

    it("[성공] ID당 한글, 문서 보관 1", () => {
        const localesById = new Map<string, Set<string>>();
        for (const document of manifest) {
            const locales = localesById.get(document.id) ?? new Set<string>();
            locales.add(document.locale);
            localesById.set(document.id, locales);
        }
        for (const locales of localesById.values())
            expect([...locales].sort()).toEqual(["en", "ko"]);
    });

    it("[성공] 소스, 매니페스트, 로더 및 검색 문서를 일대일 협력으로 유지함", async () => {
        const sources = await readDocuments();
        const sourceKeys = sources.map(({ metadata }) =>
            createDocumentKey(metadata.locale, metadata.id),
        );
        const manifestKeys = manifest.map(({ locale, id }) =>
            createDocumentKey(locale, id),
        );
        const loaderKeys = Object.keys(documentLoaders);
        const searchDocuments = [...englishSearch, ...koreanSearch];
        const searchKeys = searchDocuments.map(({ locale, id }) =>
            createDocumentKey(locale, id),
        );
        const sorted = (values: readonly string[]): readonly string[] =>
            [...values].sort();

        expect(sorted(manifestKeys)).toEqual(sorted(sourceKeys));
        expect(sorted(loaderKeys)).toEqual(sorted(sourceKeys));
        expect(sorted(searchKeys)).toEqual(sorted(sourceKeys));

        const manifestByKey = new Map(
            manifest.map((document) => [
                createDocumentKey(document.locale, document.id),
                document,
            ]),
        );
        const sourceByKey = new Map(
            sources.map((document) => [
                createDocumentKey(
                    document.metadata.locale,
                    document.metadata.id,
                ),
                document,
            ]),
        );
        for (const manifestDocument of manifest) {
            const key = createDocumentKey(
                manifestDocument.locale,
                manifestDocument.id,
            );
            expect(manifestDocument.outline, key).toEqual(
                sourceByKey.get(key)?.outline,
            );
        }
        for (const searchDocument of searchDocuments) {
            const key = createDocumentKey(
                searchDocument.locale,
                searchDocument.id,
            );
            const manifestDocument = manifestByKey.get(key);
            expect(manifestDocument, key).toBeDefined();
            expect(searchDocument).toMatchObject({
                id: manifestDocument?.id,
                locale: manifestDocument?.locale,
                section: manifestDocument?.section,
                title: manifestDocument?.title,
                description: manifestDocument?.description,
                order: manifestDocument?.order,
                href: manifestDocument?.href,
                tags: manifestDocument?.tags,
                apiSymbols:
                    manifestDocument !== undefined &&
                    "apiSymbols" in manifestDocument
                        ? manifestDocument.apiSymbols
                        : [],
            });
        }
    });

    it("[성공] 확장된 MDX 본체 ID를 경기용 내부의 하우징을 무시함", async () => {
        const outline = await createOutline(`
# Ignored page title

## Issues own the reason; pull requests own the evidence

\`\`\`md
### Problem and intent
\`\`\`

## Duplicate?!
## Duplicate?!
### \`createProgram()\` details
`);

        expect(outline).toEqual([
            {
                id: "issues-own-the-reason-pull-requests-own-the-evidence",
                label: "Issues own the reason; pull requests own the evidence",
                level: 2,
            },
            { id: "duplicate", label: "Duplicate?!", level: 2 },
            { id: "duplicate-1", label: "Duplicate?!", level: 2 },
            {
                id: "createprogram-details",
                label: "createProgram() details",
                level: 3,
            },
        ]);
    });

    it("[성공], URL, 인사말, 링크 및 검색 결과를 확인함", () => {
        const output = execFileSync(
            process.execPath,
            [resolve(appRoot, "scripts/build-content.ts"), "--check"],
            {
                cwd: resolve(appRoot, "../.."),
                encoding: "utf8",
            },
        );
        expect(output).toContain("localized documents.");
    });

    it("[실패] 로케일메 데이터를 드리프트 및 비연속 감시 시간을 갖고 있음", async () => {
        const documents = await readDocuments();
        expect(() => validateDocuments(documents)).not.toThrow();

        const inconsistentStatus = documents.map((document) =>
            document.metadata.locale === "ko" &&
            document.metadata.id === "handbook/ddd"
                ? {
                      ...document,
                      metadata: {
                          ...document.metadata,
                          status: "experimental" as const,
                      },
                  }
                : document,
        );
        expect(() => validateDocuments(inconsistentStatus)).toThrow(
            'handbook/ddd has inconsistent "status" across locales',
        );

        const nonContiguousOrder = documents.map((document) =>
            document.metadata.section === "handbook" &&
            document.metadata.order === 1
                ? { ...document, metadata: { ...document.metadata, order: 2 } }
                : document,
        );
        expect(() => validateDocuments(nonContiguousOrder)).toThrow(
            "Navigation section ko:handbook must use contiguous order values from 0",
        );
    });

    it("[실패] 오래되어 생성된 문서 데이터가 있음", async () => {
        const readStaleFile = (): Promise<string> => Promise.resolve("stale\n");
        await expect(
            checkGeneratedFiles(
                [
                    {
                        filePath: resolve(
                            appRoot,
                            "generated/document-loaders.ts",
                        ),
                        contents: "current\n",
                    },
                ],
                readStaleFile,
            ),
        ).rejects.toThrow(/document-loaders\.ts.*content:build/su);
    });
});
