import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
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
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout;
}

async function createRepository(): Promise<{
  readonly root: string;
  readonly registry: RepositoryRegistry;
  readonly service: GitFileService;
}> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "git-client-files-"));
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
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("GitFileService", () => {
  it("reads distinct working-tree, index, and revision content for Unicode paths", async () => {
    const { root, registry, service } = await createRepository();
    const record = await registry.open(root);
    await writeFile(join(root, "한글 file.txt"), "working tree\n", "utf8");

    await expect(
      service.readFile(record.id, { kind: "workingTree" }, "한글 file.txt"),
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
      service.readFile(record.id, { kind: "revision", revision: "HEAD" }, "한글 file.txt"),
    ).resolves.toMatchObject({ kind: "text", content: "committed\n" });
    await expect(
      service.readFile(record.id, { kind: "workingTree" }, "missing.txt"),
    ).resolves.toEqual({
      kind: "missing",
      path: "missing.txt",
    });
  });

  it("does not follow a working-tree symlink outside the repository", async () => {
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
      service.readFile(record.id, { kind: "workingTree" }, "../secret.txt"),
    ).rejects.toMatchObject({
      code: "invalidInput",
    });
  });

  it("atomically saves existing text files without changing the Git index", async () => {
    const { root, registry, service } = await createRepository();
    const record = await registry.open(root);
    await writeFile(join(root, "한글 file.txt"), "staged\n", "utf8");
    git(root, "add", "--", "한글 file.txt");

    await service.writeWorkingTreeFile(record.id, "한글 file.txt", "edited 🌱\n");

    await expect(readFile(join(root, "한글 file.txt"), "utf8")).resolves.toBe("edited 🌱\n");
    expect(git(root, "show", ":한글 file.txt")).toBe("staged\n");
  });

  it("creates a new regular file without staging it", async () => {
    const { root, registry, service } = await createRepository();
    const record = await registry.open(root);

    await service.writeWorkingTreeFile(record.id, "new file.txt", "created\n");

    await expect(readFile(join(root, "new file.txt"), "utf8")).resolves.toBe("created\n");
    expect(git(root, "status", "--porcelain", "--", "new file.txt")).toContain('?? "new file.txt"');
  });

  it("does not create files through a missing or outside parent", async () => {
    const { root, registry, service } = await createRepository();
    const record = await registry.open(root);

    await expect(
      service.writeWorkingTreeFile(record.id, "missing/child.txt", "x"),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(
      service.writeWorkingTreeFile(record.id, "../outside.txt", "x"),
    ).rejects.toMatchObject({ code: "invalidInput" });
  });

  it("rejects editor writes through paths that resolve outside the repository", async () => {
    const { root, registry, service } = await createRepository();
    const record = await registry.open(root);
    const outside = join(root, "..", "outside-edit.txt");
    await writeFile(outside, "keep\n", "utf8");
    await symlink(outside, join(root, "outside-link.txt"));

    await expect(
      service.writeWorkingTreeFile(record.id, "outside-link.txt", "replace\n"),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(readFile(outside, "utf8")).resolves.toBe("keep\n");
  });

  it("does not expose Git metadata as working-tree files for a bare repository", async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "git-client-bare-files-"));
    temporaryDirectories.push(temporaryDirectory);
    git(temporaryDirectory, "init", "--bare", "repository.git");
    const registry = new RepositoryRegistry(new GitProcessRunner());
    const service = GitFileService.of(registry);
    const record = await registry.open(join(temporaryDirectory, "repository.git"));

    await expect(
      service.readFile(record.id, { kind: "workingTree" }, "HEAD"),
    ).rejects.toMatchObject({ code: "invalidInput" });
  });

  it("loads index, revision, and working-tree submodule metadata without following outside links", async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "git-client-submodule-diff-"));
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
    git(root, "-c", "protocol.file.allow=always", "submodule", "add", child, "modules/한글 module");
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

describe("file classification", () => {
  it("classifies text, binary, invalid UTF-8, line-heavy, and byte-heavy content", () => {
    expect(classifyFileContent("text.txt", Buffer.from("first\nsecond\n"))).toMatchObject({
      kind: "text",
      lineCount: 2,
    });
    expect(classifyFileContent("binary.bin", Buffer.from([1, 0, 2]))).toMatchObject({
      kind: "binary",
    });
    expect(classifyFileContent("legacy.txt", Buffer.from([0xff, 0xfe]))).toMatchObject({
      kind: "invalidUtf8",
    });
    expect(
      classifyFileContent("many-lines.txt", Buffer.from("\n".repeat(MAX_FILE_LINES + 1))),
    ).toMatchObject({
      kind: "tooLarge",
      lineCount: MAX_FILE_LINES + 1,
    });
    expect(classifyFileContent("large.bin", Buffer.alloc(MAX_FILE_BYTES + 1))).toMatchObject({
      kind: "tooLarge",
      sizeBytes: MAX_FILE_BYTES + 1,
    });
  });

  it("creates data URLs only for allowlisted raster image formats", () => {
    const png = classifyFilePreview(
      "image.png",
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]),
    );
    expect(png).toMatchObject({
      kind: "image",
      preview: {
        mimeType: "image/png",
        dataUrl: expect.stringMatching(/^data:image\/png;base64,/u),
      },
    });
    expect(classifyFilePreview("vector.svg", Buffer.from("<svg></svg>"))).toMatchObject({
      kind: "binary",
    });
  });
});
