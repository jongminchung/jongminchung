import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GitProcessRunner } from "../../electron/utility/git/git-process";
import { GitUtility } from "../../electron/utility/git/git-utility";
import { GitQueryService } from "../../electron/utility/git/query-service";
import { RepositoryRegistry } from "../../electron/utility/git/repository-registry";
import type { GitRequestId } from "../shared/contracts/git-utility";
import type { GitEvent, GitRequest, RequestId } from "../shared/contracts/model";
import { ElectronGitBridge, type ElectronGitApi } from "./ElectronGitBridge";

const temporaryDirectories: string[] = [];
const GIT_ENVIRONMENT = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_PAGER: "cat",
  GIT_OPTIONAL_LOCKS: "0",
  LC_ALL: "C",
};

function git(cwd: string, ...args: readonly string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    env: GIT_ENVIRONMENT,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout;
}

async function createRepository(): Promise<string> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "git-client-bridge-"));
  temporaryDirectories.push(temporaryDirectory);
  const repository = join(temporaryDirectory, "검증 repository");
  await mkdir(repository);
  git(repository, "init", "--initial-branch=main");
  git(repository, "config", "user.name", "Git Client Test");
  git(repository, "config", "user.email", "git-client@example.invalid");
  await writeFile(join(repository, "tracked.txt"), "content\n", "utf8");
  git(repository, "add", "--", "tracked.txt");
  git(repository, "commit", "-m", "fixture commit");
  git(repository, "remote", "add", "origin", "https://user:secret@example.invalid/repository.git");
  return repository;
}

async function createSubmoduleRepository(): Promise<
  Readonly<{
    root: string;
    path: string;
    firstOid: string;
    secondOid: string;
  }>
> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "git-client-bridge-submodule-"));
  temporaryDirectories.push(temporaryDirectory);
  const child = join(temporaryDirectory, "child");
  const root = join(temporaryDirectory, "parent");
  await Promise.all([mkdir(child), mkdir(root)]);

  git(child, "init", "--initial-branch=main");
  git(child, "config", "user.name", "Git Client Test");
  git(child, "config", "user.email", "git-client@example.invalid");
  await writeFile(join(child, "child.txt"), "first\n", "utf8");
  git(child, "add", "--", "child.txt");
  git(child, "commit", "-m", "first child commit");
  const firstOid = git(child, "rev-parse", "HEAD").trim();
  await writeFile(join(child, "child.txt"), "second\n", "utf8");
  git(child, "commit", "-am", "second child commit");
  const secondOid = git(child, "rev-parse", "HEAD").trim();

  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.name", "Git Client Test");
  git(root, "config", "user.email", "git-client@example.invalid");
  git(root, "-c", "protocol.file.allow=always", "submodule", "add", child, "modules/client");
  const checkout = join(root, "modules", "client");
  git(checkout, "checkout", firstOid);
  git(root, "add", "--all");
  git(root, "commit", "-m", "pin first child commit");
  git(checkout, "checkout", secondOid);

  return { root, path: "modules/client", firstOid, secondOid };
}

async function createQueryRepository(): Promise<string> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "git-client-bridge-queries-"));
  temporaryDirectories.push(temporaryDirectory);
  const repository = join(temporaryDirectory, "17종 query repository");
  const remote = join(temporaryDirectory, "remote.git");
  await mkdir(repository);
  await mkdir(remote);
  git(repository, "init", "--initial-branch=main");
  git(remote, "init", "--bare", "--initial-branch=main");
  git(repository, "config", "user.name", "Git Client Test");
  git(repository, "config", "user.email", "git-client@example.invalid");
  git(repository, "config", "commit.gpgsign", "false");
  await writeFile(join(repository, ".gitignore"), "ignored.txt\n", "utf8");
  await writeFile(join(repository, "tracked.txt"), "first\n", "utf8");
  git(repository, "add", "--", ".gitignore", "tracked.txt");
  git(repository, "commit", "-m", "first query commit");
  await writeFile(join(repository, "tracked.txt"), "second\n", "utf8");
  git(repository, "commit", "-am", "second query commit");
  git(repository, "remote", "add", "origin", remote);
  git(repository, "push", "--set-upstream", "origin", "main");
  git(
    repository,
    "config",
    "http.https://example.invalid.extraheader",
    "Authorization: Bearer ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
  );
  await writeFile(join(repository, "tracked.txt"), "stashed\n", "utf8");
  await writeFile(join(repository, "stashed-untracked.txt"), "stash me\n", "utf8");
  git(repository, "stash", "push", "--include-untracked", "--message", "query fixture stash");
  await writeFile(join(repository, "tracked.txt"), "working\n", "utf8");
  await writeFile(join(repository, "ignored.txt"), "ignored\n", "utf8");
  await writeFile(join(repository, "token=private-token.txt"), "filename must survive\n", "utf8");
  return repository;
}

