import { realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import type { RepositoryId } from "../../../src/shared/contracts/git-utility";
import { GitUtilityError } from "./git-error";
import type { RepositoryRegistry } from "./repository-registry";
import { validateRelativePath } from "./validation";

export class WorkingTreePathService {
    readonly #registry: RepositoryRegistry;

    constructor(registry: RepositoryRegistry) {
        this.#registry = registry;
    }

    async resolveFile(
        repositoryId: RepositoryId,
        path: string,
    ): Promise<string> {
        validateRelativePath(path);
        const repository = this.#registry.get(repositoryId);
        if (repository.isBare) {
            throw new GitUtilityError(
                "invalidInput",
                "Bare repositories do not have worktree files",
            );
        }
        let canonicalPath: string;
        try {
            canonicalPath = await realpath(join(repository.path, path));
        } catch {
            throw new GitUtilityError(
                "invalidInput",
                "Working tree file does not exist",
            );
        }
        const relativePath = relative(repository.path, canonicalPath);
        if (
            relativePath === ".." ||
            relativePath.startsWith(`..${sep}`) ||
            isAbsolute(relativePath)
        ) {
            throw new GitUtilityError(
                "invalidInput",
                "Working tree file escapes the repository",
            );
        }
        if (!(await stat(canonicalPath)).isFile()) {
            throw new GitUtilityError(
                "invalidInput",
                "Working tree path is not a file",
            );
        }
        return canonicalPath;
    }
}
