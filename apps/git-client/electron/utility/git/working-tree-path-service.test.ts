import { spawnSync } from "node:child_process";
import {
    mkdtemp,
    mkdir,
    realpath,
    rm,
    symlink,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GitProcessRunner } from "./git-process";
import { RepositoryRegistry } from "./repository-registry";
import { WorkingTreePathService } from "./working-tree-path-service";

const temporaryDirectories: string[] = [];

afterEach(async () => {
    await Promise.all(
        temporaryDirectories
            .splice(0)
            .map((directory) =>
                rm(directory, { recursive: true, force: true }),
            ),
    );
});

describe("WorkingTreePathService", () => {
    it("resolves only existing regular files inside an opened repository", async () => {
        const temporaryDirectory = await mkdtemp(
            join(tmpdir(), "git-client-open-file-"),
        );
        temporaryDirectories.push(temporaryDirectory);
        const root = join(temporaryDirectory, "repository");
        await mkdir(root);
        const init = spawnSync("git", ["init", "--initial-branch=main"], {
            cwd: root,
            encoding: "utf8",
            shell: false,
        });
        if (init.status !== 0) throw new Error(init.stderr);
        await writeFile(join(root, "inside.txt"), "inside", "utf8");
        const outside = join(temporaryDirectory, "outside.txt");
        await writeFile(outside, "outside", "utf8");
        await symlink(outside, join(root, "link.txt"));
        const registry = new RepositoryRegistry(new GitProcessRunner());
        const repository = await registry.open(root);
        const service = new WorkingTreePathService(registry);

        await expect(
            service.resolveFile(repository.id, "inside.txt"),
        ).resolves.toBe(await realpath(join(root, "inside.txt")));
        await expect(
            service.resolveFile(repository.id, "../outside.txt"),
        ).rejects.toMatchObject({
            code: "invalidInput",
        });
        await expect(
            service.resolveFile(repository.id, "link.txt"),
        ).rejects.toMatchObject({
            code: "invalidInput",
        });
        await expect(
            service.resolveFile(repository.id, "missing.txt"),
        ).rejects.toMatchObject({
            code: "invalidInput",
        });
    });
});
