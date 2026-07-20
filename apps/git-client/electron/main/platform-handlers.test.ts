import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  FileContent,
  FilePreview,
  GitCreationEvent,
  GitCreationEventListener,
  GitCreationTerminalEvent,
  GitExecutionRequest,
  GitEventListener,
  GitQueryRequest,
  GitRequestEvent,
  GitRepositoryServiceRequest,
  GitRepositoryServiceResult,
  GitTerminalEvent,
  RepositoryChangedEvent,
  RepositoryChangedListener,
  RepositoryRecord,
} from "../../src/shared/contracts/git-utility";
import { IPC_CHANNELS } from "../../src/shared/contracts/ipc";
import type { RepositorySnapshot } from "../../src/shared/contracts/model";
import type { TerminalEventEnvelope } from "../../src/shared/contracts/terminal";

type InvokeHandler = (event: unknown, raw: unknown) => unknown;

const electronMock = vi.hoisted(() => ({
  handlers: new Map<string, InvokeHandler>(),
  clipboardWriteText: vi.fn(),
  openExternal: vi.fn(),
  openPath: vi.fn(),
}));

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: vi.fn(() => null) },
  clipboard: { writeText: electronMock.clipboardWriteText },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
  ipcMain: {
    handle: (channel: string, handler: InvokeHandler): void => {
      electronMock.handlers.set(channel, handler);
    },
    removeHandler: (channel: string): void => {
      electronMock.handlers.delete(channel);
    },
  },
  shell: {
    openExternal: electronMock.openExternal,
    openPath: electronMock.openPath,
  },
}));

import { registerPlatformHandlers, unregisterPlatformHandlers } from "./platform-handlers";

