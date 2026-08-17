import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";

export interface GeneratedFile {
    readonly filePath: string;
    readonly contents: string;
}

export type ReadTextFile = (filePath: string) => Promise<string | null>;

export function toPosixPath(value: string): string {
    return value.split(sep).join("/");
}

export async function listFiles(
    directory: string,
    extension: string,
    allowMissing = false,
): Promise<readonly string[]> {
    try {
        const entries = await readdir(directory, { withFileTypes: true });
        const files = await Promise.all(
            entries.map(async (entry): Promise<readonly string[]> => {
                const entryPath = resolve(directory, entry.name);
                return entry.isDirectory()
                    ? listFiles(entryPath, extension)
                    : extname(entry.name) === extension
                      ? [entryPath]
                      : [];
            }),
        );
        return files.flat().sort();
    } catch (error: unknown) {
        if (
            allowMissing &&
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "ENOENT"
        )
            return [];
        throw error;
    }
}

export async function writeGeneratedFiles(
    files: readonly GeneratedFile[],
): Promise<void> {
    await Promise.all(
        files.map(async ({ filePath, contents }) => {
            await mkdir(dirname(filePath), { recursive: true });
            await writeFile(filePath, contents, "utf8");
        }),
    );
}

async function readGeneratedFile(filePath: string): Promise<string | null> {
    try {
        return await readFile(filePath, "utf8");
    } catch (error: unknown) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "ENOENT"
        )
            return null;
        throw error;
    }
}

export async function staleGeneratedFiles(
    files: readonly GeneratedFile[],
    readTextFile: ReadTextFile = readGeneratedFile,
): Promise<readonly string[]> {
    const comparisons = await Promise.all(
        files.map(async (file) => ({
            file,
            current: await readTextFile(file.filePath),
        })),
    );
    return comparisons
        .filter(({ file, current }) => current !== file.contents)
        .map(({ file }) => file.filePath);
}

export function relativeGeneratedPaths(
    root: string,
    filePaths: readonly string[],
): readonly string[] {
    return filePaths.map((filePath) => relative(root, filePath));
}
