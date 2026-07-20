import { describe, expect, it } from "vitest";
import type {
  GitExecutionRequest,
  GitCreationEvent,
  GitCreationEventListener,
  GitEventListener,
  GitMultiRootResult as ElectronMultiRootResult,
  GitRequestId,
  GitTerminalEvent,
  RepositoryRecord,
} from "../shared/contracts/git-utility";
import type {
  BranchComparison,
  Changelist,
  ChangelistCommitResult,
  CloneOptions,
  CommitSignature,
  ConflictContent,
  ConflictFile,
  FileContent,
  FilePreview,
  FileSource,
  GitEvent,
  GitConfig,
  GitOperation,
  GitRequest,
  HistoryRewritePreview,
  IgnoreRules,
  MultiRootOutcome,
  MultiRootRollbackStep,
  PatchExportResult,
  PreCommitCheck,
  PushPreview,
  RecoveryEntry,
  RecoveryRestoreResult,
  RemoteInfo,
  RepositoryChangedEvent,
  RepositorySnapshot,
  ShelfEntry,
  SubmoduleInfo,
  SubmoduleDiff,
  WorktreeInfo,
} from "../shared/contracts/model";
import { ElectronGitBridge, translateGitRequest, type ElectronGitApi } from "./ElectronGitBridge";

const repositoryId = "29bc4af1-0c76-4f1d-a729-4d92f461c797";
const requestId = "de18806c-5bc7-4b17-b15b-4478dbac9009";
const headOid = "0123456789abcdef0123456789abcdef01234567";
const shelfId = "896b19c6-dd8f-4f7b-a591-cf701e86457c";
const changelistId = "723094e7-bf3b-4d3e-8f74-6cebe9571840";
const recoveryId = "53f66fe0-6b52-4a69-9b9f-b07c724f9095";
const checksum = "a".repeat(64);

const repository: RepositoryRecord = {
  id: repositoryId,
  name: "sample",
  path: "/tmp/sample",
  gitDirectory: "/tmp/sample/.git",
  commonDirectory: "/tmp/sample/.git",
  isBare: false,
  gitVersion: {
    major: 2,
    minor: 50,
    patch: 1,
    display: "git version 2.50.1",
  },
};

const statusOutput = [
  `# branch.oid ${headOid}`,
  "# branch.head main",
  "# branch.upstream origin/main",
  "# branch.ab +2 -1",
  "",
].join("\0");

class FakeGitApi implements ElectronGitApi {
  readonly queries: GitExecutionRequest[] = [];
  readonly closed: string[] = [];
  readonly cancelled: string[] = [];
  readonly initialized: Array<Readonly<{ path: string; bare: boolean }>> = [];
  readonly cloned: Array<Readonly<{ url: string; path: string; options: CloneOptions }>> = [];
  readonly fileReads: Array<Readonly<{ source: FileSource; path: string; preview: boolean }>> = [];
  readonly unwatched: string[] = [];
  readonly watchers = new Map<string, (event: RepositoryChangedEvent) => void>();
  readonly outputs: Readonly<
    Partial<Record<Exclude<GitExecutionRequest["kind"], "operation">, string>>
  >;
  inspectionCount = 0;
  currentRecord = repository;
  ignoreRules: IgnoreRules = {
    gitignore: "dist/\n",
    infoExclude: ".cache/\n",
  };

  constructor(
    outputs: Readonly<
      Partial<Record<Exclude<GitExecutionRequest["kind"], "operation">, string>>
    > = {},
  ) {
    this.outputs = outputs;
  }

  async openRepository(_path: string): Promise<RepositoryRecord> {
    this.currentRecord = repository;
    return repository;
  }

  async initializeRepository(
    path: string,
    bare: boolean,
    listener?: GitCreationEventListener,
  ): Promise<RepositoryRecord> {
    listener?.({
      kind: "started",
      requestId,
      operation: "initialize",
      displayCommand: "git init",
      startedAtMs: 1,
    });
    this.initialized.push({ path, bare });
    this.currentRecord = { ...repository, path, isBare: bare };
    return this.currentRecord;
  }

