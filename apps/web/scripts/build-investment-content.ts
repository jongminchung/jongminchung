import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import {
    createInvestmentNoteHref,
    parseInvestmentNoteMetadata,
    validateInvestmentNoteBody,
    type InvestmentNoteManifestEntry,
    type InvestmentNoteMetadata,
} from "../lib/investment-content.ts";
import { locales, type Locale } from "../lib/site-routing.ts";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(appRoot, "../..");
const contentRoot = resolve(appRoot, "content/invest");
const manifestPath = resolve(appRoot, "generated/investment-manifest.json");
const loadersPath = resolve(appRoot, "generated/investment-loaders.ts");

interface SourceNote {
    readonly metadata: InvestmentNoteMetadata;
    readonly relativePath: string;
}

interface GeneratedFile {
    readonly filePath: string;
    readonly contents: string;
}

async function listMdxFiles(directory: string): Promise<readonly string[]> {
    try {
        const entries = await readdir(directory, { withFileTypes: true });
        const nested = await Promise.all(
            entries.map(async (entry) => {
                const path = resolve(directory, entry.name);
                return entry.isDirectory()
                    ? listMdxFiles(path)
                    : entry.name.endsWith(".mdx")
                      ? [path]
                      : [];
            }),
        );
        return nested.flat().sort();
    } catch (error: unknown) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "ENOENT"
        )
            return [];
        throw error;
    }
}

export async function readInvestmentNotes(): Promise<readonly SourceNote[]> {
    const files = await listMdxFiles(contentRoot);
    return Promise.all(
        files.map(async (filePath) => {
            const parsed = matter(await readFile(filePath, "utf8"));
            const metadata = parseInvestmentNoteMetadata(
                parsed.data,
                relative(workspaceRoot, filePath),
            );
            validateInvestmentNoteBody(
                parsed.content,
                relative(workspaceRoot, filePath),
            );
            const relativePath = relative(contentRoot, filePath)
                .split(sep)
                .join("/");
            const expectedPath = `${metadata.locale}/notes/${metadata.id}.mdx`;
            if (relativePath !== expectedPath)
                throw new Error(`${relativePath}: expected ${expectedPath}.`);
            return Object.freeze({ metadata, relativePath });
        }),
    );
}

export function validateInvestmentTranslations(
    notes: readonly SourceNote[],
): void {
    const byId = new Map<string, Map<Locale, InvestmentNoteMetadata>>();
    for (const note of notes) {
        const localized =
            byId.get(note.metadata.id) ??
            new Map<Locale, InvestmentNoteMetadata>();
        if (localized.has(note.metadata.locale))
            throw new Error(
                `Duplicate investment note ${note.metadata.locale}/${note.metadata.id}.`,
            );
        localized.set(note.metadata.locale, note.metadata);
        byId.set(note.metadata.id, localized);
    }
    for (const [id, localized] of byId) {
        const missing = locales.filter((locale) => !localized.has(locale));
        if (missing.length > 0)
            throw new Error(
                `Investment note ${id} is missing locales: ${missing.join(", ")}.`,
            );
        const reference = localized.get("ko");
        const translation = localized.get("en");
        if (
            reference?.publishedAt !== translation?.publishedAt ||
            reference?.status !== translation?.status ||
            JSON.stringify(reference?.tags) !==
                JSON.stringify(translation?.tags) ||
            reference?.series !== translation?.series
        ) {
            throw new Error(
                `Investment note ${id} has inconsistent shared metadata.`,
            );
        }
    }
}

function createGeneratedFiles(
    notes: readonly SourceNote[],
): readonly GeneratedFile[] {
    const manifest: readonly InvestmentNoteManifestEntry[] = notes
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
    const entries = notes
        .toSorted((left, right) =>
            left.relativePath.localeCompare(right.relativePath),
        )
        .map(
            ({ metadata, relativePath }) =>
                `    ${JSON.stringify(`${metadata.locale}/${metadata.id}`)}: () => import(${JSON.stringify(`../content/invest/${relativePath}`)}),`,
        );
    const loaders = [
        'import type { ComponentType } from "react";',
        "",
        "interface InvestmentMdxModule { readonly default: ComponentType; }",
        "",
        "export const investmentLoaders: Readonly<Record<string, () => Promise<InvestmentMdxModule>>> = {",
        ...entries,
        "};",
        "",
        "export type InvestmentLoaderKey = string;",
        "",
    ].join("\n");
    return [
        {
            filePath: manifestPath,
            contents: `${JSON.stringify(manifest, null, 2)}\n`,
        },
        { filePath: loadersPath, contents: loaders },
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

async function checkGeneratedFiles(
    files: readonly GeneratedFile[],
): Promise<void> {
    const stale: string[] = [];
    for (const file of files) {
        let current: string | null = null;
        try {
            current = await readFile(file.filePath, "utf8");
        } catch (error: unknown) {
            if (
                !(
                    typeof error === "object" &&
                    error !== null &&
                    "code" in error &&
                    error.code === "ENOENT"
                )
            )
                throw error;
        }
        if (current !== file.contents)
            stale.push(relative(workspaceRoot, file.filePath));
    }
    if (stale.length > 0)
        throw new Error(
            `Generated investment data is stale:\n${stale.join("\n")}\nRun \`pnpm --filter @jongminchung/web run investment:build\`.`,
        );
}

async function main(args: readonly string[]): Promise<void> {
    const mode = args.length === 1 ? args[0] : undefined;
    if (mode !== "--write" && mode !== "--check")
        throw new Error(
            "Usage: node scripts/build-investment-content.ts --write|--check",
        );
    const notes = await readInvestmentNotes();
    validateInvestmentTranslations(notes);
    const files = createGeneratedFiles(notes);
    if (mode === "--write") await writeGeneratedFiles(files);
    else await checkGeneratedFiles(files);
    process.stdout.write(
        `Validated ${notes.length} localized investment notes.\n`,
    );
}

const entryPath = process.argv[1];
if (
    entryPath !== undefined &&
    resolve(entryPath) === fileURLToPath(import.meta.url)
)
    await main(process.argv.slice(2));
