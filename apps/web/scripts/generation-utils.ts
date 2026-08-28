import { access, glob } from "node:fs/promises";
import { resolve } from "node:path";

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