const REPOSITORY_ID = "02fc7f7c-3f66-514b-9470-451a776cfcc7";
const REQUEST_ID = "388ac97b-6f01-4e10-8149-78ec15412d18";
const REPOSITORY: RepositoryRecord = Object.freeze({
  id: REPOSITORY_ID,
  name: "repository",
  path: "/tmp/repository",
  gitDirectory: "/tmp/repository/.git",
  commonDirectory: "/tmp/repository/.git",
  isBare: false,
  gitVersion: Object.freeze({
    major: 2,
    minor: 55,
    patch: 0,
    display: "git version 2.55.0",
  }),
});
const SNAPSHOT: RepositorySnapshot = Object.freeze({
  ...REPOSITORY,
  currentBranch: "main",
  headOid: "0123456789abcdef0123456789abcdef01234567",
  upstream: "origin/main",
  remoteUrl: "https://example.invalid/repository.git",
  ahead: 2,
  behind: 1,
  isShallow: false,
  isDetached: false,
  hasCommits: true,
  operation: null,
});
const PUSH_PREVIEW = {
  sourceBranch: "main",
  sourceRevision: "HEAD",
  localOid: SNAPSHOT.headOid!,
  remote: "origin",
  remoteRef: "refs/heads/main",
  upstreamConfigured: true,
  setUpstreamDefault: false,
  remoteOid: SNAPSHOT.headOid,
  expectedLeaseOid: SNAPSHOT.headOid,
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
const HISTORY_REWRITE_PREVIEW = {
  branch: "main",
  headOid: SNAPSHOT.headOid!,
  base: null,
  root: true,
  entries: [
    {
      oid: SNAPSHOT.headOid!,
      subject: "fixture",
      parents: [],
      action: "pick" as const,
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
const FILE_CONTENT: FileContent = Object.freeze({
  kind: "text",
  path: "tracked.txt",
  content: "content\n",
  sizeBytes: 8,
  lineCount: 1,
});
const FILE_PREVIEW: FilePreview = Object.freeze({
  kind: "binary",
  path: "tracked.bin",
  sizeBytes: 4,
});
const REPOSITORY_CHANGED: RepositoryChangedEvent = {
  repositoryId: REPOSITORY_ID,
  invalidations: ["status", "management"],
};

function handler(channel: string): InvokeHandler {
  const registered = electronMock.handlers.get(channel);
  if (registered === undefined) throw new Error(`No handler registered for ${channel}`);
  return registered;
}

describe("platform Git IPC handlers", () => {
  beforeEach(() => {
    electronMock.handlers.clear();
    electronMock.openExternal.mockReset();
    electronMock.openPath.mockReset();
  });

  it("opens only validated HTTP(S) URLs for the trusted renderer", async () => {
    const mainFrame = { url: "app://git-client/" };
    const webContents = {
      isDestroyed: () => false,
      mainFrame,
      send: vi.fn(),
    };
    registerPlatformHandlers({
      window: { isDestroyed: () => false, webContents },
      settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
      menu: { sync: vi.fn() },
      gitUtility: {},
      terminalUtility: {},
      runtime: {
        kind: "electron",
        appVersion: "0.1.0",
        electronVersion: "43.1.1",
        platform: "darwin",
        architecture: "arm64",
        qaFixture: false,
      },
    } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
    const event = { sender: webContents, senderFrame: mainFrame };

    await expect(
      handler(IPC_CHANNELS.shellOpenExternal)(event, "http://gitlab.example.test/group/project"),
    ).resolves.toBeUndefined();
    expect(electronMock.openExternal).toHaveBeenCalledWith(
      "http://gitlab.example.test/group/project",
      { activate: true },
    );

    await expect(
      handler(IPC_CHANNELS.shellOpenExternal)(event, "https://token@example.test/private"),
    ).rejects.toThrow("credential-free HTTP or HTTPS");
    expect(electronMock.openExternal).toHaveBeenCalledTimes(1);
    unregisterPlatformHandlers();
  });

  it("switches between welcome and workspace window bounds", async () => {
    const mainFrame = { url: "app://git-client/" };
    const webContents = {
      isDestroyed: () => false,
      mainFrame,
      send: vi.fn(),
    };
    const setMinimumSize = vi.fn();
    const setSize = vi.fn();
    const center = vi.fn();
    const onWindowPresentationModeChange = vi.fn();
    const window = {
      isDestroyed: () => false,
      webContents,
      setMinimumSize,
      getSize: vi.fn(() => [1184, 768]),
      setSize,
      center,
    };
    registerPlatformHandlers({
      window,
      settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
      menu: { sync: vi.fn() },
      gitUtility: {},
      terminalUtility: {},
      runtime: {
        kind: "electron",
        appVersion: "0.1.0",
        electronVersion: "43.1.1",
        platform: "darwin",
        architecture: "arm64",
        qaFixture: false,
      },
      onWindowPresentationModeChange,
    } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
    const event = { sender: webContents, senderFrame: mainFrame };

    await handler(IPC_CHANNELS.windowSetPresentationMode)(event, "welcome");
    expect(setMinimumSize).toHaveBeenLastCalledWith(800, 650);
    expect(setSize).toHaveBeenLastCalledWith(800, 650, true);
    expect(center).toHaveBeenCalledOnce();
    expect(onWindowPresentationModeChange).toHaveBeenLastCalledWith("welcome");

    await handler(IPC_CHANNELS.windowSetPresentationMode)(event, "workspace");
    expect(setMinimumSize).toHaveBeenLastCalledWith(960, 640);
    expect(onWindowPresentationModeChange).toHaveBeenLastCalledWith("workspace");
    unregisterPlatformHandlers();
  });

  it("validates, delegates, and streams Git query events to the trusted window", async () => {
    const send = vi.fn();
    const mainFrame = { url: "app://git-client/" };
    const webContents = { isDestroyed: () => false, mainFrame, send };
    const window = { isDestroyed: () => false, webContents };
    const started: GitRequestEvent = {
      kind: "started",
      requestId: REQUEST_ID,
      displayCommand: "git status",
      startedAtMs: 1,
    };
    const terminal: GitTerminalEvent = {
      kind: "completed",
      requestId: REQUEST_ID,
      exitCode: 0,
      durationMs: 2,
    };
    const executeQuery = vi.fn(
      async (_request: GitQueryRequest, listener: GitEventListener): Promise<GitTerminalEvent> => {
        listener(started);
        listener(terminal);
        return terminal;
      },
    );
    const creationStarted: GitCreationEvent = {
      kind: "started",
      requestId: REQUEST_ID,
      operation: "initialize",
      displayCommand: "git init --initial-branch=main -- /tmp/repository",
      startedAtMs: 1,
    };
    const creationTerminal: GitCreationTerminalEvent = {
      kind: "completed",
      requestId: REQUEST_ID,
      operation: "initialize",
      repository: REPOSITORY,
      exitCode: 0,
      durationMs: 2,
    };
    const initializeRepository = vi.fn(
      async (
        _request: unknown,
        listener: GitCreationEventListener,
      ): Promise<GitCreationTerminalEvent> => {
        listener(creationStarted);
        listener(creationTerminal);
        return creationTerminal;
      },
    );
    const cloneStarted: GitCreationEvent = {
      ...creationStarted,
      operation: "clone",
      displayCommand: "git clone",
    };
    const cloneTerminal: GitCreationTerminalEvent = {
      ...creationTerminal,
      operation: "clone",
    };
    const cloneRepository = vi.fn(
      async (
        _request: unknown,
        listener: GitCreationEventListener,
      ): Promise<GitCreationTerminalEvent> => {
        listener(cloneStarted);
        listener(cloneTerminal);
        return cloneTerminal;
      },
    );
    const gitUtility = {
      openRepository: vi.fn(async () => REPOSITORY),
      initializeRepository,
      cloneRepository,
      closeRepository: vi.fn(async () => true),
      executeQuery,
      cancelQuery: vi.fn(async () => true),
    };
    registerPlatformHandlers({
      window,
      settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
      menu: { sync: vi.fn() },
      gitUtility,
      terminalUtility: {
        closeRepository: vi.fn(async () => 0),
      },
      runtime: {
        kind: "electron",
        appVersion: "0.1.0",
        electronVersion: "43.1.1",
        platform: "darwin",
        architecture: "arm64",
        qaFixture: false,
      },
    } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
    const event = { sender: webContents, senderFrame: mainFrame };

    await expect(
      handler(IPC_CHANNELS.gitOpenRepository)(event, {
        path: "/tmp/repository",
      }),
    ).resolves.toEqual(REPOSITORY);
    await expect(
      handler(IPC_CHANNELS.gitInitializeRepository)(event, {
        requestId: REQUEST_ID,
        path: "/tmp/repository",
        bare: false,
      }),
    ).resolves.toEqual(REPOSITORY);
    await expect(
      handler(IPC_CHANNELS.gitCloneRepository)(event, {
        requestId: REQUEST_ID,
        url: "https://example.invalid/repository.git",
        path: "/tmp/repository",
        options: {
          depth: null,
          branch: null,
          recurseSubmodules: false,
        },
      }),
    ).resolves.toEqual(REPOSITORY);
    await expect(
      handler(IPC_CHANNELS.gitQuery)(event, {
        kind: "status",
        requestId: REQUEST_ID,
        repositoryId: REPOSITORY_ID,
      }),
    ).resolves.toEqual(terminal);
    await expect(
      handler(IPC_CHANNELS.gitCloseRepository)(event, {
        repositoryId: REPOSITORY_ID,
      }),
    ).resolves.toBe(true);
    await expect(
      handler(IPC_CHANNELS.gitCancelQuery)(event, {
        requestId: REQUEST_ID,
      }),
    ).resolves.toBe(true);
    expect(send).toHaveBeenNthCalledWith(1, IPC_CHANNELS.gitCreationEvent, creationStarted);
    expect(send).toHaveBeenNthCalledWith(2, IPC_CHANNELS.gitCreationEvent, creationTerminal);
    expect(send).toHaveBeenNthCalledWith(3, IPC_CHANNELS.gitCreationEvent, cloneStarted);
    expect(send).toHaveBeenNthCalledWith(4, IPC_CHANNELS.gitCreationEvent, cloneTerminal);
    expect(send).toHaveBeenNthCalledWith(5, IPC_CHANNELS.gitQueryEvent, started);
    expect(send).toHaveBeenNthCalledWith(6, IPC_CHANNELS.gitQueryEvent, terminal);
    unregisterPlatformHandlers();
  });

  it("validates and streams an operation through the same Git IPC lifecycle", async () => {
    const send = vi.fn();
    const mainFrame = { url: "app://git-client/" };
    const webContents = { isDestroyed: () => false, mainFrame, send };
    const operationRequest: GitExecutionRequest = {
      kind: "operation",
      requestId: REQUEST_ID,
      repositoryId: REPOSITORY_ID,
      operation: { kind: "stage", paths: ["tracked.txt"] },
    };
    const started: GitRequestEvent = {
      kind: "started",
      requestId: REQUEST_ID,
      displayCommand: "git add -- tracked.txt",
      startedAtMs: 1,
    };
    const terminal: GitTerminalEvent = {
      kind: "completed",
      requestId: REQUEST_ID,
      exitCode: 0,
      durationMs: 2,
    };
    const executeQuery = vi.fn(
      async (
        request: GitExecutionRequest,
        listener: GitEventListener,
      ): Promise<GitTerminalEvent> => {
        expect(request).toEqual(operationRequest);
        listener(started);
        listener(terminal);
        return terminal;
      },
    );
    registerPlatformHandlers({
      window: { isDestroyed: () => false, webContents },
      settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
      menu: { sync: vi.fn() },
      gitUtility: { executeQuery },
      terminalUtility: {},
      runtime: {
        kind: "electron",
        appVersion: "0.1.0",
        electronVersion: "43.1.1",
        platform: "darwin",
        architecture: "arm64",
        qaFixture: false,
      },
    } as unknown as Parameters<typeof registerPlatformHandlers>[0]);

    await expect(
      handler(IPC_CHANNELS.gitQuery)(
        { sender: webContents, senderFrame: mainFrame },
        operationRequest,
      ),
    ).resolves.toEqual(terminal);
    expect(send.mock.calls).toEqual([
      [IPC_CHANNELS.gitQueryEvent, started],
      [IPC_CHANNELS.gitQueryEvent, terminal],
    ]);
    unregisterPlatformHandlers();
  });

  it("rejects Git calls from an untrusted sender before delegation", async () => {
    const openRepository = vi.fn(async () => REPOSITORY);
    const mainFrame = { url: "app://git-client/" };
    const webContents = {
      isDestroyed: () => false,
      mainFrame,
      send: vi.fn(),
    };
    registerPlatformHandlers({
      window: { isDestroyed: () => false, webContents },
      settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
      menu: { sync: vi.fn() },
      gitUtility: {
        openRepository,
        closeRepository: vi.fn(),
        executeQuery: vi.fn(),
        cancelQuery: vi.fn(),
      },
      terminalUtility: {
        closeRepository: vi.fn(async () => 0),
      },
      runtime: {
        kind: "electron",
        appVersion: "0.1.0",
        electronVersion: "43.1.1",
        platform: "darwin",
        architecture: "arm64",
        qaFixture: false,
      },
    } as unknown as Parameters<typeof registerPlatformHandlers>[0]);

    await expect(
      handler(IPC_CHANNELS.gitOpenRepository)(
        {
          sender: {},
          senderFrame: { url: "https://attacker.invalid/" },
        },
        { path: "/tmp/repository" },
      ),
    ).rejects.toThrow("IPC sender is not the main window");
    expect(openRepository).not.toHaveBeenCalled();
    unregisterPlatformHandlers();
  });

  it("validates and delegates complete snapshot inspection", async () => {
    const mainFrame = { url: "app://git-client/" };
    const webContents = {
      isDestroyed: () => false,
      mainFrame,
      send: vi.fn(),
    };
    const inspectSnapshot = vi.fn(async () => SNAPSHOT);
    registerPlatformHandlers({
      window: { isDestroyed: () => false, webContents },
      settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
      menu: { sync: vi.fn() },
      gitUtility: { inspectSnapshot },
      terminalUtility: {},
      runtime: {
        kind: "electron",
        appVersion: "0.1.0",
        electronVersion: "43.1.1",
        platform: "darwin",
        architecture: "arm64",
        qaFixture: false,
      },
    } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
    const event = { sender: webContents, senderFrame: mainFrame };

    await expect(
      handler(IPC_CHANNELS.gitInspectSnapshot)(event, {
        repositoryId: REPOSITORY_ID,
      }),
    ).resolves.toEqual(SNAPSHOT);
    expect(inspectSnapshot).toHaveBeenCalledWith(REPOSITORY_ID);
    unregisterPlatformHandlers();
  });

  it("validates and dispatches repository inspection and ignore-rule operations", async () => {
    const mainFrame = { url: "app://git-client/" };
    const webContents = {
      isDestroyed: () => false,
      mainFrame,
      send: vi.fn(),
    };
    const headOid = SNAPSHOT.headOid;
    if (headOid === null) throw new Error("Fixture HEAD is required");
    const executeRepositoryService = vi.fn(
      async (request: GitRepositoryServiceRequest): Promise<GitRepositoryServiceResult> => {
        if (request.operation === "compareBranches") {
          return {
            operation: request.operation,
            value: {
              ahead: 1,
              behind: 0,
              leftOnly: [headOid],
              rightOnly: [],
            },
          };
        }
        if (request.operation === "writeIgnoreRules") {
          return { operation: request.operation };
        }
        throw new Error(`Unexpected repository service ${request.operation}`);
      },
    );
    registerPlatformHandlers({
      window: { isDestroyed: () => false, webContents },
      settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
      menu: { sync: vi.fn() },
      gitUtility: { executeRepositoryService },
      terminalUtility: {},
      runtime: {
        kind: "electron",
        appVersion: "0.1.0",
        electronVersion: "43.1.1",
        platform: "darwin",
        architecture: "arm64",
        qaFixture: false,
      },
    } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
    const event = { sender: webContents, senderFrame: mainFrame };

    await expect(
      handler(IPC_CHANNELS.gitRepositoryService)(event, {
        operation: "compareBranches",
        repositoryId: REPOSITORY_ID,
        left: "feature",
        right: "main",
      }),
    ).resolves.toEqual({
      operation: "compareBranches",
      value: {
        ahead: 1,
        behind: 0,
        leftOnly: [SNAPSHOT.headOid],
        rightOnly: [],
      },
    });
    await expect(
      handler(IPC_CHANNELS.gitRepositoryService)(event, {
        operation: "writeIgnoreRules",
        repositoryId: REPOSITORY_ID,
        rules: { gitignore: "dist/\n", infoExclude: ".cache/\n" },
      }),
    ).resolves.toEqual({ operation: "writeIgnoreRules" });
    expect(executeRepositoryService).toHaveBeenNthCalledWith(1, {
      operation: "compareBranches",
      repositoryId: REPOSITORY_ID,
      left: "feature",
      right: "main",
    });
    expect(executeRepositoryService).toHaveBeenNthCalledWith(2, {
      operation: "writeIgnoreRules",
      repositoryId: REPOSITORY_ID,
      rules: { gitignore: "dist/\n", infoExclude: ".cache/\n" },
    });
    unregisterPlatformHandlers();
  });

  it("validates and dispatches push and history rewrite previews as direct results", async () => {
    const mainFrame = { url: "app://git-client/" };
    const webContents = {
      isDestroyed: () => false,
      mainFrame,
      send: vi.fn(),
    };
    const executeRepositoryService = vi.fn(
      async (request: GitRepositoryServiceRequest): Promise<GitRepositoryServiceResult> => {
        if (request.operation === "pushPreview") {
          return {
            operation: request.operation,
            value: PUSH_PREVIEW,
          };
        }
        if (request.operation === "historyRewritePreview") {
          return {
            operation: request.operation,
            value: HISTORY_REWRITE_PREVIEW,
          };
        }
        throw new Error(`Unexpected repository service ${request.operation}`);
      },
    );
    registerPlatformHandlers({
      window: { isDestroyed: () => false, webContents },
      settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
      menu: { sync: vi.fn() },
      gitUtility: { executeRepositoryService },
      terminalUtility: {},
      runtime: {
        kind: "electron",
        appVersion: "0.1.0",
        electronVersion: "43.1.1",
        platform: "darwin",
        architecture: "arm64",
        qaFixture: false,
      },
    } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
    const event = { sender: webContents, senderFrame: mainFrame };

    await expect(
      handler(IPC_CHANNELS.gitRepositoryService)(event, {
        operation: "pushPreview",
        repositoryId: REPOSITORY_ID,
        remote: "origin",
        remoteRef: "refs/heads/main",
        localRevision: "HEAD",
      }),
    ).resolves.toEqual({ operation: "pushPreview", value: PUSH_PREVIEW });
    await expect(
      handler(IPC_CHANNELS.gitRepositoryService)(event, {
        operation: "historyRewritePreview",
        repositoryId: REPOSITORY_ID,
        fromRevision: "HEAD",
      }),
    ).resolves.toEqual({
      operation: "historyRewritePreview",
      value: HISTORY_REWRITE_PREVIEW,
    });
    expect(executeRepositoryService).toHaveBeenNthCalledWith(1, {
      operation: "pushPreview",
      repositoryId: REPOSITORY_ID,
      remote: "origin",
      remoteRef: "refs/heads/main",
      localRevision: "HEAD",
    });
    expect(executeRepositoryService).toHaveBeenNthCalledWith(2, {
      operation: "historyRewritePreview",
      repositoryId: REPOSITORY_ID,
      fromRevision: "HEAD",
    });
    unregisterPlatformHandlers();
  });

  it("validates file reads and forwards watched repository invalidations", async () => {
    const send = vi.fn();
    const mainFrame = { url: "app://git-client/" };
    const webContents = { isDestroyed: () => false, mainFrame, send };
    const readFile = vi.fn(async () => FILE_CONTENT);
    const readFilePreview = vi.fn(async () => FILE_PREVIEW);
    const watchRepository = vi.fn(
      async (_repositoryId: string, listener: RepositoryChangedListener): Promise<void> => {
        listener(REPOSITORY_CHANGED);
      },
    );
    const unwatchRepository = vi.fn(async () => undefined);
    registerPlatformHandlers({
      window: { isDestroyed: () => false, webContents },
      settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
      menu: { sync: vi.fn() },
      gitUtility: {
        readFile,
        readFilePreview,
        watchRepository,
        unwatchRepository,
      },
      terminalUtility: {},
      runtime: {
        kind: "electron",
        appVersion: "0.1.0",
        electronVersion: "43.1.1",
        platform: "darwin",
        architecture: "arm64",
        qaFixture: false,
      },
    } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
    const event = { sender: webContents, senderFrame: mainFrame };

    await expect(
      handler(IPC_CHANNELS.gitReadFile)(event, {
        repositoryId: REPOSITORY_ID,
        source: { kind: "workingTree" },
        path: "tracked.txt",
      }),
    ).resolves.toEqual(FILE_CONTENT);
    await expect(
      handler(IPC_CHANNELS.gitReadFilePreview)(event, {
        repositoryId: REPOSITORY_ID,
        source: { kind: "revision", revision: "HEAD" },
        path: "tracked.bin",
      }),
    ).resolves.toEqual(FILE_PREVIEW);
    await expect(
      handler(IPC_CHANNELS.gitWatchRepository)(event, {
        repositoryId: REPOSITORY_ID,
      }),
    ).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.gitRepositoryChanged, REPOSITORY_CHANGED);
    await expect(
      handler(IPC_CHANNELS.gitUnwatchRepository)(event, {
        repositoryId: REPOSITORY_ID,
      }),
    ).resolves.toBeUndefined();
    expect(readFile).toHaveBeenCalledWith(REPOSITORY_ID, { kind: "workingTree" }, "tracked.txt");
    expect(readFilePreview).toHaveBeenCalledWith(
      REPOSITORY_ID,
      { kind: "revision", revision: "HEAD" },
      "tracked.bin",
    );
    expect(unwatchRepository).toHaveBeenCalledWith(REPOSITORY_ID);
    unregisterPlatformHandlers();
  });

  it("opens only utility-resolved canonical worktree files and surfaces shell failures", async () => {
    const mainFrame = { url: "app://git-client/" };
    const webContents = {
      isDestroyed: () => false,
      mainFrame,
      send: vi.fn(),
    };
    const canonicalPath = "/tmp/repository/tracked.txt";
    const resolveWorkingTreeFile = vi.fn(async () => canonicalPath);
    registerPlatformHandlers({
      window: { isDestroyed: () => false, webContents },
      settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
      menu: { sync: vi.fn() },
      gitUtility: { resolveWorkingTreeFile },
      terminalUtility: {},
      runtime: {
        kind: "electron",
        appVersion: "0.1.0",
        electronVersion: "43.1.1",
        platform: "darwin",
        architecture: "arm64",
        qaFixture: false,
      },
    } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
    const event = { sender: webContents, senderFrame: mainFrame };

    electronMock.openPath.mockResolvedValueOnce("");
    await expect(
      handler(IPC_CHANNELS.gitOpenWorkingTreeFile)(event, {
        repositoryId: REPOSITORY_ID,
        path: "tracked.txt",
      }),
    ).resolves.toBeUndefined();
    expect(resolveWorkingTreeFile).toHaveBeenCalledWith(REPOSITORY_ID, "tracked.txt");
    expect(electronMock.openPath).toHaveBeenCalledWith(canonicalPath);

    await expect(
      handler(IPC_CHANNELS.gitOpenWorkingTreeFile)(event, {
        repositoryId: REPOSITORY_ID,
        path: "../outside.txt",
      }),
    ).rejects.toThrow();
    expect(resolveWorkingTreeFile).toHaveBeenCalledTimes(1);

    electronMock.openPath.mockResolvedValueOnce("No application available");
    await expect(
      handler(IPC_CHANNELS.gitOpenWorkingTreeFile)(event, {
        repositoryId: REPOSITORY_ID,
        path: "tracked.txt",
      }),
    ).rejects.toThrow("Could not open working-tree file: No application available");
    unregisterPlatformHandlers();
  });

  it("resolves terminal cwd only from an opened repository and forwards validated PTY events", async () => {
    const send = vi.fn();
    const mainFrame = { url: "app://git-client/" };
    const webContents = { isDestroyed: () => false, mainFrame, send };
    const window = { isDestroyed: () => false, webContents };
    const terminalEvent: TerminalEventEnvelope = {
      kind: "output",
      requestId: REQUEST_ID,
      terminalId: "f6478d5c-5aa0-4d4a-b646-cb950b0ca555",
      sequence: 0,
      data: [36, 32],
    };
    const terminalUtility = {
      create: vi.fn(async (request: unknown, listener: (event: TerminalEventEnvelope) => void) => {
        listener(terminalEvent);
        return {
          requestId: REQUEST_ID,
          terminalId: "f6478d5c-5aa0-4d4a-b646-cb950b0ca555",
        };
      }),
      write: vi.fn(async () => undefined),
      resize: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
      closeRepository: vi.fn(async () => 1),
    };
    const gitUtility = {
      openRepository: vi.fn(async () => REPOSITORY),
      closeRepository: vi.fn(async () => true),
      executeQuery: vi.fn(),
      cancelQuery: vi.fn(),
    };
    registerPlatformHandlers({
      window,
      settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
      menu: { sync: vi.fn() },
      gitUtility,
      terminalUtility,
      runtime: {
        kind: "electron",
        appVersion: "0.1.0",
        electronVersion: "43.1.1",
        platform: "darwin",
        architecture: "arm64",
        qaFixture: false,
      },
    } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
    const event = { sender: webContents, senderFrame: mainFrame };
    const createRequest = {
      requestId: REQUEST_ID,
      repositoryId: REPOSITORY_ID,
      cols: 100,
      rows: 28,
    };

    await expect(
      handler(IPC_CHANNELS.terminalCreate)(event, {
        ...createRequest,
        cwd: "/tmp/attacker-controlled",
      }),
    ).rejects.toThrow(/unrecognized_keys/u);

    await expect(handler(IPC_CHANNELS.terminalCreate)(event, createRequest)).rejects.toThrow(
      "Repository is not open for terminal access",
    );
    await expect(
      handler(IPC_CHANNELS.gitOpenRepository)(event, {
        path: "/tmp/repository",
      }),
    ).resolves.toEqual(REPOSITORY);
    await expect(handler(IPC_CHANNELS.terminalCreate)(event, createRequest)).resolves.toEqual({
      requestId: REQUEST_ID,
      terminalId: "f6478d5c-5aa0-4d4a-b646-cb950b0ca555",
    });
    expect(terminalUtility.create).toHaveBeenCalledWith(
      {
        requestId: REQUEST_ID,
        repositoryId: REPOSITORY_ID,
        cwd: REPOSITORY.path,
        cols: 100,
        rows: 28,
        target: { kind: "default" },
      },
      expect.any(Function),
    );
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.terminalEvent, terminalEvent);

    await expect(
      handler(IPC_CHANNELS.gitCloseRepository)(event, {
        repositoryId: REPOSITORY_ID,
      }),
    ).resolves.toBe(true);
    expect(terminalUtility.closeRepository).toHaveBeenCalledWith({
      repositoryId: REPOSITORY_ID,
    });
    unregisterPlatformHandlers();
  });
});

describe("platform hosting IPC handlers", () => {
  const account = Object.freeze({
    id: "account-1",
    provider: "gitHub" as const,
    baseUrl: "https://github.com",
    login: "octocat",
  });

  beforeEach(() => electronMock.handlers.clear());

  function setup() {
    const mainFrame = { url: "app://git-client/" };
    const webContents = {
      isDestroyed: () => false,
      mainFrame,
      send: vi.fn(),
    };
    const window = { isDestroyed: () => false, webContents };
    const hosting = {
      saveAccount: vi.fn(async () => account),
      restoreAccounts: vi.fn(),
      deleteAccount: vi.fn(async () => undefined),
      execute: vi.fn(async () => ({
        kind: "completed" as const,
        message: "done",
      })),
    };
    registerPlatformHandlers({
      window,
      settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
      menu: { sync: vi.fn() },
      gitUtility: {},
      terminalUtility: {},
      hosting,
      runtime: {
        kind: "electron",
        appVersion: "0.1.0",
        electronVersion: "43.1.1",
        platform: "darwin",
        architecture: "arm64",
        qaFixture: false,
      },
    } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
    return {
      event: { sender: webContents, senderFrame: mainFrame },
      hosting,
      webContents,
    };
  }

  it("validates, delegates, and unregisters every hosting channel", async () => {
    const { event, hosting } = setup();
    const token = "ghp_super-secret-token";

    const saved = await handler(IPC_CHANNELS.hostingSaveAccount)(event, {
      provider: "gitHub",
      baseUrl: "https://github.com/",
      token,
    });
    expect(
      handler(IPC_CHANNELS.hostingRestoreAccounts)(event, {
        accounts: [account],
      }),
    ).toBeUndefined();
    await expect(
      handler(IPC_CHANNELS.hostingDeleteAccount)(event, {
        accountId: account.id,
      }),
    ).resolves.toBeUndefined();
    await expect(
      handler(IPC_CHANNELS.hostingExecute)(event, {
        accountId: account.id,
        request: {
          kind: "comment",
          project: "owner/repo",
          number: 7,
          body: "Looks good",
        },
      }),
    ).resolves.toEqual({ kind: "completed", message: "done" });

    expect(saved).toEqual(account);
    expect(JSON.stringify(saved)).not.toContain(token);
    expect(hosting.saveAccount).toHaveBeenCalledWith("gitHub", "https://github.com", token);
    expect(hosting.restoreAccounts).toHaveBeenCalledWith([account]);
    expect(hosting.deleteAccount).toHaveBeenCalledWith(account.id);

    unregisterPlatformHandlers();
    for (const channel of [
      IPC_CHANNELS.hostingSaveAccount,
      IPC_CHANNELS.hostingRestoreAccounts,
      IPC_CHANNELS.hostingDeleteAccount,
      IPC_CHANNELS.hostingExecute,
    ]) {
      expect(electronMock.handlers.has(channel)).toBe(false);
    }
  });

  it("rejects untrusted senders before delegation", async () => {
    const { event, hosting } = setup();
    const untrusted = { ...event, sender: {} };

    await expect(
      handler(IPC_CHANNELS.hostingDeleteAccount)(untrusted, {
        accountId: account.id,
      }),
    ).rejects.toThrow("IPC sender is not the main window");
    expect(hosting.deleteAccount).not.toHaveBeenCalled();
    unregisterPlatformHandlers();
  });

  it("redacts credentials and rejects response kinds that do not match requests", async () => {
    const { event, hosting } = setup();
    const token = "ghp_super-secret-token";
    hosting.saveAccount.mockRejectedValueOnce(
      new Error(`Authorization: Bearer ${token}; token=${token}`),
    );

    let saveError: unknown;
    try {
      await handler(IPC_CHANNELS.hostingSaveAccount)(event, {
        provider: "gitHub",
        baseUrl: "https://github.com",
        token,
      });
    } catch (error) {
      saveError = error;
    }
    expect(String(saveError)).toContain("[redacted]");
    expect(String(saveError)).not.toContain(token);

    hosting.execute.mockResolvedValueOnce({
      kind: "completed",
      message: "wrong kind",
    });
    await expect(
      handler(IPC_CHANNELS.hostingExecute)(event, {
        accountId: account.id,
        request: { kind: "files", project: "owner/repo", number: 7 },
      }),
    ).rejects.toThrow("Hosting response did not match its request");
    unregisterPlatformHandlers();
  });
});