type QueryGitRequest = Exclude<GitRequest, { kind: "operation" }>;

async function executeToTerminal(
  bridge: ElectronGitBridge,
  request: GitRequest,
): Promise<Readonly<{ requestId: RequestId; events: readonly GitEvent[] }>> {
  const events: GitEvent[] = [];
  let resolveTerminal: (() => void) | null = null;
  const terminal = new Promise<void>((resolve) => {
    resolveTerminal = resolve;
  });
  const requestId = await bridge.execute(request, (event) => {
    events.push(event);
    if (event.kind === "completed" || event.kind === "failed" || event.kind === "cancelled") {
      resolveTerminal?.();
    }
  });
  await terminal;
  return { requestId, events };
}

async function executeCompletedOperation(
  bridge: ElectronGitBridge,
  repositoryId: string,
  operation: Extract<GitRequest, { kind: "operation" }>["operation"],
): Promise<readonly GitEvent[]> {
  const { requestId, events } = await executeToTerminal(bridge, {
    kind: "operation",
    repositoryId,
    operation,
  });
  expect(events[0], operation.kind).toMatchObject({
    kind: "started",
    requestId,
  });
  expect(events.at(-1), operation.kind).toMatchObject({
    kind: "completed",
    requestId,
  });
  expect(
    events.slice(1, -1).every((event) => event.kind === "output"),
    operation.kind,
  ).toBe(true);
  return events;
}

