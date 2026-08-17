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
import {
    GitFileService,
    MAX_FILE_BYTES,
    MAX_FILE_LINES,
    classifyFileContent,
    classifyFilePreview,
} from "./file-service";
import { GitProcessRunner } from "./git-process";
import { RepositoryRegistry } from "./repository-registry";

const temporaryDirectories: string[] = [];

function git(cwd: string, ...args: readonly string[]): string {
    const result = spawnSync("git", args, {
        cwd,
        env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: "0",
            GIT_PAGER: "cat",
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

async function createRepository(): Promise<{
    readonly root: string;
    readonly registry: RepositoryRegistry;
    readonly service: GitFileService;
}> {
    const temporaryDirectory = await mkdtemp(
        join(tmpdir(), "git-client-files-"),
    );
    temporaryDirectories.push(temporaryDirectory);
    const root = join(temporaryDirectory, "한글 repository");
    await mkdir(root);
    git(root, "init", "--initial-branch=main");
    git(root, "config", "user.name", "Git Client Test");
    git(root, "config", "user.email", "git-client@example.invalid");
    await writeFile(join(root, "한글 file.txt"), "committed\n", "utf8");
    git(root, "add", "--", "한글 file.txt");
    git(root, "commit", "-m", "initial");
    const registry = new RepositoryRegistry(new GitProcessRunner());
    return { root, registry, service: GitFileService.of(registry) };
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

describe("Git파일서비스", () => {
    it("[성공] 외국 코드에 대한 개별 작업 트리, 믿을 수 있는 내용을 읽었습니다", async () => {
        const { root, registry, service } = await createRepository();
        const record = await registry.open(root);
        await writeFile(join(root, "한글 file.txt"), "working tree\n", "utf8");

        await expect(
            service.readFile(
                record.id,
                { kind: "workingTree" },
                "한글 file.txt",
            ),
        ).resolves.toMatchObject({
            kind: "text",
            content: "working tree\n",
            lineCount: 1,
        });
        await expect(
            service.readFile(record.id, { kind: "index" }, "한글 file.txt"),
        ).resolves.toMatchObject({
            kind: "text",
            content: "committed\n",
        });
        await expect(
            service.readFile(
                record.id,
                { kind: "revision", revision: "HEAD" },
                "한글 file.txt",
            ),
        ).resolves.toMatchObject({ kind: "text", content: "committed\n" });
        await expect(
            service.readFile(record.id, { kind: "workingTree" }, "missing.txt"),
        ).resolves.toEqual({
            kind: "missing",
            path: "missing.txt",
        });
    });

    it("[실패] 외부의 게임 트리밍 링크에 추가 기능", async () => {
        const { root, registry, service } = await createRepository();
        const record = await registry.open(root);
        const outside = join(root, "..", "secret.txt");
        await writeFile(outside, "secret", "utf8");
        await symlink(outside, join(root, "linked.txt"));

        await expect(
            service.readFile(record.id, { kind: "workingTree" }, "linked.txt"),
        ).rejects.toMatchObject({
            code: "invalidInput",
        });
        await expect(
            service.readFile(
                record.id,
                { kind: "workingTree" },
                "../secret.txt",
            ),
        ).rejects.toMatchObject({
            code: "invalidInput",
        });
    });

    it("[실패] Git을 변경하지 않고 기존 텍스트 파일을 자동으로 저장함", async () => {
        const { root, registry, service } = await createRepository();
        const record = await registry.open(root);
        await writeFile(join(root, "한글 file.txt"), "staged\n", "utf8");
        git(root, "add", "--", "한글 file.txt");

        await service.writeWorkingTreeFile(
            record.id,
            "한글 file.txt",
            "edited 🌱\n",
        );

        await expect(
            readFile(join(root, "한글 file.txt"), "utf8"),
        ).resolves.toBe("edited 🌱\n");
        expect(git(root, "show", ":한글 file.txt")).toBe("staged\n");
    });

    it("[실패] 스테이징하지 않고 새로운 일반 파일을 생성함", async () => {
        const { root, registry, service } = await createRepository();
        const record = await registry.open(root);

        await service.writeWorkingTreeFile(
            record.id,
            "new file.txt",
            "created\n",
        );

        await expect(
            readFile(join(root, "new file.txt"), "utf8"),
        ).resolves.toBe("created\n");
        expect(
            git(root, "status", "--porcelain", "--", "new file.txt"),
        ).toContain('?? "new file.txt"');
    });

    it("[실패] 외부로 파일을 생성하지 마십시오", async () => {
        const { root, registry, service } = await createRepository();
        const record = await registry.open(root);

        await expect(
            service.writeWorkingTreeFile(record.id, "missing/child.txt", "x"),
        ).rejects.toMatchObject({ code: "invalidInput" });
        await expect(
            service.writeWorkingTreeFile(record.id, "../outside.txt", "x"),
        ).rejects.toMatchObject({ code: "invalidInput" });
    });

    it("[실패] 외부에서 확인되는 관측되는 위치를 유지함", async () => {
        const { root, registry, service } = await createRepository();
        const record = await registry.open(root);
        const outside = join(root, "..", "outside-edit.txt");
        await writeFile(outside, "keep\n", "utf8");
        await symlink(outside, join(root, "outside-link.txt"));

        await expect(
            service.writeWorkingTreeFile(
                record.id,
                "outside-link.txt",
                "replace\n",
            ),
        ).rejects.toMatchObject({ code: "invalidInput" });
        await expect(readFile(outside, "utf8")).resolves.toBe("keep\n");
    });

    it("[실패] Git 데이터를 주간의 작업 트리 파일로 연결하지 않음", async () => {
        const temporaryDirectory = await mkdtemp(
            join(tmpdir(), "git-client-bare-files-"),
        );
        temporaryDirectories.push(temporaryDirectory);
        git(temporaryDirectory, "init", "--bare", "repository.git");
        const registry = new RepositoryRegistry(new GitProcessRunner());
        const service = GitFileService.of(registry);
        const record = await registry.open(
            join(temporaryDirectory, "repository.git"),
        );

        await expect(
            service.readFile(record.id, { kind: "workingTree" }, "HEAD"),
        ).rejects.toMatchObject({ code: "invalidInput" });
    });

    it("[실패] 외부 링크를 제외하고 유일하게, 하위 트리 하위 모듈 데이터를 로드함", async () => {
        const temporaryDirectory = await mkdtemp(
            join(tmpdir(), "git-client-submodule-diff-"),
        );
        temporaryDirectories.push(temporaryDirectory);
        const child = join(temporaryDirectory, "child");
        const root = join(temporaryDirectory, "parent");
        await mkdir(child);
        await mkdir(root);
        git(child, "init", "--initial-branch=main");
        git(child, "config", "user.name", "Git Client Test");
        git(child, "config", "user.email", "git-client@example.invalid");
        await writeFile(join(child, "file.txt"), "first\n", "utf8");
        git(child, "add", "--", "file.txt");
        git(child, "commit", "-m", "first child commit");
        const firstOid = git(child, "rev-parse", "HEAD").trim();
        await writeFile(join(child, "file.txt"), "second\n", "utf8");
        git(child, "commit", "-am", "second child commit");
        const secondOid = git(child, "rev-parse", "HEAD").trim();

        git(root, "init", "--initial-branch=main");
        git(root, "config", "user.name", "Git Client Test");
        git(root, "config", "user.email", "git-client@example.invalid");
        git(
            root,
            "-c",
            "protocol.file.allow=always",
            "submodule",
            "add",
            child,
            "modules/한글 module",
        );
        const checkout = join(root, "modules", "한글 module");
        git(checkout, "checkout", firstOid);
        git(root, "add", "--", ".gitmodules", "modules/한글 module");
        git(root, "commit", "-m", "add child at first commit");
        git(checkout, "checkout", secondOid);

        const registry = new RepositoryRegistry(new GitProcessRunner());
        const service = GitFileService.of(registry);
        const record = await registry.open(root);
        await expect(
            service.loadSubmoduleDiff(
                record.id,
                { kind: "index" },
                { kind: "workingTree" },
                "modules/한글 module",
            ),
        ).resolves.toEqual({
            path: "modules/한글 module",
            beforeOid: firstOid,
            afterOid: secondOid,
            beforeSubject: "first child commit",
            afterSubject: "second child commit",
            ahead: 1,
            behind: 0,
        });
        await expect(
            service.loadSubmoduleDiff(
                record.id,
                { kind: "revision", revision: "HEAD" },
                { kind: "workingTree" },
                "modules/한글 module",
            ),
        ).resolves.toMatchObject({ beforeOid: firstOid, afterOid: secondOid });

        const outside = join(temporaryDirectory, "outside");
        await mkdir(outside);
        git(outside, "init", "--initial-branch=main");
        await symlink(outside, join(root, "outside-link"));
        await expect(
            service.loadSubmoduleDiff(
                record.id,
                { kind: "workingTree" },
                { kind: "index" },
                "outside-link",
            ),
        ).rejects.toMatchObject({ code: "invalidInput" });
    });
});

describe("파일 종류", () => {
    it("[실패] 텍스트, 바이너리, 유효하지 않은 UTF-8, 문자열이 의미하는 포인트가 많은 콘텐츠를 지정함", () => {
        expect(
            classifyFileContent("text.txt", Buffer.from("first\nsecond\n")),
        ).toMatchObject({
            kind: "text",
            lineCount: 2,
        });
        expect(
            classifyFileContent("binary.bin", Buffer.from([1, 0, 2])),
        ).toMatchObject({
            kind: "binary",
        });
        expect(
            classifyFileContent("legacy.txt", Buffer.from([0xff, 0xfe])),
        ).toMatchObject({
            kind: "invalidUtf8",
        });
        expect(
            classifyFileContent(
                "many-lines.txt",
                Buffer.from("\n".repeat(MAX_FILE_LINES + 1)),
            ),
        ).toMatchObject({
            kind: "tooLarge",
            lineCount: MAX_FILE_LINES + 1,
        });
        expect(
            classifyFileContent("large.bin", Buffer.alloc(MAX_FILE_BYTES + 1)),
        ).toMatchObject({
            kind: "tooLarge",
            sizeBytes: MAX_FILE_BYTES + 1,
        });
    });

    it("[성공] 허용 목록에 있는 새스터 이미지 형식에 대해서만 데이터 URL을 생성함", () => {
        const png = classifyFilePreview(
            "image.png",
            Buffer.from([
                0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
            ]),
        );
        expect(png).toMatchObject({
            kind: "image",
            preview: {
                mimeType: "image/png",
                dataUrl: expect.stringMatching(/^data:image\/png;base64,/u),
            },
        });
        expect(
            classifyFilePreview("vector.svg", Buffer.from("<svg></svg>")),
        ).toMatchObject({
            kind: "binary",
        });
    });
});
