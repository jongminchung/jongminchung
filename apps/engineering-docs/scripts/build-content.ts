import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "@mdx-js/mdx";
import matter from "gray-matter";
import { toString } from "hast-util-to-string";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import ts from "typescript";
import { visit } from "unist-util-visit";
import {
    compareDocumentMetadata,
    createDocHref,
    createDocumentKey,
    locales,
    parseDocMetadata,
    sections,
    type ContentManifestEntry,
    type DocMetadata,
    type Locale,
    type OutlineEntry,
    type SearchDocument,
} from "../lib/content-model.ts";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(appRoot, "../..");
const contentRoot = resolve(appRoot, "content");
const manifestPath = resolve(appRoot, "generated/content-manifest.json");
const loaderRegistryPath = resolve(appRoot, "generated/document-loaders.ts");
const searchRoot = resolve(appRoot, "public/search");

export interface SourceDocument {
    readonly metadata: DocMetadata;
    readonly body: string;
    readonly filePath: string;
    readonly outline: readonly OutlineEntry[];
    readonly relativePath: string;
}

interface PackageManifest {
    readonly name?: unknown;
    readonly version?: unknown;
    readonly exports?: unknown;
}

interface PackageApi {
    readonly name: string;
    readonly version: string;
    readonly symbols: readonly string[];
}

export interface GeneratedFile {
    readonly filePath: string;
    readonly contents: string;
}

type GenerationMode = "check" | "write";
type ReadTextFile = (filePath: string) => Promise<string | null>;
type HastNode = Parameters<typeof toString>[0];
type HeadingElement = HastNode & {
    readonly type: "element";
    readonly tagName: "h2" | "h3";
    readonly properties: Readonly<Record<string, unknown>>;
};

function toPosixPath(value: string): string {
    return value.split(sep).join("/");
}

async function listFiles(directory: string): Promise<readonly string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(async (entry): Promise<readonly string[]> => {
            const entryPath = resolve(directory, entry.name);
            return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
        }),
    );
    return files
        .flat()
        .filter((filePath) => extname(filePath) === ".mdx")
        .sort();
}

function isHeadingElement(node: {
    readonly type: string;
}): node is HeadingElement {
    if (node.type !== "element") return false;
    const candidate = node as {
        readonly tagName?: unknown;
        readonly properties?: unknown;
    };
    return (
        (candidate.tagName === "h2" || candidate.tagName === "h3") &&
        typeof candidate.properties === "object" &&
        candidate.properties !== null
    );
}

export async function createOutline(
    body: string,
): Promise<readonly OutlineEntry[]> {
    const outline: OutlineEntry[] = [];
    const collectOutline =
        () =>
        (tree: Parameters<typeof visit>[0]): void => {
            visit(tree, (node) => {
                if (!isHeadingElement(node)) return;
                const id = node.properties.id;
                if (typeof id !== "string" || id.length === 0) {
                    throw new Error(
                        `Generated heading "${toString(node)}" has no ID.`,
                    );
                }
                outline.push(
                    Object.freeze({
                        id,
                        label: toString(node),
                        level: node.tagName === "h2" ? 2 : 3,
                    }),
                );
            });
        };

    await compile(body, {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, collectOutline],
    });
    return Object.freeze(outline);
}