function bridgeApi(utility: GitUtility): ElectronGitApi {
  return {
    openRepository: (path) => utility.openRepository({ path }),
    async initializeRepository(path, bare) {
      const terminal = await utility.initializeRepository(
        { requestId: randomUUID() as GitRequestId, path, bare },
        () => undefined,
      );
      if (terminal.kind !== "completed") throw new Error(`Initialize ${terminal.kind}`);
      return terminal.repository;
    },
    async cloneRepository(url, path, options) {
      const terminal = await utility.cloneRepository(
        { requestId: randomUUID() as GitRequestId, url, path, options },
        () => undefined,
      );
      if (terminal.kind !== "completed") throw new Error(`Clone ${terminal.kind}`);
      return terminal.repository;
    },
    inspectSnapshot: (repositoryId) => utility.inspectSnapshot(repositoryId),
    compareBranches: (repositoryId, left, right) =>
      utility.compareBranches(repositoryId, left, right),
    preCommitCheck: (repositoryId) => utility.preCommitCheck(repositoryId),
    listGitConfig: (repositoryId) => utility.listGitConfig(repositoryId),
    listSubmodules: (repositoryId) => utility.listSubmodules(repositoryId),
    listMergedBranches: (repositoryId, target) => utility.listMergedBranches(repositoryId, target),
    loadCommitSignature: (repositoryId, revision) =>
      utility.loadCommitSignature(repositoryId, revision),
    listRemotes: (repositoryId) => utility.listRemotes(repositoryId),
    listWorktrees: (repositoryId) => utility.listWorktrees(repositoryId),
    readIgnoreRules: (repositoryId) => utility.readIgnoreRules(repositoryId),
    writeIgnoreRules: (repositoryId, rules) => utility.writeIgnoreRules(repositoryId, rules),
    loadPushPreview: (repositoryId, remote, remoteRef, localRevision) =>
      utility.loadPushPreview(repositoryId, remote, remoteRef, localRevision),
    loadHistoryRewritePreview: (repositoryId, fromRevision) =>
      utility.loadHistoryRewritePreview(repositoryId, fromRevision),
    async exportPatch(repositoryId, revisions, targetPath) {
      const result = await utility.executeRepositoryService({
        operation: "exportPatch",
        repositoryId,
        revisions,
        targetPath,
      });
      if (result.operation !== "exportPatch") throw new Error("Unexpected exportPatch result");
      return result.value;
    },
    async createPatchText(repositoryId, revisions) {
      const result = await utility.executeRepositoryService({
        operation: "createPatchText",
        repositoryId,
        revisions,
      });
      if (result.operation !== "createPatchText")
        throw new Error("Unexpected createPatchText result");
      return result.value;
    },
    async importPatch(repositoryId, path) {
      const result = await utility.executeRepositoryService({
        operation: "importPatch",
        repositoryId,
        path,
      });
      if (result.operation !== "importPatch") throw new Error("Unexpected importPatch result");
    },
    async createShelf(repositoryId, message, paths) {
      const result = await utility.executeRepositoryService({
        operation: "createShelf",
        repositoryId,
        message,
        paths,
      });
      if (result.operation !== "createShelf") throw new Error("Unexpected createShelf result");
      return result.value;
    },
    async listShelves(repositoryId) {
      const result = await utility.executeRepositoryService({
        operation: "listShelves",
        repositoryId,
      });
      if (result.operation !== "listShelves") throw new Error("Unexpected listShelves result");
      return result.value;
    },
    async applyShelf(repositoryId, shelfId, dropAfterApply) {
      const result = await utility.executeRepositoryService({
        operation: "applyShelf",
        repositoryId,
        shelfId,
        dropAfterApply,
      });
      if (result.operation !== "applyShelf") throw new Error("Unexpected applyShelf result");
    },
    async deleteShelf(repositoryId, shelfId) {
      const result = await utility.executeRepositoryService({
        operation: "deleteShelf",
        repositoryId,
        shelfId,
      });
      if (result.operation !== "deleteShelf") throw new Error("Unexpected deleteShelf result");
    },
    async listChangelists(repositoryId) {
      const result = await utility.executeRepositoryService({
        operation: "listChangelists",
        repositoryId,
      });
      if (result.operation !== "listChangelists")
        throw new Error("Unexpected listChangelists result");
      return result.value;
    },
    async saveChangelist(repositoryId, id, name, paths) {
      const result = await utility.executeRepositoryService({
        operation: "saveChangelist",
        repositoryId,
        id,
        name,
        paths,
      });
      if (result.operation !== "saveChangelist")
        throw new Error("Unexpected saveChangelist result");
      return result.value;
    },
    async deleteChangelist(repositoryId, changelistId) {
      const result = await utility.executeRepositoryService({
        operation: "deleteChangelist",
        repositoryId,
        changelistId,
      });
      if (result.operation !== "deleteChangelist")
        throw new Error("Unexpected deleteChangelist result");
    },
    async commitChangelist(repositoryId, changelistId, message, amend, signOff, gpgSign) {
      const result = await utility.executeRepositoryService({
        operation: "commitChangelist",
        repositoryId,
        changelistId,
        message,
        amend,
        signOff,
        gpgSign,
      });
      if (result.operation !== "commitChangelist")
        throw new Error("Unexpected commitChangelist result");
      return result.value;
    },
    async listRecoveryEntries(repositoryId) {
      const result = await utility.executeRepositoryService({
        operation: "listRecoveryEntries",
        repositoryId,
      });
      if (result.operation !== "listRecoveryEntries")
        throw new Error("Unexpected listRecoveryEntries result");
      return result.value;
    },
    async restoreRecoveryEntry(repositoryId, entryId) {
      const result = await utility.executeRepositoryService({
        operation: "restoreRecoveryEntry",
        repositoryId,
        entryId,
      });
      if (result.operation !== "restoreRecoveryEntry")
        throw new Error("Unexpected restoreRecoveryEntry result");
      return result.value;
    },
    async listConflicts(repositoryId) {
      const result = await utility.executeRepositoryService({
        operation: "listConflicts",
        repositoryId,
      });
      if (result.operation !== "listConflicts") throw new Error("Unexpected listConflicts result");
      return result.value;
    },
    async readConflict(repositoryId, path) {
      const result = await utility.executeRepositoryService({
        operation: "readConflict",
        repositoryId,
        path,
      });
      if (result.operation !== "readConflict") throw new Error("Unexpected readConflict result");
      return result.value;
    },
    async writeConflictResult(repositoryId, path, conflictResult, stage) {
      const result = await utility.executeRepositoryService({
        operation: "writeConflictResult",
        repositoryId,
        path,
        result: conflictResult,
        stage,
      });
      if (result.operation !== "writeConflictResult")
        throw new Error("Unexpected writeConflictResult result");
    },
    async resolveBinaryConflict(repositoryId, path, side) {
      const result = await utility.executeRepositoryService({
        operation: "resolveBinaryConflict",
        repositoryId,
        path,
        side,
      });
      if (result.operation !== "resolveBinaryConflict")
        throw new Error("Unexpected resolveBinaryConflict result");
    },
    readFile: (repositoryId, source, path) => utility.readFile(repositoryId, source, path),
    readFilePreview: (repositoryId, source, path) =>
      utility.readFilePreview(repositoryId, source, path),
    async loadSubmoduleDiff(repositoryId, before, after, path) {
      const result = await utility.executeRepositoryService({
        operation: "loadSubmoduleDiff",
        repositoryId,
        before,
        after,
        path,
      });
      if (result.operation !== "loadSubmoduleDiff")
        throw new Error("Unexpected loadSubmoduleDiff result");
      return result.value;
    },
    async openWorkingTreeFile(repositoryId, path) {
      const result = await utility.executeRepositoryService({
        operation: "resolveWorkingTreeFile",
        repositoryId,
        path,
      });
      if (result.operation !== "resolveWorkingTreeFile")
        throw new Error("Unexpected resolveWorkingTreeFile result");
    },
    async executeSynchronizedBranchOperation(repositoryIds, gitOperation) {
      const result = await utility.executeRepositoryService({
        operation: "executeSynchronizedBranchOperation",
        repositoryIds,
        gitOperation,
      });
      if (result.operation !== "executeSynchronizedBranchOperation")
        throw new Error("Unexpected executeSynchronizedBranchOperation result");
      return result.value;
    },
    async applyMultiRootRollback(steps) {
      const result = await utility.executeRepositoryService({
        operation: "applyMultiRootRollback",
        steps,
      });
      if (result.operation !== "applyMultiRootRollback")
        throw new Error("Unexpected applyMultiRootRollback result");
      return result.value;
    },
    watchRepository: (repositoryId, listener) => utility.watchRepository(repositoryId, listener),
    unwatchRepository: (repositoryId) => utility.unwatchRepository(repositoryId),
    closeRepository: async (repositoryId) => utility.closeRepository(repositoryId),
    executeQuery: (request, listener) => utility.executeQuery(request, listener),
    cancelQuery: async (requestId) => utility.cancelQuery(requestId),
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("ElectronGitBridge real utility fixture", () => {
  it("opens, inspects, compares, manages ignore rules, and lists repository metadata", async () => {
    const path = await createRepository();
    const bridge = new ElectronGitBridge(bridgeApi(new GitUtility()));
    const snapshot = await bridge.openRepository(path);

    expect(snapshot).toMatchObject({
      path: await realpath(path),
      currentBranch: "main",
      remoteUrl: "https://[redacted]@example.invalid/repository.git",
      isShallow: false,
      isDetached: false,
      hasCommits: true,
      operation: null,
    });
    await expect(bridge.compareBranches(snapshot.id, "main", "HEAD")).resolves.toEqual({
      ahead: 0,
      behind: 0,
      leftOnly: [],
      rightOnly: [],
    });
    await expect(bridge.preCommitCheck(snapshot.id)).resolves.toMatchObject({
      branch: "main",
      detachedHead: false,
      protectedBranch: true,
    });
    await expect(bridge.listGitConfig(snapshot.id)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "user.name",
          value: "Git Client Test",
        }),
      ]),
    );
    await expect(bridge.listMergedBranches(snapshot.id, "HEAD")).resolves.toContain("main");
    await expect(bridge.listRemotes(snapshot.id)).resolves.toMatchObject([
      {
        name: "origin",
        fetchUrl: "https://[redacted]@example.invalid/repository.git",
      },
    ]);
    await expect(bridge.listWorktrees(snapshot.id)).resolves.toMatchObject([
      { path: await realpath(path), branch: "main", isMain: true },
    ]);

    await bridge.writeIgnoreRules(snapshot.id, {
      gitignore: "dist/\n",
      infoExclude: ".cache/\n",
    });
    await expect(bridge.readIgnoreRules(snapshot.id)).resolves.toEqual({
      gitignore: "dist/\n",
      infoExclude: ".cache/\n",
    });
    await bridge.unwatchRepository(snapshot.id);
  });

  it("loads a real submodule gitlink diff and rejects unsafe worktree-file opens", async () => {
    const fixture = await createSubmoduleRepository();
    const bridge = new ElectronGitBridge(bridgeApi(new GitUtility()));
    const snapshot = await bridge.openRepository(fixture.root);

    await expect(
      bridge.loadSubmoduleDiff(
        snapshot.id,
        { kind: "index" },
        { kind: "workingTree" },
        fixture.path,
      ),
    ).resolves.toEqual({
      path: fixture.path,
      beforeOid: fixture.firstOid,
      afterOid: fixture.secondOid,
      beforeSubject: "first child commit",
      afterSubject: "second child commit",
      ahead: 1,
      behind: 0,
    });
    await expect(bridge.openWorkingTreeFile(snapshot.id, ".gitmodules")).resolves.toBeUndefined();
    await expect(bridge.openWorkingTreeFile(snapshot.id, "../outside.txt")).rejects.toThrow(
      "Path must stay inside the repository",
    );
    await bridge.unwatchRepository(snapshot.id);
  });

  it("creates and rolls back one branch across two real repositories", async () => {
    const [firstPath, secondPath] = await Promise.all([createRepository(), createRepository()]);
    const storageRoot = join(dirname(firstPath), "multi-root profile");
    await mkdir(storageRoot);
    const bridge = new ElectronGitBridge(
      bridgeApi(new GitUtility(undefined, undefined, storageRoot)),
    );
    const [first, second] = await Promise.all([
      bridge.openRepository(firstPath),
      bridge.openRepository(secondPath),
    ]);

    const result = await bridge.executeSynchronizedBranchOperation([second.id, first.id], {
      kind: "createBranch",
      name: "feature/parity",
      startPoint: "HEAD",
      checkout: true,
    });
    expect(result.outcomes).toHaveLength(2);
    expect(result.outcomes.every((outcome) => outcome.succeeded)).toBe(true);
    expect(result.rollbackPlan).toHaveLength(2);
    expect(git(firstPath, "branch", "--show-current").trim()).toBe("feature/parity");
    expect(git(secondPath, "branch", "--show-current").trim()).toBe("feature/parity");

    const rollback = await bridge.applyMultiRootRollback(result.rollbackPlan);
    expect(rollback).toHaveLength(2);
    expect(rollback.every((outcome) => outcome.succeeded)).toBe(true);
    for (const path of [firstPath, secondPath]) {
      expect(git(path, "branch", "--show-current").trim()).toBe("main");
      expect(git(path, "branch", "--list", "feature/parity").trim()).toBe("");
    }

    await Promise.all([bridge.unwatchRepository(first.id), bridge.unwatchRepository(second.id)]);
  });

  it("executes all 17 generated non-operation requests through the renderer bridge", async () => {
    const path = await createQueryRepository();
    const bridge = new ElectronGitBridge(bridgeApi(new GitUtility()));
    const { id: repositoryId } = await bridge.openRepository(path);
    const requests = [
      { kind: "status", repositoryId },
      { kind: "refs", repositoryId },
      {
        kind: "log",
        repositoryId,
        skip: 0,
        limit: 50,
        order: "topology",
        filters: {
          query: null,
          branch: null,
          author: "Git Client Test",
          since: null,
          until: null,
          paths: [],
          noMerges: false,
          regex: false,
          matchCase: false,
        },
      },
      { kind: "commitDetails", repositoryId, revision: "HEAD" },
      {
        kind: "diff",
        repositoryId,
        from: null,
        to: null,
        paths: ["tracked.txt"],
        staged: false,
        options: { whitespace: "show", contextLines: 3 },
      },
      { kind: "tree", repositoryId, revision: "HEAD", path: null },
      {
        kind: "fileHistory",
        repositoryId,
        path: "tracked.txt",
        skip: 0,
        limit: 50,
      },
      {
        kind: "blame",
        repositoryId,
        revision: "HEAD",
        path: "tracked.txt",
      },
      { kind: "stashList", repositoryId },
      {
        kind: "stashShow",
        repositoryId,
        stash: "stash@{0}",
        mode: "files",
      },
      { kind: "configList", repositoryId },
      { kind: "submoduleStatus", repositoryId },
      { kind: "signature", repositoryId, revision: "HEAD" },
      { kind: "checkIgnored", repositoryId, paths: ["ignored.txt"] },
      { kind: "mergedBranches", repositoryId, target: "HEAD" },
      {
        kind: "pushPreview",
        repositoryId,
        remote: "origin",
        remoteRef: "refs/heads/main",
        localRevision: "HEAD",
      },
      {
        kind: "historyRewritePreview",
        repositoryId,
        fromRevision: "HEAD",
      },
    ] satisfies readonly QueryGitRequest[];
    const output = new Map<QueryGitRequest["kind"], string>();

    expect(requests).toHaveLength(17);
    expect(new Set(requests.map(({ kind }) => kind)).size).toBe(17);
    for (const request of requests) {
      const { requestId, events } = await executeToTerminal(bridge, request);
      expect(events[0], request.kind).toMatchObject({
        kind: "started",
        requestId,
      });
      expect(events.at(-1), request.kind).toMatchObject({
        kind: "completed",
        requestId,
      });
      expect(
        events.slice(1, -1).every((event) => event.kind === "output"),
        request.kind,
      ).toBe(true);
      const sequences = events
        .filter((event) => event.kind === "output")
        .map((event) => (event.kind === "output" ? event.sequence : -1));
      expect(sequences, request.kind).toEqual(sequences.map((_, index) => index));
      output.set(
        request.kind,
        events
          .filter((event) => event.kind === "output")
          .map((event) => (event.kind === "output" ? event.data : ""))
          .join(""),
      );
    }

    expect(output.get("status")).toContain("token=private-token.txt");
    expect(output.get("log")).toContain("second query commit");
    expect(output.get("diff")).toContain("+working");
    expect(output.get("stashList")).toContain("query fixture stash");
    expect(output.get("configList")).toContain("[redacted]");
    expect(output.get("configList")).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890");
    expect(output.get("pushPreview")).toContain("refs/heads/main");
    await expect(
      bridge.loadPushPreview(repositoryId, "origin", "refs/heads/main", "HEAD"),
    ).resolves.toMatchObject({
      remote: "origin",
      remoteRef: "refs/heads/main",
      localOid: expect.stringMatching(/^[0-9a-f]{40}$/u),
      remoteStateError: null,
    });
    await expect(bridge.loadHistoryRewritePreview(repositoryId, "HEAD~1")).resolves.toMatchObject({
      branch: "main",
      descendantCount: 2,
      entries: [
        { subject: "first query commit", action: "pick" },
        { subject: "second query commit", action: "pick" },
      ],
    });
    await bridge.unwatchRepository(repositoryId);
  });

  it("transports patch, shelf, changelist, recovery, and conflict services against one disposable repository", async () => {
    const path = await createRepository();
    const storageRoot = join(dirname(path), "electron profile");
    await mkdir(storageRoot);
    const bridge = new ElectronGitBridge(
      bridgeApi(new GitUtility(undefined, undefined, storageRoot)),
    );
    const { id: repositoryId } = await bridge.openRepository(path);

    await writeFile(join(path, "tracked.txt"), "second\n", "utf8");
    git(path, "commit", "-am", "patch commit");
    const patchText = await bridge.createPatchText(repositoryId, ["HEAD"]);
    expect(patchText).toContain("Subject: [PATCH] patch commit");
    const patchPath = join(dirname(path), "exported patch.patch");
    const exported = await bridge.exportPatch(repositoryId, ["HEAD"], patchPath);
    expect(exported).toMatchObject({
      path: patchPath,
      commitCount: 1,
      sizeBytes: expect.any(Number),
    });
    expect(await readFile(patchPath, "utf8")).toBe(patchText);

    git(path, "reset", "--hard", "HEAD~1");
    await bridge.importPatch(repositoryId, patchPath);
    expect(git(path, "status", "--short")).toContain("M  tracked.txt");
    expect(await readFile(join(path, "tracked.txt"), "utf8")).toBe("second\n");
    git(path, "reset", "--hard", "HEAD");

    await writeFile(join(path, "tracked.txt"), "shelved\n", "utf8");
    await writeFile(join(path, "untracked.txt"), "untracked\n", "utf8");
    const shelf = await bridge.createShelf(repositoryId, "bridge shelf", [
      "tracked.txt",
      "untracked.txt",
    ]);
    expect(git(path, "status", "--short")).toBe("");
    await expect(bridge.listShelves(repositoryId)).resolves.toMatchObject([
      { id: shelf.id, message: "bridge shelf" },
    ]);
    await bridge.applyShelf(repositoryId, shelf.id, false);
    expect(await readFile(join(path, "tracked.txt"), "utf8")).toBe("shelved\n");
    expect(await readFile(join(path, "untracked.txt"), "utf8")).toBe("untracked\n");
    await bridge.deleteShelf(repositoryId, shelf.id);
    await expect(bridge.listShelves(repositoryId)).resolves.toEqual([]);
    git(path, "reset", "--hard", "HEAD");
    git(path, "clean", "-fd");

    await writeFile(join(path, "tracked.txt"), "changelist\n", "utf8");
    const changelist = await bridge.saveChangelist(repositoryId, null, "selected files", [
      "tracked.txt",
    ]);
    await expect(bridge.listChangelists(repositoryId)).resolves.toMatchObject([
      { id: changelist.id, paths: ["tracked.txt"] },
    ]);
    const commit = await bridge.commitChangelist(
      repositoryId,
      changelist.id,
      "changelist commit",
      false,
      false,
      false,
    );
    expect(commit.commitOid).toBe(git(path, "rev-parse", "HEAD").trim());
    await expect(bridge.listChangelists(repositoryId)).resolves.toEqual([]);

    const recoveryEntries = await bridge.listRecoveryEntries(repositoryId);
    expect(recoveryEntries).toEqual([
      expect.objectContaining({
        operation: "commit",
        branch: "main",
        recoverable: true,
      }),
    ]);
    const recoveryEntry = recoveryEntries[0];
    if (recoveryEntry === undefined) throw new Error("Expected a recovery entry");
    const restored = await bridge.restoreRecoveryEntry(repositoryId, recoveryEntry.id);
    expect(restored.restoredRefs).toEqual(["refs/heads/main"]);
    expect(git(path, "log", "-1", "--format=%s").trim()).toBe("fixture commit");
    git(path, "reset", "--hard", "HEAD");

    const disposable = await bridge.saveChangelist(repositoryId, null, "delete me", []);
    await bridge.deleteChangelist(repositoryId, disposable.id);
    await expect(bridge.listChangelists(repositoryId)).resolves.toEqual([]);

    git(path, "switch", "-c", "feature");
    await writeFile(join(path, "tracked.txt"), "feature\n", "utf8");
    git(path, "commit", "-am", "feature change");
    git(path, "switch", "main");
    await writeFile(join(path, "tracked.txt"), "main\n", "utf8");
    git(path, "commit", "-am", "main change");
    const merge = spawnSync("git", ["merge", "feature"], {
      cwd: path,
      env: GIT_ENVIRONMENT,
      encoding: "utf8",
      shell: false,
    });
    expect(merge.status).not.toBe(0);
    await expect(bridge.listConflicts(repositoryId)).resolves.toMatchObject([
      { path: "tracked.txt", binary: false },
    ]);
    await expect(bridge.readConflict(repositoryId, "tracked.txt")).resolves.toMatchObject({
      path: "tracked.txt",
      local: "main\n",
      remote: "feature\n",
    });
    await bridge.writeConflictResult(repositoryId, "tracked.txt", "resolved\n", true);
    await expect(bridge.listConflicts(repositoryId)).resolves.toEqual([]);
    git(path, "merge", "--abort");

    const secondMerge = spawnSync("git", ["merge", "feature"], {
      cwd: path,
      env: GIT_ENVIRONMENT,
      encoding: "utf8",
      shell: false,
    });
    expect(secondMerge.status).not.toBe(0);
    await bridge.resolveBinaryConflict(repositoryId, "tracked.txt", "ours");
    await expect(bridge.listConflicts(repositoryId)).resolves.toEqual([]);
    git(path, "merge", "--abort");
    await bridge.unwatchRepository(repositoryId);
  });

  it("executes representative index, commit, ref, stash, config, remote, and worktree mutations through one bridge lifecycle", async () => {
    const path = await createRepository();
    const bridge = new ElectronGitBridge(bridgeApi(new GitUtility()));
    const { id: repositoryId } = await bridge.openRepository(path);
    const worktreePath = join(path, "..", "linked worktree");

    await writeFile(join(path, "new file.txt"), "new\n", "utf8");
    await executeCompletedOperation(bridge, repositoryId, {
      kind: "stage",
      paths: ["new file.txt"],
    });
    expect(git(path, "status", "--short")).toContain('A  "new file.txt"');

    await executeCompletedOperation(bridge, repositoryId, {
      kind: "unstage",
      paths: ["new file.txt"],
    });
    expect(git(path, "status", "--short")).toContain('?? "new file.txt"');

    await executeCompletedOperation(bridge, repositoryId, {
      kind: "stageAll",
    });
    await executeCompletedOperation(bridge, repositoryId, {
      kind: "commit",
      message: "bridge mutation commit",
      amend: false,
      signOff: false,
      gpgSign: false,
    });
    expect(git(path, "log", "-1", "--format=%s").trim()).toBe("bridge mutation commit");

    await executeCompletedOperation(bridge, repositoryId, {
      kind: "createBranch",
      name: "bridge-feature",
      startPoint: "HEAD",
      checkout: false,
    });
    await executeCompletedOperation(bridge, repositoryId, {
      kind: "createTag",
      name: "bridge-v1",
      revision: "HEAD",
      message: null,
    });
    expect(git(path, "branch", "--list", "bridge-feature")).toContain("bridge-feature");
    expect(git(path, "tag", "--list", "bridge-v1").trim()).toBe("bridge-v1");

    await executeCompletedOperation(bridge, repositoryId, {
      kind: "setConfig",
      key: "gitclient.fixture",
      value: "enabled",
    });
    expect(git(path, "config", "--local", "gitclient.fixture").trim()).toBe("enabled");
    await executeCompletedOperation(bridge, repositoryId, {
      kind: "remoteAdd",
      name: "backup",
      url: join(path, "..", "backup.git"),
    });
    expect(git(path, "remote", "get-url", "backup").trim()).toBe(join(path, "..", "backup.git"));
    await executeCompletedOperation(bridge, repositoryId, {
      kind: "remoteRemove",
      name: "backup",
    });

    await writeFile(join(path, "tracked.txt"), "stashed\n", "utf8");
    await writeFile(join(path, "stash-untracked.txt"), "stash\n", "utf8");
    await executeCompletedOperation(bridge, repositoryId, {
      kind: "stashPush",
      message: "bridge stash",
      includeUntracked: true,
      keepIndex: false,
    });
    expect(git(path, "status", "--porcelain")).toBe("");
    await executeCompletedOperation(bridge, repositoryId, {
      kind: "stashApply",
      stash: "stash@{0}",
      pop: false,
      reinstateIndex: false,
    });
    expect(git(path, "status", "--porcelain")).toContain("tracked.txt");
    git(path, "reset", "--hard", "HEAD");
    git(path, "clean", "-fd");
    await executeCompletedOperation(bridge, repositoryId, {
      kind: "stashDrop",
      stash: "stash@{0}",
    });
    expect(git(path, "stash", "list")).toBe("");

    await executeCompletedOperation(bridge, repositoryId, {
      kind: "worktreeAdd",
      path: worktreePath,
      branch: "bridge-worktree",
      startPoint: "HEAD",
    });
    expect(git(path, "worktree", "list", "--porcelain")).toContain(await realpath(worktreePath));
    await executeCompletedOperation(bridge, repositoryId, {
      kind: "worktreeRemove",
      path: worktreePath,
      force: false,
    });
    expect(git(path, "worktree", "list", "--porcelain")).not.toContain(worktreePath);
    await bridge.unwatchRepository(repositoryId);
  });

  it("preserves started/output/failed ordering for a real Git error", async () => {
    const path = await createQueryRepository();
    const bridge = new ElectronGitBridge(bridgeApi(new GitUtility()));
    const { id: repositoryId } = await bridge.openRepository(path);

    const { events } = await executeToTerminal(bridge, {
      kind: "commitDetails",
      repositoryId,
      revision: "f".repeat(40),
    });

    expect(events[0]?.kind).toBe("started");
    expect(events.slice(1, -1).every((event) => event.kind === "output")).toBe(true);
    expect(events.at(-1)?.kind).toBe("failed");
    await bridge.unwatchRepository(repositoryId);
  });

  it("preserves alternating stdout and stderr chronology from the process runner to the bridge", async () => {
    const path = await createQueryRepository();
    const fakeGit = join(path, "alternating-git");
    await writeFile(
      fakeGit,
      [
        `#!${process.execPath}`,
        "process.stdout.write('stdout-1\\n');",
        "setTimeout(() => process.stderr.write('stderr-1\\n'), 20);",
        "setTimeout(() => process.stdout.write('stdout-2\\n'), 40);",
        "setTimeout(() => process.exit(0), 60);",
        "",
      ].join("\n"),
      "utf8",
    );
    await chmod(fakeGit, 0o755);
    const registry = new RepositoryRegistry(new GitProcessRunner());
    const repository = await registry.open(path);
    const queries = new GitQueryService(registry, new GitProcessRunner(fakeGit));
    const api: ElectronGitApi = {
      ...bridgeApi(new GitUtility()),
      executeQuery: (request, listener) => queries.execute(request, listener),
    };
    const bridge = new ElectronGitBridge(api);

    const { events } = await executeToTerminal(bridge, {
      kind: "status",
      repositoryId: repository.id,
    });

    expect(events.map(({ kind }) => kind)).toEqual([
      "started",
      "output",
      "output",
      "output",
      "completed",
    ]);
    expect(
      events
        .filter((event) => event.kind === "output")
        .map((event) => ({
          sequence: event.sequence,
          stream: event.stream,
          data: event.data,
        })),
    ).toEqual([
      { sequence: 0, stream: "stdout", data: "stdout-1\n" },
      { sequence: 1, stream: "stderr", data: "stderr-1\n" },
      { sequence: 2, stream: "stdout", data: "stdout-2\n" },
    ]);
  });
});