  async cloneRepository(
    url: string,
    path: string,
    options: CloneOptions,
    listener?: GitCreationEventListener,
  ): Promise<RepositoryRecord> {
    listener?.({
      kind: "started",
      requestId,
      operation: "clone",
      displayCommand: "git clone <redacted-url>",
      startedAtMs: 1,
    });
    this.cloned.push({ url, path, options });
    this.currentRecord = { ...repository, path };
    return this.currentRecord;
  }

  async inspectSnapshot(_id: string): Promise<RepositorySnapshot> {
    this.inspectionCount += 1;
    return {
      ...this.currentRecord,
      currentBranch: "main",
      headOid,
      upstream: "origin/main",
      remoteUrl: "https://example.invalid/repository.git",
      ahead: 4,
      behind: 2,
      isShallow: true,
      isDetached: false,
      hasCommits: true,
      operation: "merge",
    };
  }

  async compareBranches(_id: string, _left: string, _right: string): Promise<BranchComparison> {
    return { ahead: 1, behind: 0, leftOnly: [headOid], rightOnly: [] };
  }

  async preCommitCheck(_id: string): Promise<PreCommitCheck> {
    return {
      branch: "main",
      detachedHead: false,
      protectedBranch: true,
      crlfPaths: [],
      largeFiles: [],
      riskyPaths: [],
      hooks: ["pre-commit"],
    };
  }

  async listGitConfig(_id: string): Promise<readonly GitConfig[]> {
    return [
      {
        key: "user.name",
        value: "Ada",
        origin: "file:.git/config",
        scope: "local",
      },
    ];
  }

  async listSubmodules(_id: string): Promise<readonly SubmoduleInfo[]> {
    return [];
  }

  async listMergedBranches(_id: string, _target: string): Promise<readonly string[]> {
    return ["main"];
  }

  async loadCommitSignature(_id: string, _revision: string): Promise<CommitSignature> {
    return {
      status: "N",
      fingerprint: null,
      signer: null,
      keyId: null,
      trust: null,
    };
  }

  async listRemotes(_id: string): Promise<readonly RemoteInfo[]> {
    return [
      {
        name: "origin",
        fetchUrl: "https://example.invalid/repository.git",
        pushUrl: "https://example.invalid/repository.git",
      },
    ];
  }

  async listWorktrees(_id: string): Promise<readonly WorktreeInfo[]> {
    return [
      {
        path: repository.path,
        headOid,
        branch: "main",
        bare: false,
        detached: false,
        locked: false,
        prunable: false,
        isMain: true,
      },
    ];
  }

  async readIgnoreRules(_id: string): Promise<IgnoreRules> {
    return this.ignoreRules;
  }

  async writeIgnoreRules(_id: string, rules: IgnoreRules): Promise<void> {
    this.ignoreRules = rules;
  }

  async loadPushPreview(
    _id: string,
    remote: string | null,
    remoteRef: string | null,
    localRevision: string,
  ): Promise<PushPreview> {
    return {
      sourceBranch: "main",
      sourceRevision: localRevision,
      localOid: headOid,
      remote: remote ?? "origin",
      remoteRef: remoteRef ?? "refs/heads/main",
      upstreamConfigured: true,
      setUpstreamDefault: false,
      remoteOid: headOid,
      expectedLeaseOid: headOid,
      ahead: 0,
      behind: 0,
      fastForward: true,
      newBranch: false,
      commits: [],
      remoteOnlyCommits: [],
      protectedBranch: true,
      checkedAtMs: 1,
      remoteStateError: null,
      warnings: [],
    };
  }

  async loadHistoryRewritePreview(
    _id: string,
    _fromRevision: string,
  ): Promise<HistoryRewritePreview> {
    return {
      branch: "main",
      headOid,
      base: null,
      root: true,
      entries: [
        {
          oid: headOid,
          subject: "fixture",
          parents: [],
          action: "pick",
          message: null,
          published: false,
          mergeCommit: false,
        },
      ],
      publishedCommitCount: 0,
      descendantCount: 1,
      dependentRefs: [],
      hasMerges: false,
      protectedBranch: true,
      warnings: [],
    };
  }

  async exportPatch(
    _id: string,
    revisions: readonly string[],
    targetPath: string,
  ): Promise<PatchExportResult> {
    return {
      path: targetPath,
      sizeBytes: 128,
      commitCount: revisions.length,
    };
  }