function createSearchBody(body: string): string {
    return body
        .replace(/^---[\s\S]*?---/u, "")
        .replace(/```[\s\S]*?```/gu, " ")
        .replace(/<[^>]+>/gu, " ")
        .replace(/[#>*_`~\u005b\u005d()|]/gu, " ")
        .replace(/\s+/gu, " ")
        .trim();
}

export async function readDocuments(): Promise<readonly SourceDocument[]> {
    const files = await listFiles(contentRoot);
    return Promise.all(
        files.map(async (filePath): Promise<SourceDocument> => {
            const source = await readFile(filePath, "utf8");
            const parsed = matter(source);
            const relativePath = toPosixPath(relative(contentRoot, filePath));
            const metadata = parseDocMetadata(parsed.data, relativePath);
            const expectedPath = `${metadata.locale}/${metadata.id}.mdx`;
            if (relativePath !== expectedPath) {
                throw new Error(
                    `${relativePath}: expected path ${expectedPath} from metadata.`,
                );
            }
            return Object.freeze({
                metadata,
                body: parsed.content,
                filePath,
                outline: await createOutline(parsed.content),
                relativePath,
            });
        }),
    );
}

const localizedMetadataFields = [
    "section",
    "order",
    "status",
    "tags",
    "packageName",
    "packageVersion",
    "apiSymbols",
] as const satisfies readonly (keyof DocMetadata)[];

export function validateDocuments(documents: readonly SourceDocument[]): void {
    const byId = new Map<string, Map<Locale, DocMetadata>>();
    const hrefs = new Set<string>();
    const orders = new Set<string>();

    for (const document of documents) {
        const { metadata } = document;
        const href = createDocHref(metadata.locale, metadata.id);
        if (hrefs.has(href)) throw new Error(`Duplicate document URL: ${href}`);
        hrefs.add(href);

        const orderKey = `${metadata.locale}:${metadata.section}:${metadata.order}`;
        if (orders.has(orderKey))
            throw new Error(`Duplicate navigation order: ${orderKey}`);
        orders.add(orderKey);

        const localized =
            byId.get(metadata.id) ?? new Map<Locale, DocMetadata>();
        localized.set(metadata.locale, metadata);
        byId.set(metadata.id, localized);
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

function resolveExportTarget(value: unknown): string | null {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
        for (const item of value) {
            const target = resolveExportTarget(item);
            if (target !== null) return target;
        }
        return null;
    }
    if (typeof value !== "object" || value === null) return null;
    const record = value as Readonly<Record<string, unknown>>;
    for (const condition of ["source", "types", "import", "default"]) {
        const target = resolveExportTarget(record[condition]);
        if (target !== null) return target;
    }
    return null;
}

function createSpecifier(packageName: string, subpath: string): string {
    return subpath === "."
        ? packageName
        : `${packageName}/${subpath.replace(/^\.\//u, "")}`;
}

async function readPackageApi(packageDirectory: string): Promise<PackageApi> {
    const packageRoot = resolve(workspaceRoot, "packages", packageDirectory);
    const manifest = JSON.parse(
        await readFile(resolve(packageRoot, "package.json"), "utf8"),
    ) as PackageManifest;
    if (
        typeof manifest.name !== "string" ||
        typeof manifest.version !== "string" ||
        manifest.version.length === 0 ||
        typeof manifest.exports !== "object" ||
        !manifest.exports
    ) {
        throw new Error(`${packageDirectory}: invalid package manifest.`);
    }
    const packageName = manifest.name;

    const entries = Object.entries(
        manifest.exports as Readonly<Record<string, unknown>>,
    ).flatMap(([subpath, value]) => {
        const target = resolveExportTarget(value);
        if (target === null || !/\.[cm]?[jt]sx?$/u.test(target)) return [];
        return [
            {
                specifier: createSpecifier(packageName, subpath),
                filePath: resolve(packageRoot, target),
            },
        ];
    });
    const configPath = resolve(workspaceRoot, "tsconfig.json");
    const configFile = ts.readConfigFile(configPath, (fileName) =>
        ts.sys.readFile(fileName),
    );
    if (configFile.error !== undefined) {
        throw new Error(
            ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"),
        );
    }
    const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        workspaceRoot,
    );
    const program = ts.createProgram({
        rootNames: [
            ...new Set([
                ...parsedConfig.fileNames,
                ...entries.map((entry) => entry.filePath),
            ]),
        ],
        options: parsedConfig.options,
    });
    const checker = program.getTypeChecker();

    const symbols = entries
        .flatMap((entry) => {
            const sourceFile = program.getSourceFile(entry.filePath);
            const moduleSymbol =
                sourceFile === undefined
                    ? undefined
                    : checker.getSymbolAtLocation(sourceFile);
            if (moduleSymbol === undefined) {
                throw new Error(
                    `Cannot inspect public API at ${entry.filePath}.`,
                );
            }
            return checker
                .getExportsOfModule(moduleSymbol)
                .map((symbol) => `${entry.specifier}#${symbol.name}`);
        })
        .sort();
    return Object.freeze({
        name: packageName,
        version: manifest.version,
        symbols: Object.freeze(symbols),
    });
}

export function validatePackageVersions(
    documents: readonly SourceDocument[],
    packageContract: Pick<PackageApi, "name" | "version">,
): void {
    for (const document of documents) {
        if (document.metadata.packageName !== packageContract.name) continue;
        if (document.metadata.packageVersion !== packageContract.version) {
            throw new Error(
                `${document.relativePath}: documented package version ${
                    document.metadata.packageVersion ?? "(missing)"
                } does not match ${packageContract.name}@${packageContract.version}.`,
            );
        }
    }
}

async function validatePackageApi(
    documents: readonly SourceDocument[],
): Promise<void> {
    for (const packageDirectory of ["tooling"] as const) {
        const actualPackage = await readPackageApi(packageDirectory);
        const packageName = actualPackage.name;
        validatePackageVersions(documents, actualPackage);
        const packageDocuments = documents.filter(
            ({ metadata }) => metadata.packageName === packageName,
        );
        const documented = new Set(
            packageDocuments.flatMap(
                ({ metadata }) => metadata.apiSymbols ?? [],
            ),
        );
        const actual = new Set(actualPackage.symbols);
        const missing = [...actual].filter((symbol) => !documented.has(symbol));
        const stale = [...documented].filter((symbol) => !actual.has(symbol));
        if (missing.length > 0 || stale.length > 0) {
            throw new Error(
                [
                    `${packageName} API documentation is out of sync.`,
                    missing.length === 0
                        ? ""
                        : `Missing: ${missing.join(", ")}`,
                    stale.length === 0 ? "" : `Stale: ${stale.join(", ")}`,
                ]
                    .filter(Boolean)
                    .join("\n"),
            );
        }
    }
}

function createGeneratedFiles(
    documents: readonly SourceDocument[],
): readonly GeneratedFile[] {
    const manifest: readonly ContentManifestEntry[] = documents
        .map(({ metadata, outline }) => ({
            ...metadata,
            href: createDocHref(metadata.locale, metadata.id),
            outline,
        }))
        .sort(compareDocumentMetadata);

    const searchFiles = locales.map((locale): GeneratedFile => {
        const searchDocuments: readonly SearchDocument[] = documents
            .filter(({ metadata }) => metadata.locale === locale)
            .sort((left, right) =>
                compareDocumentMetadata(left.metadata, right.metadata),
            )
            .map(({ metadata, body, outline }) => ({
                id: metadata.id,
                locale: metadata.locale,
                section: metadata.section,
                title: metadata.title,
                description: metadata.description,
                href: createDocHref(metadata.locale, metadata.id),
                headings: outline.map((item) => item.label),
                tags: metadata.tags,
                apiSymbols: metadata.apiSymbols ?? [],
                body: createSearchBody(body),
                order: metadata.order,
            }));
        return {
            filePath: resolve(searchRoot, `${locale}.json`),
            contents: `${JSON.stringify(searchDocuments, null, 2)}\n`,
        };
    });

    const loaderEntries = [...documents]
        .sort((left, right) =>
            compareDocumentMetadata(left.metadata, right.metadata),
        )
        .map(({ metadata, relativePath }) => {
            const key = createDocumentKey(metadata.locale, metadata.id);
            return `  ${JSON.stringify(key)}: () => import(${JSON.stringify(`../content/${relativePath}`)}),`;
        });
    const loaderRegistry = [
        'import type { ComponentType } from "react";',
        "",
        "interface MdxModule {",
        "  readonly default: ComponentType;",
        "}",
        "",
        "export const documentLoaders = {",
        ...loaderEntries,
        "} as const satisfies Readonly<Record<string, () => Promise<MdxModule>>>;",
        "",
        "export type DocumentLoaderKey = keyof typeof documentLoaders;",
        "",
    ].join("\n");

    return [
        {
            filePath: manifestPath,
            contents: `${JSON.stringify(manifest, null, 2)}\n`,
        },
        { filePath: loaderRegistryPath, contents: loaderRegistry },
        ...searchFiles,
    ];
}

async function writeGeneratedFiles(
    files: readonly GeneratedFile[],
): Promise<void> {
    await Promise.all(
        files.map(async ({ filePath, contents }) => {
            await mkdir(dirname(filePath), { recursive: true });
            await writeFile(filePath, contents, "utf8");
        }),
    );
}

function hasErrorCode(error: unknown, code: string): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === code
    );
}

