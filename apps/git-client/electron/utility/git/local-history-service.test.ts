import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GitProcessRunner } from "./git-process";
import { LocalHistoryService } from "./local-history-service";
import { RepositoryRegistry } from "./repository-registry";

function git(cwd: string, ...args: readonly string[]): string {
    return execFileSync("git", args, { cwd, encoding: "utf8" });
}

describe("LocalHistoryService", () => {
    it("captures external edits and restores one worktree path without changing the index", async () => {
        const root = await mkdtemp(join(tmpdir(), "git-client-local-history-"));
        const repositoryPath = join(root, "repository");
        const storageRoot = join(root, "profile");
        git(root, "init", repositoryPath);
        git(repositoryPath, "config", "user.name", "Local History Test");
        git(repositoryPath, "config", "user.email", "local-history@example.test");
        await writeFile(join(repositoryPath, "tracked.txt"), "one\n", "utf8");
        git(repositoryPath, "add", "tracked.txt");
        git(repositoryPath, "commit", "-m", "initial");

        const runner = new GitProcessRunner();
        const registry = new RepositoryRegistry(runner);
        const repository = await registry.open(repositoryPath);
        const service = LocalHistoryService.of(registry, storageRoot, runner);
        const baseline = await service.capture(repository.id, null);

        await writeFile(join(repositoryPath, "tracked.txt"), "two\n", "utf8");
        git(repositoryPath, "add", "tracked.txt");
        await writeFile(join(repositoryPath, "tracked.txt"), "three\n", "utf8");
        const edited = await service.capture(repository.id, "After edit");
        await writeFile(join(repositoryPath, "tracked.txt"), "four\n", "utf8");

        await expect(service.list(repository.id, "tracked.txt")).resolves.toEqual([
            expect.objectContaining({ id: edited.id, label: "After edit" }),
            expect.objectContaining({ id: baseline.id }),
        ]);
        await expect(
            service.diff(repository.id, baseline.id, "tracked.txt"),
        ).resolves.toContain("+four");

        await service.restore(repository.id, baseline.id, "tracked.txt");

        await expect(
            readFile(join(repositoryPath, "tracked.txt"), "utf8"),
        ).resolves.toBe("one\n");
        expect(git(repositoryPath, "show", ":tracked.txt")).toBe("two\n");
        await expect(
            service.label(repository.id, baseline.id, "Before refactor"),
        ).resolves.toMatchObject({ label: "Before refactor" });
    });
});