  async createPatchText(_id: string, revisions: readonly string[]): Promise<string> {
    return `patch:${revisions.join(",")}`;
  }

  async importPatch(_id: string, _path: string): Promise<void> {}

  async createShelf(_id: string, message: string, paths: readonly string[]): Promise<ShelfEntry> {
    return {
      id: shelfId,
      repositoryId,
      message,
      createdAtMs: 1,
      files: paths.map((path) => ({
        path,
        checksum: "",
        untracked: false,
      })),
      indexPatchChecksum: checksum,
      worktreePatchChecksum: checksum,
    };
  }

  async listShelves(_id: string): Promise<readonly ShelfEntry[]> {
    return [await this.createShelf(repositoryId, "saved", ["tracked.txt"])];
  }

  async applyShelf(_id: string, _shelfId: string, _dropAfterApply: boolean): Promise<void> {}

  async deleteShelf(_id: string, _shelfId: string): Promise<void> {}

  async listChangelists(_id: string): Promise<readonly Changelist[]> {
    return [
      {
        id: changelistId,
        repositoryId,
        name: "selected",
        paths: ["tracked.txt"],
        createdAtMs: 1,
        updatedAtMs: 1,
      },
    ];
  }

  async saveChangelist(
    _repositoryId: string,
    id: string | null,
    name: string,
    paths: readonly string[],
  ): Promise<Changelist> {
    return {
      id: id ?? changelistId,
      repositoryId,
      name,
      paths: [...paths],
      createdAtMs: 1,
      updatedAtMs: 1,
    };
  }

  async deleteChangelist(_repositoryId: string, _changelistId: string): Promise<void> {}

  async commitChangelist(
    _repositoryId: string,
    selectedChangelistId: string,
    _message: string,
    _amend: boolean,
    _signOff: boolean,
    _gpgSign: boolean,
  ): Promise<ChangelistCommitResult> {
    return { changelistId: selectedChangelistId, commitOid: headOid };
  }

  async listRecoveryEntries(_id: string): Promise<readonly RecoveryEntry[]> {
    return [
      {
        id: recoveryId,
        repositoryId,
        operation: "commit",
        createdAtMs: 1,
        branch: "main",
        headOid,
        refs: [{ name: "refs/heads/main", oid: headOid }],
        recoverable: true,
      },
    ];
  }

  async restoreRecoveryEntry(_id: string, entryId: string): Promise<RecoveryRestoreResult> {
    return { entryId, restoredRefs: ["refs/heads/main"] };
  }

  async listConflicts(_id: string): Promise<readonly ConflictFile[]> {
    return [
      {
        path: "tracked.txt",
        baseOid: headOid,
        localOid: headOid,
        remoteOid: headOid,
        binary: false,
      },
    ];
  }

  async readConflict(_id: string, path: string): Promise<ConflictContent> {
    return {
      path,
      base: "base\n",
      local: "local\n",
      remote: "remote\n",
      result: "result\n",
      binary: false,
      localLabel: "HEAD",
      remoteLabel: "feature",
    };
  }

  async writeConflictResult(
    _id: string,
    _path: string,
    _result: string,
    _stage: boolean,
  ): Promise<void> {}

  async resolveBinaryConflict(
    _id: string,
    _path: string,
    _side: "ours" | "theirs",
  ): Promise<void> {}

  async closeRepository(id: string): Promise<boolean> {
    this.closed.push(id);
    return true;
  }

  async readFile(_repositoryId: string, source: FileSource, path: string): Promise<FileContent> {
    this.fileReads.push({ source, path, preview: false });
    return {
      kind: "text",
      path,
      content: "file contents\n",
      sizeBytes: 14,
      lineCount: 1,
    };
  }

  async readFilePreview(
    _repositoryId: string,
    source: FileSource,
    path: string,
  ): Promise<FilePreview> {
    this.fileReads.push({ source, path, preview: true });
    return { kind: "binary", path, sizeBytes: 3 };
  }

  async loadSubmoduleDiff(
    _repositoryId: string,
    _before: FileSource,
    _after: FileSource,
    path: string,
  ): Promise<SubmoduleDiff> {
    return {
      path,
      beforeOid: headOid,
      afterOid: headOid,
      beforeSubject: "before",
      afterSubject: "after",
      ahead: 0,
      behind: 0,
    };
  }