async function readGeneratedFile(filePath: string): Promise<string | null> {
    try {
        return await readFile(filePath, "utf8");
    } catch (error: unknown) {
        if (hasErrorCode(error, "ENOENT")) return null;
        throw error;
    }
}

export async function checkGeneratedFiles(
    files: readonly GeneratedFile[],
    readTextFile: ReadTextFile = readGeneratedFile,
): Promise<void> {
    const comparisons = await Promise.all(
        files.map(async (file) => ({
            file,
            current: await readTextFile(file.filePath),
        })),
    );
    const staleFiles = comparisons
        .filter(({ file, current }) => current !== file.contents)
        .map(({ file }) => relative(workspaceRoot, file.filePath));
    if (staleFiles.length === 0) return;
    throw new Error(
        [
            "Generated documentation data is stale:",
            ...staleFiles.map((filePath) => `- ${filePath}`),
            "Run `pnpm --filter @jongminchung/engineering-docs content:build`.",
        ].join("\n"),
    );
}

function parseGenerationMode(args: readonly string[]): GenerationMode {
    if (args.length === 1 && args[0] === "--check") return "check";
    if (args.length === 1 && args[0] === "--write") return "write";
    throw new Error("Usage: node scripts/build-content.ts --check|--write");
}

async function main(args: readonly string[]): Promise<void> {
    const mode = parseGenerationMode(args);
    const documents = await readDocuments();
    validateDocuments(documents);
    await validatePackageApi(documents);
    const files = createGeneratedFiles(documents);
    if (mode === "write") await writeGeneratedFiles(files);
    else await checkGeneratedFiles(files);
    process.stdout.write(
        `Validated ${documents.length} localized documents.\n`,
    );
}

function isMainModule(): boolean {
    const entryPath = process.argv[1];
    return (
        entryPath !== undefined &&
        resolve(entryPath) === fileURLToPath(import.meta.url)
    );
}

if (isMainModule()) await main(process.argv.slice(2));
