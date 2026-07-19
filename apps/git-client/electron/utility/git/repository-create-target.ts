import { lstat, mkdir, mkdtemp, readdir, realpath, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, parse, resolve } from "node:path";

export type RepositoryCreateTargetOperation = "initialize" | "clone";

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function canonicalTarget(requestedPath: string): Promise<string> {
  if (!isAbsolute(requestedPath) || requestedPath.includes("\0")) {
    throw new Error("Repository path must be an absolute path without null bytes");
  }
  const normalized = resolve(requestedPath);
  if (normalized === parse(normalized).root)
    throw new Error("Repository path must not be a filesystem root");
  try {
    return await realpath(normalized);
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
  }
  await mkdir(dirname(normalized), { recursive: true });
  return join(await realpath(dirname(normalized)), parse(normalized).base);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isMissingPathError(error)) return false;
    throw error;
  }
}

export class RepositoryCreateTarget {
  readonly finalPath: string;
  readonly processPath: string;
  readonly #ownedStage: string | null;
  readonly #stagePrefix: string;

  private constructor(
    finalPath: string,
    processPath: string,
    ownedStage: string | null,
    stagePrefix: string,
  ) {
    this.finalPath = finalPath;
    this.processPath = processPath;
    this.#ownedStage = ownedStage;
    this.#stagePrefix = stagePrefix;
  }

  static async prepare(
    requestedPath: string,
    operation: RepositoryCreateTargetOperation,
  ): Promise<RepositoryCreateTarget> {
    const finalPath = await canonicalTarget(requestedPath);
    const stagePrefix = `.git-client-${operation}-`;
    if (await pathExists(finalPath)) {
      if (!(await stat(finalPath)).isDirectory())
        throw new Error("Repository target must be a directory");
      if (operation === "clone" && (await readdir(finalPath)).length > 0) {
        throw new Error("Clone destination must be empty");
      }
      return new RepositoryCreateTarget(finalPath, finalPath, null, stagePrefix);
    }
    const stage = await mkdtemp(join(dirname(finalPath), stagePrefix));
    return new RepositoryCreateTarget(finalPath, stage, stage, stagePrefix);
  }

  display(value: string): string {
    return this.#ownedStage === null ? value : value.replaceAll(this.#ownedStage, this.finalPath);
  }

  async commit(): Promise<string> {
    if (this.#ownedStage !== null) {
      if (await pathExists(this.finalPath)) {
        throw new Error("Repository target was created by another process during the operation");
      }
      await rename(this.#ownedStage, this.finalPath);
    }
    return realpath(this.finalPath);
  }

  async cleanUp(): Promise<void> {
    if (this.#ownedStage === null) return;
    if (dirname(this.#ownedStage) !== dirname(this.finalPath)) return;
    if (!basename(this.#ownedStage).startsWith(this.#stagePrefix)) return;
    await rm(this.#ownedStage, { recursive: true, force: true });
  }
}