  async openWorkingTreeFile(_repositoryId: string, _path: string): Promise<void> {}

  async executeSynchronizedBranchOperation(
    repositoryIds: readonly string[],
    _operation: GitOperation,
  ): Promise<ElectronMultiRootResult> {
    return {
      outcomes: repositoryIds.map((id) => ({
        repositoryId: id,
        path: repository.path,
        succeeded: true,
        message: "completed",
      })),
      rollbackPlan: [],
    };
  }

  async applyMultiRootRollback(
    steps: readonly MultiRootRollbackStep[],
  ): Promise<readonly MultiRootOutcome[]> {
    return steps.map((step) => ({
      repositoryId: step.repositoryId,
      path: step.path,
      succeeded: true,
      message: "rollback completed",
    }));
  }

  async watchRepository(
    id: string,
    listener: (event: RepositoryChangedEvent) => void,
  ): Promise<void> {
    this.watchers.set(id, listener);
  }

  async unwatchRepository(id: string): Promise<void> {
    this.unwatched.push(id);
    this.watchers.delete(id);
  }

  async executeQuery(
    request: GitExecutionRequest,
    listener: GitEventListener,
  ): Promise<GitTerminalEvent> {
    this.queries.push(request);
    listener({
      kind: "started",
      requestId: request.requestId,
      displayCommand: `git ${request.kind}`,
      startedAtMs: 1,
    });
    listener({
      kind: "output",
      requestId: request.requestId,
      sequence: 0,
      stream: "stdout",
      data: request.kind === "operation" ? "" : (this.outputs[request.kind] ?? ""),
    });
    listener({
      kind: "output",
      requestId: request.requestId,
      sequence: 1,
      stream: "stderr",
      data: "non-parser warning",
    });
    const terminal: GitTerminalEvent = {
      kind: "completed",
      requestId: request.requestId,
      exitCode: 0,
      durationMs: 2,
    };
    listener(terminal);
    return terminal;
  }

  async cancelQuery(id: GitRequestId): Promise<boolean> {
    this.cancelled.push(id);
    return true;
  }
}

class RejectingGitApi extends FakeGitApi {
  override async executeQuery(
    _request: GitExecutionRequest,
    _listener: GitEventListener,
  ): Promise<GitTerminalEvent> {
    throw new Error("transport unavailable");
  }
}

class AliasingGitApi extends FakeGitApi {
  readonly shelf: ShelfEntry = {
    id: shelfId,
    repositoryId,
    message: "saved",
    createdAtMs: 1,
    files: [{ path: "tracked.txt", checksum: "", untracked: false }],
    indexPatchChecksum: checksum,
    worktreePatchChecksum: checksum,
  };
  readonly changelist: Changelist = {
    id: changelistId,
    repositoryId,
    name: "selected",
    paths: ["tracked.txt"],
    createdAtMs: 1,
    updatedAtMs: 1,
  };
  readonly recovery: RecoveryEntry = {
    id: recoveryId,
    repositoryId,
    operation: "commit",
    createdAtMs: 1,
    branch: "main",
    headOid,
    refs: [{ name: "refs/heads/main", oid: headOid }],
    recoverable: true,
  };
  readonly restored: RecoveryRestoreResult = {
    entryId: recoveryId,
    restoredRefs: ["refs/heads/main"],
  };

  override async listShelves(_id: string): Promise<readonly ShelfEntry[]> {
    return [this.shelf];
  }

  override async listChangelists(_id: string): Promise<readonly Changelist[]> {
    return [this.changelist];
  }

  override async listRecoveryEntries(_id: string): Promise<readonly RecoveryEntry[]> {
    return [this.recovery];
  }

  override async restoreRecoveryEntry(
    _id: string,
    _entryId: string,
  ): Promise<RecoveryRestoreResult> {
    return this.restored;
  }
}

