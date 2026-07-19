import type { Stats } from "node:fs";
import { lstat, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import type { RepositoryId } from "../../../src/shared/contracts/git-utility";
import { GitUtilityError } from "./git-error";
import type { RepositoryRegistry } from "./repository-registry";
import { validateRelativePath } from "./validation";

export interface WorkingTreeFileSystem {
  realpath(path: string): Promise<string>;
  lstat(path: string): Promise<Stats>;
  stat(path: string): Promise<Stats>;
}

const nodeFileSystem: WorkingTreeFileSystem = Object.freeze({
  realpath,
  lstat,
  stat,
});

interface FileIdentity {
  readonly device: number;
  readonly inode: number;
}

function identity(metadata: Stats): FileIdentity {
  return { device: metadata.dev, inode: metadata.ino };
}

function hasIdentity(metadata: Stats, expected: FileIdentity): boolean {
  return metadata.dev === expected.device && metadata.ino === expected.inode;
}

function isBelow(root: string, path: string): boolean {
  const child = relative(root, path);
  return child.length > 0 && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

function invalidPath(message: string): GitUtilityError {
  return new GitUtilityError("invalidInput", message);
}

/**
 * Resolves a repository-relative file to a canonical absolute path suitable for
 * Electron's `shell.openPath`. The caller must invoke `shell.openPath` promptly:
 * no path-only API can eliminate a replacement race after this method returns.
 */
export class WorkingTreeFileResolver {
  readonly #registry: RepositoryRegistry;
  readonly #fileSystem: WorkingTreeFileSystem;

  constructor(registry: RepositoryRegistry, fileSystem: WorkingTreeFileSystem = nodeFileSystem) {
    this.#registry = registry;
    this.#fileSystem = fileSystem;
  }

  async resolve(repositoryId: RepositoryId, path: string): Promise<string> {
    validateRelativePath(path);
    if (path.startsWith("-")) {
      throw invalidPath("Working-tree path must not look like an option");
    }

    const repository = this.#registry.get(repositoryId);
    if (repository.isBare) {
      throw invalidPath("Bare repositories do not have working-tree files");
    }

    try {
      const canonicalRoot = await this.#fileSystem.realpath(repository.path);
      const rootMetadata = await this.#fileSystem.stat(canonicalRoot);
      if (!rootMetadata.isDirectory()) {
        throw invalidPath("Repository root is no longer a directory");
      }
      const rootIdentity = identity(rootMetadata);
      const candidate = join(canonicalRoot, path);

      await this.#fileSystem.lstat(candidate);
      const canonicalFile = await this.#fileSystem.realpath(candidate);
      if (!isBelow(canonicalRoot, canonicalFile)) {
        throw invalidPath("Working-tree path resolves outside the repository");
      }

      const initialMetadata = await this.#fileSystem.stat(canonicalFile);
      if (!initialMetadata.isFile()) {
        throw invalidPath("Working-tree path is not a regular file");
      }
      const fileIdentity = identity(initialMetadata);

      const finalRoot = await this.#fileSystem.realpath(repository.path);
      const finalRootMetadata = await this.#fileSystem.stat(finalRoot);
      const finalFile = await this.#fileSystem.realpath(candidate);
      const finalFileMetadata = await this.#fileSystem.stat(finalFile);
      if (
        finalRoot !== canonicalRoot ||
        !finalRootMetadata.isDirectory() ||
        !hasIdentity(finalRootMetadata, rootIdentity) ||
        finalFile !== canonicalFile ||
        !isBelow(finalRoot, finalFile) ||
        !finalFileMetadata.isFile() ||
        !hasIdentity(finalFileMetadata, fileIdentity)
      ) {
        throw invalidPath("Working-tree path changed while it was being resolved");
      }

      return finalFile;
    } catch (error) {
      if (error instanceof GitUtilityError) throw error;
      if (isMissingPathError(error)) {
        throw invalidPath("Working-tree file does not exist");
      }
      throw invalidPath("Working-tree file could not be resolved safely");
    }
  }
}
