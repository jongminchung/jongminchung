import { spawnSync } from "node:child_process";
import {
    mkdtemp,
    mkdir,
    readFile,
    rm,
    symlink,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GitProcessRunner } from "./git-process";
import {
    IgnoreRulesService,
    MAX_IGNORE_RULE_BYTES,
} from "./ignore-rules-service";
import { RepositoryRegistry } from "./repository-registry";

const temporaryDirectories: string[] = [];

function git(cwd: string, ...args: readonly string[]): string {
    const result = spawnSync("git", args, {
        cwd,
        env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: "0",
            GIT_OPTIONAL_LOCKS: "0",
            LC_ALL: "C",
        },
        encoding: "utf8",
        shell: false,
    });
    if (result.status !== 0)
        throw new Error(result.stderr || `git ${args.join(" ")} failed`);
    return result.stdout;
}

async function createService(): Promise<{
    readonly root: string;
    readonly service: IgnoreRulesService;
    readonly repositoryId: string;
}> {
    const temporaryDirectory = await mkdtemp(
        join(tmpdir(), "git-client-ignore-"),
    );
    temporaryDirectories.push(temporaryDirectory);
    const root = join(temporaryDirectory, "repository");
    await mkdir(root);
    git(root, "init", "--initial-branch=main");
    const registry = new RepositoryRegistry(new GitProcessRunner());
    const repository = await registry.open(root);
    return {
        root,
        service: new IgnoreRulesService(registry),
        repositoryId: repository.id,
    };
}

afterEach(async () => {
    await Promise.all(
        temporaryDirectories
            .splice(0)
            .map((directory) =>
                rm(directory, { recursive: true, force: true }),
            ),
    );
});

describe("규칙 서비스 무시", () => {
    it("[성공] 예제 파일을 MB 파일로 이해 두 번째 고정 파일을 원자적으로 유지함", async () => {
        const { root, service, repositoryId } = await createService();
        await expect(service.read(repositoryId)).resolves.toEqual({
            gitignore: "",
            infoExclude: expect.stringContaining("git ls-files --others"),
        });

        await service.write(repositoryId, {
            gitignore: "dist/\n",
            infoExclude: ".cache/\n",
        });

        await expect(service.read(repositoryId)).resolves.toEqual({
            gitignore: "dist/\n",
            infoExclude: ".cache/\n",
        });
        await expect(readFile(join(root, ".gitignore"), "utf8")).resolves.toBe(
            "dist/\n",
        );
        await expect(
            readFile(join(root, ".git", "info", "exclude"), "utf8"),
        ).resolves.toBe(".cache/\n");
    });

    it("[실패] NUL, 큰 내용, 유효하지 않은 UTF-8 및 기호 링크 그림이 포함되어 있음", async () => {
        const { root, service, repositoryId } = await createService();
        await expect(
            service.write(repositoryId, {
                gitignore: "bad\0rule",
                infoExclude: "",
            }),
        ).rejects.toMatchObject({ code: "invalidInput" });
        await expect(
            service.write(repositoryId, {
                gitignore: "x".repeat(MAX_IGNORE_RULE_BYTES + 1),
                infoExclude: "",
            }),
        ).rejects.toMatchObject({ code: "invalidInput" });

        await writeFile(join(root, ".gitignore"), Buffer.from([0xff, 0xfe]));
        await expect(service.read(repositoryId)).rejects.toMatchObject({
            code: "invalidInput",
        });

        const outside = join(root, "..", "outside-ignore");
        await writeFile(outside, "secret\n", "utf8");
        await rm(join(root, ".gitignore"));
        await symlink(outside, join(root, ".gitignore"));
        await expect(service.read(repositoryId)).rejects.toMatchObject({
            code: "invalidInput",
        });
    });

    it("[실패]대상을 수정하지 않고 대상 릭 링크를 대체함", async () => {
        const { root, service, repositoryId } = await createService();
        const outside = join(root, "..", "outside-ignore");
        await writeFile(outside, "do-not-touch\n", "utf8");
        await symlink(outside, join(root, ".gitignore"));

        await service.write(repositoryId, {
            gitignore: "safe\n",
            infoExclude: "",
        });

        await expect(readFile(outside, "utf8")).resolves.toBe("do-not-touch\n");
        await expect(readFile(join(root, ".gitignore"), "utf8")).resolves.toBe(
            "safe\n",
        );
    });
});