describe("ElectronGitBridge", () => {
  it("copies readonly transport DTO collections into generated bridge values", async () => {
    const api = new AliasingGitApi();
    const bridge = new ElectronGitBridge(api);

    const [shelf] = await bridge.listShelves(repositoryId);
    const [changelist] = await bridge.listChangelists(repositoryId);
    const [recovery] = await bridge.listRecoveryEntries(repositoryId);
    const restored = await bridge.restoreRecoveryEntry(repositoryId, recoveryId);

    expect(shelf).not.toBe(api.shelf);
    expect(shelf?.files).not.toBe(api.shelf.files);
    expect(shelf?.files[0]).not.toBe(api.shelf.files[0]);
    expect(changelist).not.toBe(api.changelist);
    expect(changelist?.paths).not.toBe(api.changelist.paths);
    expect(recovery).not.toBe(api.recovery);
    expect(recovery?.refs).not.toBe(api.recovery.refs);
    expect(recovery?.refs[0]).not.toBe(api.recovery.refs[0]);
    expect(restored).not.toBe(api.restored);
    expect(restored.restoredRefs).not.toBe(api.restored.restoredRefs);
  });

  it("opens with the complete utility-inspected repository snapshot", async () => {
    const api = new FakeGitApi({ status: statusOutput });
    const bridge = new ElectronGitBridge(api);

    await expect(bridge.openRepository(repository.path)).resolves.toMatchObject({
      id: repositoryId,
      currentBranch: "main",
      headOid,
      upstream: "origin/main",
      ahead: 4,
      behind: 2,
      remoteUrl: "https://example.invalid/repository.git",
      isShallow: true,
      hasCommits: true,
      isDetached: false,
      operation: "merge",
    });
    expect(api.inspectionCount).toBe(1);
    expect(api.queries).toEqual([]);
  });

  it("initializes and stores a status-backed repository snapshot", async () => {
    const api = new FakeGitApi({ status: statusOutput });
    const bridge = new ElectronGitBridge(api);
    const events: GitCreationEvent[] = [];

    await expect(
      bridge.initializeRepository("/tmp/new repository", false, (event) => events.push(event)),
    ).resolves.toMatchObject({
      id: repositoryId,
      path: "/tmp/new repository",
      currentBranch: "main",
      headOid,
    });
    expect(api.initialized).toEqual([{ path: "/tmp/new repository", bare: false }]);
    expect(events.map(({ kind }) => kind)).toEqual(["started"]);
    await expect(bridge.refreshRepository(repositoryId)).resolves.toMatchObject({
      currentBranch: "main",
    });
  });

  it("clones and stores a status-backed repository snapshot", async () => {
    const api = new FakeGitApi({ status: statusOutput });
    const bridge = new ElectronGitBridge(api);
    const options: CloneOptions = {
      depth: 1,
      branch: "main",
      recurseSubmodules: true,
    };
    const events: GitCreationEvent[] = [];

    await expect(
      bridge.cloneRepository(
        "https://example.invalid/repository.git",
        "/tmp/cloned repository",
        options,
        (event) => events.push(event),
      ),
    ).resolves.toMatchObject({
      id: repositoryId,
      path: "/tmp/cloned repository",
      currentBranch: "main",
      headOid,
    });
    expect(api.cloned).toEqual([
      {
        url: "https://example.invalid/repository.git",
        path: "/tmp/cloned repository",
        options,
      },
    ]);
    expect(events.map(({ kind }) => kind)).toEqual(["started"]);
  });

  it("settles once when preload delivers the terminal through both listener and Promise", async () => {
    const refsOutput = [
      "refs/heads/main",
      "oid",
      "commit",
      "*",
      "",
      "",
      "subject",
      "Ada",
      "1700000000",
      "\n",
    ].join("\0");
    const api = new FakeGitApi({ refs: refsOutput });
    const bridge = new ElectronGitBridge(api);
    await bridge.openRepository(repository.path);
    const events: GitEvent[] = [];

    const id = await bridge.execute({ kind: "refs", repositoryId }, (event) => events.push(event));
    await Promise.resolve();

    expect(id).toMatch(/^[0-9a-f-]{36}$/u);
    expect(events.filter((event) => event.kind === "started")).toHaveLength(1);
    expect(events.filter((event) => event.kind === "completed")).toHaveLength(1);
    expect(events.find((event) => event.kind === "output")).toMatchObject({
      kind: "output",
      data: refsOutput,
    });
    expect(events.map((event) => event.kind)).toEqual(["started", "output", "output", "completed"]);
    expect(
      events.find((event) => event.kind === "output" && event.stream === "stderr"),
    ).toMatchObject({ data: "non-parser warning" });
  });

  it("transports bounded diff and file reads without exposing a filesystem path API", async () => {
    const api = new FakeGitApi({
      diff: "diff --git a/tracked.txt b/tracked.txt\n+changed\n",
    });
    const bridge = new ElectronGitBridge(api);
    const events: GitEvent[] = [];

    await bridge.execute(
      {
        kind: "diff",
        repositoryId,
        from: null,
        to: null,
        paths: ["tracked.txt"],
        staged: false,
        options: { whitespace: "show", contextLines: 3 },
      },
      (event) => events.push(event),
    );
    await expect(
      bridge.readFile(repositoryId, { kind: "revision", revision: "HEAD" }, "tracked.txt"),
    ).resolves.toMatchObject({ kind: "text", content: "file contents\n" });
    await expect(
      bridge.readFilePreview(repositoryId, { kind: "workingTree" }, "image.bin"),
    ).resolves.toEqual({ kind: "binary", path: "image.bin", sizeBytes: 3 });

    expect(api.queries.at(-1)).toMatchObject({
      kind: "diff",
      paths: ["tracked.txt"],
    });
    expect(events.find((event) => event.kind === "output")).toMatchObject({
      kind: "output",
      data: expect.stringContaining("+changed"),
    });
    expect(api.fileReads).toEqual([
      {
        source: { kind: "revision", revision: "HEAD" },
        path: "tracked.txt",
        preview: false,
      },
      {
        source: { kind: "workingTree" },
        path: "image.bin",
        preview: true,
      },
    ]);
  });

  it("delegates branch comparison, pre-commit inspection, and commit signatures", async () => {
    const bridge = new ElectronGitBridge(new FakeGitApi());

    await expect(bridge.compareBranches(repositoryId, "feature", "main")).resolves.toEqual({
      ahead: 1,
      behind: 0,
      leftOnly: [headOid],
      rightOnly: [],
    });
    await expect(bridge.preCommitCheck(repositoryId)).resolves.toMatchObject({
      branch: "main",
      protectedBranch: true,
      hooks: ["pre-commit"],
    });
    await expect(bridge.loadCommitSignature(repositoryId, "HEAD")).resolves.toMatchObject({
      status: "N",
      fingerprint: null,
    });
  });

  it("delegates repository configuration, refs, submodules, remotes, and worktrees", async () => {
    const bridge = new ElectronGitBridge(new FakeGitApi());

    await expect(bridge.listGitConfig(repositoryId)).resolves.toEqual([
      {
        key: "user.name",
        value: "Ada",
        origin: "file:.git/config",
        scope: "local",
      },
    ]);
    await expect(bridge.listSubmodules(repositoryId)).resolves.toEqual([]);
    await expect(bridge.listMergedBranches(repositoryId, "HEAD")).resolves.toEqual(["main"]);
    await expect(bridge.listRemotes(repositoryId)).resolves.toEqual([
      {
        name: "origin",
        fetchUrl: "https://example.invalid/repository.git",
        pushUrl: "https://example.invalid/repository.git",
      },
    ]);
    await expect(bridge.listWorktrees(repositoryId)).resolves.toMatchObject([
      { path: repository.path, branch: "main", isMain: true },
    ]);
  });

  it("reads and writes repository ignore rules through the utility API", async () => {
    const api = new FakeGitApi();
    const bridge = new ElectronGitBridge(api);

    await expect(bridge.readIgnoreRules(repositoryId)).resolves.toEqual({
      gitignore: "dist/\n",
      infoExclude: ".cache/\n",
    });
    await bridge.writeIgnoreRules(repositoryId, {
      gitignore: "coverage/\n",
      infoExclude: ".work/\n",
    });
    await expect(bridge.readIgnoreRules(repositoryId)).resolves.toEqual({
      gitignore: "coverage/\n",
      infoExclude: ".work/\n",
    });
  });

  it("forwards repository invalidations and tears down the watcher before closing", async () => {
    const api = new FakeGitApi({ status: statusOutput });
    const bridge = new ElectronGitBridge(api);
    const events: RepositoryChangedEvent[] = [];
    await bridge.openRepository(repository.path);

    await bridge.watchRepository(repositoryId, (event) => events.push(event));
    api.watchers.get(repositoryId)?.({
      repositoryId,
      invalidations: ["status", "history"],
    });
    await bridge.unwatchRepository(repositoryId);

    expect(events).toEqual([{ repositoryId, invalidations: ["status", "history"] }]);
    expect(api.unwatched).toEqual([repositoryId]);
    expect(api.closed).toEqual([repositoryId]);
  });

  it("transports non-operation requests without narrowing log semantics", async () => {
    const api = new FakeGitApi();
    const bridge = new ElectronGitBridge(api);
    const commitDetails: GitRequest = {
      kind: "commitDetails",
      repositoryId,
      revision: "HEAD",
    };
    const operation: GitRequest = {
      kind: "operation",
      repositoryId,
      operation: { kind: "fetch", remote: "origin", prune: false },
    };

    await expect(bridge.execute(commitDetails, () => undefined)).resolves.toMatch(
      /^[0-9a-f-]{36}$/u,
    );
    await Promise.resolve();
    expect(api.queries.at(-1)).toMatchObject({
      kind: "commitDetails",
      repositoryId,
      revision: "HEAD",
    });
    await expect(bridge.execute(operation, () => undefined)).resolves.toMatch(/^[0-9a-f-]{36}$/u);
    await Promise.resolve();
    expect(api.queries.at(-1)).toMatchObject({
      kind: "operation",
      repositoryId,
      operation: { kind: "fetch", remote: "origin", prune: false },
    });
    expect(
      translateGitRequest(
        {
          kind: "log",
          repositoryId,
          skip: 7,
          limit: 100,
          order: "date",
          filters: {
            query: "fix",
            branch: "main",
            author: "Ada",
            since: "2025-01-01",
            until: "2026-01-01",
            paths: ["src"],
            noMerges: true,
            regex: false,
            matchCase: false,
          },
        },
        requestId,
      ),
    ).toMatchObject({
      kind: "log",
      requestId,
      skip: 7,
      order: "date",
      filters: { author: "Ada", noMerges: true },
    });
    expect(() =>
      translateGitRequest(
        {
          kind: "diff",
          repositoryId,
          from: null,
          to: null,
          paths: [],
          staged: false,
          options: { whitespace: "show", contextLines: 7 },
        },
        requestId,
      ),
    ).toThrow("Diff context lines must be 3, 5, 10, or null");
    await expect(
      bridge.loadPushPreview(repositoryId, "origin", "refs/heads/main", "HEAD"),
    ).resolves.toMatchObject({
      remote: "origin",
      remoteRef: "refs/heads/main",
      localOid: headOid,
    });
    await expect(bridge.loadHistoryRewritePreview(repositoryId, "HEAD~1")).resolves.toMatchObject({
      branch: "main",
      headOid,
    });
  });

  it("synthesizes started before failed when the query transport rejects", async () => {
    const bridge = new ElectronGitBridge(new RejectingGitApi());
    const events: GitEvent[] = [];
    let resolveTerminal: (() => void) | undefined;
    const terminal = new Promise<void>((resolve) => {
      resolveTerminal = resolve;
    });

    const returnedRequestId = await bridge.execute({ kind: "status", repositoryId }, (event) => {
      events.push(event);
      if (event.kind === "failed") resolveTerminal?.();
    });
    await terminal;

    expect(events.map(({ kind }) => kind)).toEqual(["started", "failed"]);
    expect(events[0]).toMatchObject({
      kind: "started",
      requestId: returnedRequestId,
      displayCommand: "git status",
    });
    expect(events[1]).toMatchObject({
      kind: "failed",
      requestId: returnedRequestId,
      message: "transport unavailable",
    });
  });

  it("closes the utility repository when the session unwatches it", async () => {
    const api = new FakeGitApi({ status: statusOutput });
    const bridge = new ElectronGitBridge(api);
    await bridge.openRepository(repository.path);

    await bridge.unwatchRepository(repositoryId);

    expect(api.closed).toEqual([repositoryId]);
    await expect(bridge.refreshRepository(repositoryId)).rejects.toThrow("Repository is not open");
  });

  it("forwards cancellation without inventing a successful result", async () => {
    const api = new FakeGitApi();
    const bridge = new ElectronGitBridge(api);

    await bridge.cancel(requestId);

    expect(api.cancelled).toEqual([requestId]);
  });
});
