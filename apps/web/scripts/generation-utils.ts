import { access, glob, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

export interface GeneratedFile {
  readonly filePath: string;
  readonly contents: string;
}

export type ReadTextFile = (filePath: string) => Promise<string | null>;

/** `toPosixPath` 공개 기능을 제공함 */
export function toPosixPath(value: string): string {
  return value.split(sep).join("/");
}

/** `listFiles` 데이터를 조회함 */
export async function listFiles(
  directory: string,
  extension: string,
  allowMissing = false,
): Promise<readonly string[]> {
  try {
    await access(directory);
    const files: string[] = [];
    for await (const filePath of glob(`**/*${extension}`, {
      cwd: directory,
    })) {
      files.push(resolve(directory, filePath));
    }
    return files.toSorted();
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

/** `writeGeneratedFiles` 공개 기능을 제공함 */
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

/** `staleGeneratedFiles` 공개 기능을 제공함 */
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

/** `relativeGeneratedPaths` 공개 기능을 제공함 */
export function relativeGeneratedPaths(
  root: string,
  filePaths: readonly string[],
): readonly string[] {
  return filePaths.map((filePath) => relative(root, filePath));
}
