import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import manifest from "../generated/content-manifest.json";
import { documentLoaders } from "../generated/document-loaders";
import { createDocumentKey } from "../lib/content-model";
import englishSearch from "../public/search/en.json";
import koreanSearch from "../public/search/ko.json";
import { checkGeneratedFiles, readDocuments, validateDocuments } from "./build-content";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("documentation content contract", () => {
  it("keeps one Korean and English document for every ID", () => {
    const localesById = new Map<string, Set<string>>();
    for (const document of manifest) {
      const locales = localesById.get(document.id) ?? new Set<string>();
      locales.add(document.locale);
      localesById.set(document.id, locales);
    }
    for (const locales of localesById.values()) expect([...locales].sort()).toEqual(["en", "ko"]);
  });

  it("keeps source, manifest, loader, and search documents in one-to-one correspondence", async () => {
    const sources = await readDocuments();
    const sourceKeys = sources.map(({ metadata }) =>
      createDocumentKey(metadata.locale, metadata.id),
    );
    const manifestKeys = manifest.map(({ locale, id }) => createDocumentKey(locale, id));
    const loaderKeys = Object.keys(documentLoaders);
    const searchDocuments = [...englishSearch, ...koreanSearch];
    const searchKeys = searchDocuments.map(({ locale, id }) => createDocumentKey(locale, id));
    const sorted = (values: readonly string[]): readonly string[] => [...values].sort();

    expect(sorted(manifestKeys)).toEqual(sorted(sourceKeys));
    expect(sorted(loaderKeys)).toEqual(sorted(sourceKeys));
    expect(sorted(searchKeys)).toEqual(sorted(sourceKeys));

    const manifestByKey = new Map(
      manifest.map((document) => [createDocumentKey(document.locale, document.id), document]),
    );
    for (const searchDocument of searchDocuments) {
      const key = createDocumentKey(searchDocument.locale, searchDocument.id);
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
        apiSymbols: manifestDocument?.apiSymbols ?? [],
      });
    }
  });

  it("validates schema, URLs, order, links, search output, and package API coverage", () => {
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

  it("rejects locale metadata drift and non-contiguous navigation order", async () => {
    const documents = await readDocuments();
    expect(() => validateDocuments(documents)).not.toThrow();

    const inconsistentStatus = documents.map((document) =>
      document.metadata.locale === "ko" && document.metadata.id === "handbook/app-icons"
        ? {
            ...document,
            metadata: { ...document.metadata, status: "experimental" as const },
          }
        : document,
    );
    expect(() => validateDocuments(inconsistentStatus)).toThrow(
      'handbook/app-icons has inconsistent "status" across locales',
    );

    const nonContiguousOrder = documents.map((document) =>
      document.metadata.section === "handbook" && document.metadata.order === 2
        ? { ...document, metadata: { ...document.metadata, order: 3 } }
        : document,
    );
    expect(() => validateDocuments(nonContiguousOrder)).toThrow(
      "Navigation section ko:handbook must use contiguous order values from 0",
    );
  });

  it("rejects stale generated documentation data", async () => {
    const readStaleFile = (): Promise<string> => Promise.resolve("stale\n");
    await expect(
      checkGeneratedFiles(
        [
          {
            filePath: resolve(appRoot, "generated/document-loaders.ts"),
            contents: "current\n",
          },
        ],
        readStaleFile,
      ),
    ).rejects.toThrow(/document-loaders\.ts.*content:build/su);
  });
});
