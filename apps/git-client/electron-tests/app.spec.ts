import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import type { Socket } from "node:net";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { captureGitState } from "../scripts/parity/git-state-oracle.mjs";
import type { GitExecutionRequest } from "../src/shared/contracts/git-utility";
import type { DesktopApi } from "../src/shared/contracts/ipc";
import type { GitOperation } from "../src/shared/contracts/model";
import { launchPackaged, resetQaProfile, runtimeProfileName } from "./packaged-app-harness";

function git(cwd: string, ...args: readonly string[]): void {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

function gitText(cwd: string, ...args: readonly string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

async function seedQaProfile(
  profileName: string,
  values: Readonly<Record<string, unknown>>,
): Promise<void> {
  const profilePath = join(homedir(), "Library", "Application Support", profileName);
  await mkdir(profilePath, { recursive: true });
  await writeFile(
    join(profilePath, "settings.json"),
    `${JSON.stringify({ schemaVersion: 1, values }, null, 2)}\n`,
    "utf8",
  );
}

async function executePackagedOperation(
  page: Page,
  repositoryId: string,
  operation: GitOperation,
): Promise<readonly string[]> {
  return page.evaluate(
    async ({ operation, repositoryId }) => {
      const desktopWindow = window as typeof window & {
        readonly gitClient?: DesktopApi;
      };
      const api = desktopWindow.gitClient;
      if (api === undefined) throw new Error("Electron preload API is unavailable");
      const eventKinds: string[] = [];
      const terminal = await api.git.executeQuery(
        {
          kind: "operation",
          operation,
          repositoryId,
          requestId: crypto.randomUUID(),
        },
        (event) => eventKinds.push(event.kind),
      );
      if (terminal.kind !== "completed") {
        throw new Error(
          terminal.kind === "failed" ? terminal.message : `Git operation ended as ${terminal.kind}`,
        );
      }
      return eventKinds;
    },
    { operation, repositoryId },
  );
}

function changesTab(page: Page): Locator {
  return page.getByRole("button", { name: "Commit", exact: true });
}

async function waitForChangesCount(page: Page, count: number, timeoutMs = 15_000): Promise<void> {
  await expect
    .poll(() => changesTab(page).getAttribute("aria-label"), {
      timeout: timeoutMs,
      intervals: [100, 200, 500],
    })
    .toBe("Commit");
  await expect(changesTab(page).locator("em")).toHaveText(String(count));
}

test("renders the packaged Rebased workbench shell and legible controls", async () => {
  await resetQaProfile("Git Client Electron QA Fixture");
  const app = await launchPackaged(["--qa-fixture"]);
  try {
    const { page } = app;
    const mainToolbar = page.getByRole("banner", {
      name: "Main Toolbar",
    });
    const project = mainToolbar.getByRole("button", {
      name: "Project: git-client",
      exact: true,
    });
    const branch = mainToolbar.getByRole("button", {
      name: "main",
      exact: true,
    });
    const log = page.getByRole("tab", {
      name: "Log",
      exact: true,
    });
    const changes = page.getByRole("button", {
      name: "Commit",
      exact: true,
    });
    await expect(project).toHaveText("Ggit-client");
    await expect(branch).toContainText("main");
    await expect(log).toBeVisible();
    await expect(changes).toBeVisible();
    await expect(mainToolbar.getByRole("button", { name: "Update Project..." })).toBeVisible();
    await expect(mainToolbar.getByRole("button", { name: "Push…", exact: true })).toBeVisible();
    await expect(mainToolbar.getByRole("button", { name: "Search Everywhere" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Left Toolbar" })).toBeVisible();
    const toolWindows = page.getByRole("navigation", {
      name: "Left Toolbar",
    });
    await expect(
      toolWindows.getByRole("button", {
        name: "Terminal",
        exact: true,
      }),
    ).toBeVisible();
    await expect(toolWindows.getByRole("button", { name: "Git", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Workspace tabs" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Repository views" })).toHaveCount(0);
    await expect(page.locator("[data-oid]").first()).toBeVisible();
    await expect(page.getByText("Select commit to view changes", { exact: true })).toBeVisible();
    for (const tab of [project, branch, log, changes]) {
      const labelMetrics = await tab.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          clientHeight: element.clientHeight,
          clientWidth: element.clientWidth,
          color: style.color,
          fontSize: Number.parseFloat(style.fontSize),
          lineHeight: Number.parseFloat(style.lineHeight),
          opacity: Number.parseFloat(style.opacity),
          scrollHeight: element.scrollHeight,
          scrollWidth: element.scrollWidth,
        };
      });
      expect(labelMetrics.clientWidth).toBeGreaterThan(0);
      expect(labelMetrics.clientHeight).toBeGreaterThan(0);
      expect(labelMetrics.scrollWidth).toBeLessThanOrEqual(labelMetrics.clientWidth + 1);
      expect(labelMetrics.scrollHeight).toBeLessThanOrEqual(labelMetrics.clientHeight + 1);
      expect(labelMetrics.fontSize).toBeGreaterThanOrEqual(12);
      expect(labelMetrics.lineHeight).toBeGreaterThanOrEqual(labelMetrics.fontSize);
      expect(labelMetrics.opacity).toBe(1);
      expect(labelMetrics.color).not.toBe("rgba(0, 0, 0, 0)");
    }

    const metrics = await log.evaluate((element) => {
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return {
        display: style.display,
        height: bounds.height,
        paddingLeft: Number.parseFloat(style.paddingLeft),
        paddingRight: Number.parseFloat(style.paddingRight),
      };
    });
    expect(metrics).toMatchObject({ display: "flex" });
    expect(metrics.height).toBeGreaterThanOrEqual(24);
    expect(metrics.paddingLeft).toBeGreaterThanOrEqual(7);
    expect(metrics.paddingRight).toBeGreaterThanOrEqual(7);

    const [toolbarBounds, projectBounds, branchBounds, logBounds] = await Promise.all([
      mainToolbar.boundingBox(),
      project.boundingBox(),
      branch.boundingBox(),
      log.boundingBox(),
    ]);
    expect(toolbarBounds?.height).toBe(30);
    expect(projectBounds).not.toBeNull();
    expect(branchBounds?.x ?? 0).toBeGreaterThanOrEqual(
      (projectBounds?.x ?? 0) + (projectBounds?.width ?? 0),
    );
    expect(logBounds?.height).toBe(24);
  } finally {
    await app.close();
  }
});

test("uses the packaged Electron Welcome geometry", async () => {
  await resetQaProfile(runtimeProfileName);
  const app = await launchPackaged(["--qa-isolated-profile"]);
  try {
    await expect(app.page).toHaveTitle("Welcome to Git Client");
    await expect(app.page.getByTestId("welcome-titlebar")).toHaveCSS("height", "27px");
    await expect(app.page.locator(".appShell")).toHaveAttribute("data-window-mode", "welcome");
    const bounds = await app.page.evaluate(() => ({
      height: window.outerHeight,
      width: window.outerWidth,
    }));
    expect(bounds).toEqual({ height: 650, width: 800 });
  } finally {
    await app.close();
  }
});

test("opens a real packaged Electron PTY in the repository directory", async () => {
  const profileName = runtimeProfileName;
  await resetQaProfile(profileName);
  const repositoryPath = await mkdtemp(join(tmpdir(), "git-client-electron-terminal-"));
  try {
    git(repositoryPath, "init", "--initial-branch=main");
    git(repositoryPath, "config", "user.name", "Git Client QA");
    git(repositoryPath, "config", "user.email", "qa@example.invalid");
    await writeFile(join(repositoryPath, "README.md"), "terminal fixture\n", "utf8");
    git(repositoryPath, "add", "README.md");
    git(repositoryPath, "commit", "-m", "fixture");
    await seedQaProfile(profileName, {
      activeRepositoryPath: repositoryPath,
      openRepositoryPaths: [repositoryPath],
      recentRepositories: [repositoryPath],
      schemaVersion: 4,
    });

    const app = await launchPackaged(["--qa-isolated-profile"]);
    try {
      const { page } = app;
      await expect(
        page.getByRole("button", {
          name: `Project: ${basename(repositoryPath)}`,
        }),
      ).toBeVisible();
      await page.evaluate(() => {
        localStorage.setItem("terminalSecurityAcknowledged", "true");
      });
      await expect(page.getByRole("button", { name: "Terminal", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Terminal", exact: true }).click();
      await expect(page.getByRole("region", { name: "Local Tool Window" })).toBeVisible();
      await expect(page.getByRole("toolbar", { name: "Action Toolbar" }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "New Tab" })).toBeVisible();
      const surface = page.locator("[data-terminal-session]");
      await expect(surface).toBeVisible();
      await expect(surface.locator(".xterm-screen")).toBeVisible();
      await expect(surface.locator("textarea")).toHaveAttribute("aria-label", "Editor");
      await expect(
        page.getByText("The deterministic QA fixture does not start a shell."),
      ).toHaveCount(0);

      await surface.locator("textarea").focus();
      await page.keyboard.type("printf '__GIT_CLIENT_PTY__\\n'; pwd");
      await page.keyboard.press("Enter");
      await expect(surface).toContainText("__GIT_CLIENT_PTY__");
      await expect(surface).toContainText(basename(repositoryPath));

      const bounds = await surface.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds?.width ?? 0).toBeGreaterThan(300);
      expect(bounds?.height ?? 0).toBeGreaterThan(80);
    } finally {
      await app.close();
    }
  } finally {
    await rm(repositoryPath, { recursive: true, force: true });
  }
});

test("initializes and clones repositories through the packaged Electron utility", async () => {
  const profileName = runtimeProfileName;
  await resetQaProfile(profileName);
  const parent = await mkdtemp(join(tmpdir(), "git-client-electron-create-e2e-"));
  const source = join(parent, "source repository");
  const initialized = join(parent, "initialized repository");
  const cloned = join(parent, "cloned repository");
  await mkdir(source);
  git(source, "init", "--initial-branch=main");
  git(source, "config", "user.name", "Git Client QA");
  git(source, "config", "user.email", "qa@example.invalid");
  await writeFile(join(source, "README.md"), "clone fixture\n", "utf8");
  git(source, "add", "README.md");
  git(source, "commit", "-m", "clone fixture");

  try {
    const app = await launchPackaged(["--qa-isolated-profile"]);
    try {
      const result = await app.page.evaluate(
        async ({ initializedPath, sourceUrl, clonedPath }) => {
          const desktopWindow = window as typeof window & {
            readonly gitClient?: DesktopApi;
          };
          const api = desktopWindow.gitClient;
          if (api === undefined) throw new Error("Electron preload API is unavailable");
          const initializedRepository = await api.git.initializeRepository(initializedPath, false);
          const clonedRepository = await api.git.cloneRepository(sourceUrl, clonedPath, {
            depth: null,
            branch: null,
            recurseSubmodules: false,
          });
          return {
            initializedPath: initializedRepository.path,
            clonedPath: clonedRepository.path,
          };
        },
        {
          initializedPath: initialized,
          sourceUrl: pathToFileURL(source).href,
          clonedPath: cloned,
        },
      );

      expect(result).toEqual({
        initializedPath: await realpath(initialized),
        clonedPath: await realpath(cloned),
      });
      expect(gitText(initialized, "symbolic-ref", "--short", "HEAD").trim()).toBe("main");
      expect(gitText(cloned, "log", "-1", "--format=%s").trim()).toBe("clone fixture");
    } finally {
      await app.close();
    }
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("shows real packaged Git history and commit details", async () => {
  await resetQaProfile(runtimeProfileName);
  const parent = await mkdtemp(join(tmpdir(), "git-client-electron-diff-watcher-"));
  const watchedRepository = join(parent, "watched repository");
  const replacementRepository = join(parent, "replacement repository");
  await Promise.all([mkdir(watchedRepository), mkdir(replacementRepository)]);

  git(watchedRepository, "init", "--initial-branch=main");
  git(watchedRepository, "config", "user.name", "Git Client QA");
  git(watchedRepository, "config", "user.email", "qa@example.invalid");
  await writeFile(join(watchedRepository, "committed.txt"), "committed fixture\n", "utf8");
  await writeFile(join(watchedRepository, "modified.txt"), "committed baseline\n", "utf8");
  git(watchedRepository, "add", "committed.txt", "modified.txt");
  git(watchedRepository, "commit", "-m", "committed baseline");
  await writeFile(
    join(watchedRepository, "modified.txt"),
    "committed baseline\nworking tree update\n",
    "utf8",
  );
  await writeFile(join(watchedRepository, "staged.txt"), "staged addition\n", "utf8");
  git(watchedRepository, "add", "staged.txt");
  await writeFile(
    join(watchedRepository, "유니코드 파일.txt"),
    "유니코드 작업 트리 내용\n",
    "utf8",
  );

  git(replacementRepository, "init", "--initial-branch=main");
  git(replacementRepository, "config", "user.name", "Git Client QA");
  git(replacementRepository, "config", "user.email", "qa@example.invalid");
  await writeFile(join(replacementRepository, "README.md"), "replacement fixture\n", "utf8");
  git(replacementRepository, "add", "README.md");
  git(replacementRepository, "commit", "-m", "replacement baseline");

  const [canonicalWatched, canonicalReplacement] = await Promise.all([
    realpath(watchedRepository),
    realpath(replacementRepository),
  ]);
  await seedQaProfile(runtimeProfileName, {
    activeRepositoryPath: canonicalWatched,
    openRepositoryPaths: [canonicalWatched, canonicalReplacement],
    recentRepositories: [canonicalWatched, canonicalReplacement],
    schemaVersion: 4,
  });

  try {
    const app = await launchPackaged(["--qa-isolated-profile"]);
    try {
      const { page } = app;
      const watchedName = basename(canonicalWatched);
      const projectButton = page.getByRole("button", {
        name: `Project: ${watchedName}`,
      });
      await expect(projectButton).toBeVisible();
      await projectButton.click();
      const projectRows = page
        .getByRole("dialog", { name: "Projects" })
        .locator(".projectSwitcherRow");
      await expect(projectRows).toHaveCount(2);
      await expect(projectRows.nth(0)).toContainText(watchedName);
      await expect(projectRows.nth(1)).toContainText(basename(canonicalReplacement));
      await page.keyboard.press("Escape");
      const headOid = gitText(canonicalWatched, "rev-parse", "HEAD").trim();
      const headRow = page.getByRole("row").filter({ hasText: "committed baseline" });
      await expect(page).toHaveURL("app://git-client/");
      await expect(page.getByRole("region", { name: "Commit log" })).toContainText(
        "committed baseline",
      );
      await expect(headRow).toHaveCount(1);
      await headRow.click();
      await expect(headRow).toContainText("Git Client QA");
      await expect(headRow.getByText("main", { exact: true })).toBeVisible();
      await expect(page.getByText(headOid, { exact: true })).toBeVisible();
      await waitForChangesCount(page, 3);
    } finally {
      await app.close();
    }

    const reopenedApp = await launchPackaged(["--qa-isolated-profile"]);
    try {
      const watchedName = basename(canonicalWatched);
      const projectButton = reopenedApp.page.getByRole("button", {
        name: `Project: ${watchedName}`,
      });
      await expect(projectButton).toBeVisible();
      await projectButton.click();
      const projectRows = reopenedApp.page
        .getByRole("dialog", { name: "Projects" })
        .locator(".projectSwitcherRow");
      await expect(projectRows).toHaveCount(2);
      await expect(projectRows.nth(0)).toContainText(watchedName);
      await expect(projectRows.nth(1)).toContainText(basename(canonicalReplacement));
    } finally {
      await reopenedApp.close();
    }
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("executes packaged index, commit, ref, stash, config, remote, and worktree mutations", async () => {
  test.setTimeout(60_000);
  await resetQaProfile(runtimeProfileName);
  const parent = await mkdtemp(join(tmpdir(), "git-client-electron-mutation-e2e-"));
  const repository = join(parent, "repository");
  const linkedWorktree = join(parent, "linked worktree");
  await mkdir(repository);
  git(repository, "init", "--initial-branch=main");
  git(repository, "config", "user.name", "Git Client QA");
  git(repository, "config", "user.email", "qa@example.invalid");
  await writeFile(join(repository, "tracked.txt"), "baseline\n", "utf8");
  git(repository, "add", "tracked.txt");
  git(repository, "commit", "-m", "fixture");

  const app = await launchPackaged(["--qa-isolated-profile"]);
  try {
    const { page } = app;
    const repositoryId = await page.evaluate(async (path) => {
      const desktopWindow = window as typeof window & {
        readonly gitClient?: DesktopApi;
      };
      const api = desktopWindow.gitClient;
      if (api === undefined) throw new Error("Electron preload API is unavailable");
      return (await api.git.openRepository(path)).id;
    }, repository);

    await writeFile(join(repository, "new file.txt"), "new\n", "utf8");
    const stagedEvents = await executePackagedOperation(page, repositoryId, {
      kind: "stage",
      paths: ["new file.txt"],
    });
    expect(stagedEvents[0]).toBe("started");
    expect(stagedEvents.at(-1)).toBe("completed");
    expect(gitText(repository, "status", "--short")).toContain('A  "new file.txt"');

    await executePackagedOperation(page, repositoryId, {
      kind: "commit",
      message: "packaged mutation commit",
      amend: false,
      signOff: false,
      gpgSign: false,
    });
    expect(gitText(repository, "log", "-1", "--format=%s").trim()).toBe("packaged mutation commit");

    await executePackagedOperation(page, repositoryId, {
      kind: "createBranch",
      name: "packaged-feature",
      startPoint: "HEAD",
      checkout: false,
    });
    await executePackagedOperation(page, repositoryId, {
      kind: "createTag",
      name: "packaged-v1",
      revision: "HEAD",
      message: null,
    });
    expect(gitText(repository, "branch", "--list", "packaged-feature")).toContain(
      "packaged-feature",
    );
    expect(gitText(repository, "tag", "--list", "packaged-v1").trim()).toBe("packaged-v1");

    await writeFile(join(repository, "tracked.txt"), "stashed\n", "utf8");
    await executePackagedOperation(page, repositoryId, {
      kind: "stashPush",
      message: "packaged stash",
      includeUntracked: false,
      keepIndex: false,
    });
    expect(gitText(repository, "status", "--porcelain")).toBe("");
    await executePackagedOperation(page, repositoryId, {
      kind: "stashApply",
      stash: "stash@{0}",
      pop: false,
      reinstateIndex: false,
    });
    expect(gitText(repository, "status", "--porcelain")).toContain("tracked.txt");
    await executePackagedOperation(page, repositoryId, {
      kind: "reset",
      revision: "HEAD",
      mode: "hard",
    });
    await executePackagedOperation(page, repositoryId, {
      kind: "stashDrop",
      stash: "stash@{0}",
    });
    expect(gitText(repository, "stash", "list")).toBe("");

    await executePackagedOperation(page, repositoryId, {
      kind: "setConfig",
      key: "gitclient.packaged",
      value: "verified",
    });
    expect(gitText(repository, "config", "--local", "gitclient.packaged").trim()).toBe("verified");
    await executePackagedOperation(page, repositoryId, {
      kind: "remoteAdd",
      name: "backup",
      url: join(parent, "backup.git"),
    });
    expect(gitText(repository, "remote", "get-url", "backup").trim()).toBe(
      join(parent, "backup.git"),
    );
    await executePackagedOperation(page, repositoryId, {
      kind: "remoteRemove",
      name: "backup",
    });

    await executePackagedOperation(page, repositoryId, {
      kind: "worktreeAdd",
      path: linkedWorktree,
      branch: "packaged-worktree",
      startPoint: "HEAD",
    });
    expect(gitText(repository, "worktree", "list", "--porcelain")).toContain(
      await realpath(linkedWorktree),
    );
    await executePackagedOperation(page, repositoryId, {
      kind: "worktreeRemove",
      path: linkedWorktree,
      force: false,
    });
    expect(gitText(repository, "worktree", "list", "--porcelain")).not.toContain(linkedWorktree);

    await page.evaluate(async (id) => {
      const desktopWindow = window as typeof window & {
        readonly gitClient?: DesktopApi;
      };
      await desktopWindow.gitClient?.git.unwatchRepository(id);
    }, repositoryId);
  } finally {
    await app.close();
    await rm(parent, { recursive: true, force: true });
  }
});

test("executes packaged repository inspection, ignore, preview, and patch boundaries", async () => {
  test.setTimeout(60_000);
  await resetQaProfile(runtimeProfileName);
  const parent = await mkdtemp(join(tmpdir(), "git-client-electron-inspection-e2e-"));
  const repository = join(parent, "repository");
  const remote = join(parent, "remote.git");
  const patchPath = join(parent, "exported.patch");
  await Promise.all([mkdir(repository), mkdir(remote)]);
  git(repository, "init", "--initial-branch=main");
  git(remote, "init", "--bare", "--initial-branch=main");
  git(repository, "config", "user.name", "Git Client QA");
  git(repository, "config", "user.email", "qa@example.invalid");
  git(repository, "config", "commit.gpgsign", "false");
  await writeFile(join(repository, ".gitignore"), "initial.log\n", "utf8");
  await writeFile(join(repository, "tracked.txt"), "first\n", "utf8");
  await writeFile(
    join(repository, "preview.png"),
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  git(repository, "add", ".gitignore", "tracked.txt", "preview.png");
  git(repository, "commit", "-m", "first packaged inspection commit");
  await writeFile(join(repository, "tracked.txt"), "second\n", "utf8");
  git(repository, "commit", "-am", "second packaged inspection commit");
  git(repository, "remote", "add", "origin", remote);
  git(repository, "push", "--set-upstream", "origin", "main");
  await writeFile(join(repository, "tracked.txt"), "stashed\n", "utf8");
  git(repository, "stash", "push", "--message", "packaged query stash");
  await writeFile(join(repository, "tracked.txt"), "working\n", "utf8");
  await writeFile(join(repository, "initial.log"), "ignored\n", "utf8");

  const app = await launchPackaged(["--qa-isolated-profile"]);
  try {
    const result = await app.page.evaluate(
      async ({ path, exportedPatchPath }) => {
        const desktopWindow = window as typeof window & {
          readonly gitClient?: DesktopApi;
        };
        const api = desktopWindow.gitClient;
        if (api === undefined) throw new Error("Electron preload API is unavailable");
        const snapshot = await api.git.openRepository(path);
        const pushPreview = await api.git.loadPushPreview(
          snapshot.id,
          "origin",
          "refs/heads/main",
          "HEAD",
        );
        const historyRewrite = await api.git.loadHistoryRewritePreview(snapshot.id, "HEAD~1");
        const preCommit = await api.git.preCommitCheck(snapshot.id);
        const comparison = await api.git.compareBranches(snapshot.id, "main", "HEAD");
        const signature = await api.git.loadCommitSignature(snapshot.id, "HEAD");
        const config = await api.git.listGitConfig(snapshot.id);
        const submodules = await api.git.listSubmodules(snapshot.id);
        const merged = await api.git.listMergedBranches(snapshot.id, "HEAD");
        const withIdentity = <Request extends object>(request: Request) => ({
          ...request,
          repositoryId: snapshot.id,
          requestId: crypto.randomUUID(),
        });
        const requests = [
          withIdentity({ kind: "status" as const }),
          withIdentity({ kind: "refs" as const }),
          withIdentity({
            kind: "log" as const,
            skip: 0,
            limit: 50,
            order: "topology" as const,
            filters: {
              query: null,
              branch: null,
              author: "Git Client QA",
              since: null,
              until: null,
              paths: [],
              noMerges: false,
            },
          }),
          withIdentity({
            kind: "commitDetails" as const,
            revision: "HEAD",
          }),
          withIdentity({
            kind: "diff" as const,
            from: null,
            to: null,
            paths: ["tracked.txt"],
            staged: false,
            options: {
              whitespace: "show" as const,
              contextLines: 3,
            },
          }),
          withIdentity({
            kind: "tree" as const,
            revision: "HEAD",
            path: null,
          }),
          withIdentity({
            kind: "fileHistory" as const,
            path: "tracked.txt",
            skip: 0,
            limit: 50,
          }),
          withIdentity({
            kind: "blame" as const,
            revision: "HEAD",
            path: "tracked.txt",
          }),
          withIdentity({ kind: "stashList" as const }),
          withIdentity({
            kind: "stashShow" as const,
            stash: "stash@{0}",
            mode: "files" as const,
          }),
          withIdentity({ kind: "configList" as const }),
          withIdentity({ kind: "submoduleStatus" as const }),
          withIdentity({
            kind: "signature" as const,
            revision: "HEAD",
          }),
          withIdentity({
            kind: "checkIgnored" as const,
            paths: ["initial.log"],
          }),
          withIdentity({
            kind: "mergedBranches" as const,
            target: "HEAD",
          }),
          withIdentity({
            kind: "pushPreview" as const,
            remote: "origin",
            remoteRef: "refs/heads/main",
            localRevision: "HEAD",
          }),
          withIdentity({
            kind: "historyRewritePreview" as const,
            fromRevision: "HEAD",
          }),
        ] satisfies readonly GitExecutionRequest[];
        const queryEvidence = [];
        for (const request of requests) {
          const events: Array<{
            readonly kind: string;
            readonly data?: string;
            readonly sequence?: number;
          }> = [];
          const terminal = await api.git.executeQuery(request, (event) => events.push(event));
          queryEvidence.push({
            kind: request.kind,
            terminalKind: terminal.kind,
            eventKinds: events.map(({ kind }) => kind),
            sequences: events.flatMap((event) =>
              event.kind === "output" && event.sequence !== undefined ? [event.sequence] : [],
            ),
            output: events.map(({ data }) => data ?? "").join(""),
          });
        }
        await api.git.writeIgnoreRules(snapshot.id, {
          gitignore: "dist/\n",
          infoExclude: ".cache/\n",
        });
        const ignore = await api.git.readIgnoreRules(snapshot.id);
        const preview = await api.git.readFilePreview(
          snapshot.id,
          { kind: "workingTree" },
          "preview.png",
        );
        const patchText = await api.git.createPatchText(snapshot.id, ["HEAD"]);
        const exported = await api.git.exportPatch(snapshot.id, ["HEAD"], exportedPatchPath);
        return {
          repositoryId: snapshot.id,
          pushPreview,
          historyRewrite,
          preCommit,
          comparison,
          signature,
          config,
          submodules,
          merged,
          ignore,
          preview,
          patchText,
          exported,
          queryEvidence,
        };
      },
      { path: repository, exportedPatchPath: patchPath },
    );

    expect(result.pushPreview).toMatchObject({
      remote: "origin",
      remoteRef: "refs/heads/main",
      remoteStateError: null,
    });
    expect(result.pushPreview.localOid).toMatch(/^[0-9a-f]{40}$/u);
    expect(result.historyRewrite).toMatchObject({
      branch: "main",
      descendantCount: 2,
    });
    expect(result.historyRewrite.entries.map(({ subject }) => subject)).toEqual([
      "first packaged inspection commit",
      "second packaged inspection commit",
    ]);
    expect(result.preCommit).toMatchObject({
      branch: "main",
      detachedHead: false,
      protectedBranch: true,
    });
    expect(result.comparison).toEqual({
      ahead: 0,
      behind: 0,
      leftOnly: [],
      rightOnly: [],
    });
    expect(result.signature.status).toBeTruthy();
    expect(result.config).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "user.name",
          value: "Git Client QA",
        }),
      ]),
    );
    expect(result.submodules).toEqual([]);
    expect(result.merged).toContain("main");
    expect(result.ignore).toEqual({
      gitignore: "dist/\n",
      infoExclude: ".cache/\n",
    });
    expect(result.preview).toMatchObject({
      kind: "image",
      preview: {
        path: "preview.png",
        mimeType: "image/png",
      },
    });
    expect(result.patchText).toContain("Subject: [PATCH] second packaged inspection commit");
    expect(result.exported).toMatchObject({
      path: patchPath,
      commitCount: 1,
    });
    expect(result.queryEvidence).toHaveLength(17);
    expect(new Set(result.queryEvidence.map(({ kind }) => kind)).size).toBe(17);
    for (const evidence of result.queryEvidence) {
      expect(evidence.terminalKind, `${evidence.kind}: ${evidence.output}`).toBe("completed");
      expect(evidence.eventKinds[0], evidence.kind).toBe("started");
      expect(evidence.eventKinds.at(-1), evidence.kind).toBe("completed");
      expect(evidence.sequences, evidence.kind).toEqual(
        evidence.sequences.map((_, index) => index),
      );
    }
    expect(result.queryEvidence.find(({ kind }) => kind === "diff")?.output).toContain("+working");
    expect(result.queryEvidence.find(({ kind }) => kind === "stashList")?.output).toContain(
      "packaged query stash",
    );

    git(repository, "reset", "--hard", "HEAD~1");
    await app.page.evaluate(
      async ({ repositoryId, exportedPatchPath }) => {
        const desktopWindow = window as typeof window & {
          readonly gitClient?: DesktopApi;
        };
        const api = desktopWindow.gitClient;
        if (api === undefined) throw new Error("Electron preload API is unavailable");
        await api.git.importPatch(repositoryId, exportedPatchPath);
      },
      {
        repositoryId: result.repositoryId,
        exportedPatchPath: patchPath,
      },
    );
    expect(gitText(repository, "status", "--short")).toContain("M  tracked.txt");
    expect(gitText(repository, "show", ":tracked.txt")).toBe("second\n");
  } finally {
    await app.close();
    await rm(parent, { recursive: true, force: true });
  }
});

test("executes packaged shelf, changelist, recovery, and conflict boundaries", async () => {
  test.setTimeout(90_000);
  await resetQaProfile(runtimeProfileName);
  const parent = await mkdtemp(join(tmpdir(), "git-client-electron-special-git-e2e-"));
  const repository = join(parent, "repository");
  await mkdir(repository);
  git(repository, "init", "--initial-branch=main");
  git(repository, "config", "user.name", "Git Client QA");
  git(repository, "config", "user.email", "qa@example.invalid");
  await writeFile(join(repository, "tracked.txt"), "baseline\n", "utf8");
  git(repository, "add", "tracked.txt");
  git(repository, "commit", "-m", "fixture commit");

  const app = await launchPackaged(["--qa-isolated-profile"]);
  try {
    const repositoryId = await app.page.evaluate(async (path) => {
      const desktopWindow = window as typeof window & {
        readonly gitClient?: DesktopApi;
      };
      const api = desktopWindow.gitClient;
      if (api === undefined) throw new Error("Electron preload API is unavailable");
      return (await api.git.openRepository(path)).id;
    }, repository);

    await writeFile(join(repository, "tracked.txt"), "shelved\n", "utf8");
    await writeFile(join(repository, "untracked.txt"), "untracked\n", "utf8");
    const shelf = await app.page.evaluate(async (id) => {
      const desktopWindow = window as typeof window & {
        readonly gitClient?: DesktopApi;
      };
      const api = desktopWindow.gitClient;
      if (api === undefined) throw new Error("Electron preload API is unavailable");
      const created = await api.git.createShelf(id, "packaged shelf", [
        "tracked.txt",
        "untracked.txt",
      ]);
      const listed = await api.git.listShelves(id);
      return { created, listed };
    }, repositoryId);
    expect(gitText(repository, "status", "--short")).toBe("");
    expect(shelf.listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: shelf.created.id,
          message: "packaged shelf",
        }),
      ]),
    );

    await app.page.evaluate(
      async ({ id, shelfId }) => {
        const desktopWindow = window as typeof window & {
          readonly gitClient?: DesktopApi;
        };
        const api = desktopWindow.gitClient;
        if (api === undefined) throw new Error("Electron preload API is unavailable");
        await api.git.applyShelf(id, shelfId, false);
        await api.git.deleteShelf(id, shelfId);
      },
      { id: repositoryId, shelfId: shelf.created.id },
    );
    expect(await readFile(join(repository, "tracked.txt"), "utf8")).toBe("shelved\n");
    expect(await readFile(join(repository, "untracked.txt"), "utf8")).toBe("untracked\n");
    git(repository, "reset", "--hard", "HEAD");
    git(repository, "clean", "-fd");

    await writeFile(join(repository, "tracked.txt"), "changelist\n", "utf8");
    const committed = await app.page.evaluate(async (id) => {
      const desktopWindow = window as typeof window & {
        readonly gitClient?: DesktopApi;
      };
      const api = desktopWindow.gitClient;
      if (api === undefined) throw new Error("Electron preload API is unavailable");
      const changelist = await api.git.saveChangelist(id, null, "packaged selected files", [
        "tracked.txt",
      ]);
      const listed = await api.git.listChangelists(id);
      const commit = await api.git.commitChangelist(
        id,
        changelist.id,
        "packaged changelist commit",
        false,
        false,
        false,
      );
      return { changelist, listed, commit };
    }, repositoryId);
    expect(committed.listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: committed.changelist.id,
          paths: ["tracked.txt"],
        }),
      ]),
    );
    expect(committed.commit.commitOid).toBe(gitText(repository, "rev-parse", "HEAD").trim());
    expect(gitText(repository, "log", "-1", "--format=%s").trim()).toBe(
      "packaged changelist commit",
    );

    const restored = await app.page.evaluate(async (id) => {
      const desktopWindow = window as typeof window & {
        readonly gitClient?: DesktopApi;
      };
      const api = desktopWindow.gitClient;
      if (api === undefined) throw new Error("Electron preload API is unavailable");
      const entries = await api.git.listRecoveryEntries(id);
      const entry = entries.find((candidate) => candidate.operation === "commit");
      if (entry === undefined) throw new Error("Packaged commit recovery entry is missing");
      const result = await api.git.restoreRecoveryEntry(id, entry.id);
      const disposable = await api.git.saveChangelist(id, null, "delete me", []);
      await api.git.deleteChangelist(id, disposable.id);
      return { entry, result };
    }, repositoryId);
    expect(restored.result).toMatchObject({
      entryId: restored.entry.id,
      restoredRefs: ["refs/heads/main"],
    });
    expect(gitText(repository, "log", "-1", "--format=%s").trim()).toBe("fixture commit");
    git(repository, "reset", "--hard", "HEAD");

    git(repository, "switch", "-c", "feature");
    await writeFile(join(repository, "tracked.txt"), "feature\n", "utf8");
    git(repository, "commit", "-am", "feature change");
    git(repository, "switch", "main");
    await writeFile(join(repository, "tracked.txt"), "main\n", "utf8");
    git(repository, "commit", "-am", "main change");
    expect(() => git(repository, "merge", "feature")).toThrow();

    const conflict = await app.page.evaluate(async (id) => {
      const desktopWindow = window as typeof window & {
        readonly gitClient?: DesktopApi;
      };
      const api = desktopWindow.gitClient;
      if (api === undefined) throw new Error("Electron preload API is unavailable");
      const files = await api.git.listConflicts(id);
      const content = await api.git.readConflict(id, "tracked.txt");
      await api.git.writeConflictResult(id, "tracked.txt", "resolved\n", true);
      return { files, content };
    }, repositoryId);
    expect(conflict.files).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "tracked.txt", binary: false })]),
    );
    expect(conflict.content).toMatchObject({
      path: "tracked.txt",
      local: "main\n",
      remote: "feature\n",
    });
    expect(gitText(repository, "diff", "--name-only", "--diff-filter=U")).toBe("");
    git(repository, "merge", "--abort");

    expect(() => git(repository, "merge", "feature")).toThrow();
    await app.page.evaluate(async (id) => {
      const desktopWindow = window as typeof window & {
        readonly gitClient?: DesktopApi;
      };
      const api = desktopWindow.gitClient;
      if (api === undefined) throw new Error("Electron preload API is unavailable");
      await api.git.resolveBinaryConflict(id, "tracked.txt", "ours");
    }, repositoryId);
    expect(gitText(repository, "diff", "--name-only", "--diff-filter=U")).toBe("");
    git(repository, "merge", "--abort");
  } finally {
    await app.close();
    await rm(parent, { recursive: true, force: true });
  }
});

test("executes packaged submodule inspection and rejects unsafe file opens", async () => {
  test.setTimeout(60_000);
  await resetQaProfile(runtimeProfileName);
  const parent = await mkdtemp(join(tmpdir(), "git-client-electron-submodule-e2e-"));
  const child = join(parent, "child");
  const repository = join(parent, "repository");
  await Promise.all([mkdir(child), mkdir(repository)]);
  git(child, "init", "--initial-branch=main");
  git(child, "config", "user.name", "Git Client QA");
  git(child, "config", "user.email", "qa@example.invalid");
  await writeFile(join(child, "child.txt"), "first\n", "utf8");
  git(child, "add", "child.txt");
  git(child, "commit", "-m", "first child commit");
  const firstOid = gitText(child, "rev-parse", "HEAD").trim();
  await writeFile(join(child, "child.txt"), "second\n", "utf8");
  git(child, "commit", "-am", "second child commit");
  const secondOid = gitText(child, "rev-parse", "HEAD").trim();

  git(repository, "init", "--initial-branch=main");
  git(repository, "config", "user.name", "Git Client QA");
  git(repository, "config", "user.email", "qa@example.invalid");
  git(repository, "-c", "protocol.file.allow=always", "submodule", "add", child, "modules/client");
  const checkout = join(repository, "modules", "client");
  git(checkout, "checkout", firstOid);
  git(repository, "add", "--all");
  git(repository, "commit", "-m", "pin first child commit");
  git(checkout, "checkout", secondOid);

  const app = await launchPackaged(["--qa-isolated-profile"]);
  try {
    const result = await app.page.evaluate(async (path) => {
      const desktopWindow = window as typeof window & {
        readonly gitClient?: DesktopApi;
      };
      const api = desktopWindow.gitClient;
      if (api === undefined) throw new Error("Electron preload API is unavailable");
      const snapshot = await api.git.openRepository(path);
      const submodules = await api.git.listSubmodules(snapshot.id);
      const diff = await api.git.loadSubmoduleDiff(
        snapshot.id,
        { kind: "index" },
        { kind: "workingTree" },
        "modules/client",
      );
      return { repositoryId: snapshot.id, submodules, diff };
    }, repository);
    expect(result.submodules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "modules/client",
          oid: secondOid,
          initialized: true,
        }),
      ]),
    );
    expect(result.diff).toEqual({
      path: "modules/client",
      beforeOid: firstOid,
      afterOid: secondOid,
      beforeSubject: "first child commit",
      afterSubject: "second child commit",
      ahead: 1,
      behind: 0,
    });
    await expect(
      app.page.evaluate(async (repositoryId) => {
        const desktopWindow = window as typeof window & {
          readonly gitClient?: DesktopApi;
        };
        const api = desktopWindow.gitClient;
        if (api === undefined) throw new Error("Electron preload API is unavailable");
        await api.git.openWorkingTreeFile(repositoryId, "../outside.txt");
      }, result.repositoryId),
    ).rejects.toThrow("Path must stay inside the repository");
  } finally {
    await app.close();
    await rm(parent, { recursive: true, force: true });
  }
});

test("executes and rolls back a packaged synchronized multi-root branch operation", async () => {
  test.setTimeout(60_000);
  await resetQaProfile(runtimeProfileName);
  const parent = await mkdtemp(join(tmpdir(), "git-client-electron-multi-root-e2e-"));
  const repositories = [join(parent, "first"), join(parent, "second")];
  for (const repository of repositories) {
    await mkdir(repository);
    git(repository, "init", "--initial-branch=main");
    git(repository, "config", "user.name", "Git Client QA");
    git(repository, "config", "user.email", "qa@example.invalid");
    await writeFile(join(repository, "tracked.txt"), "baseline\n", "utf8");
    git(repository, "add", "tracked.txt");
    git(repository, "commit", "-m", "fixture");
  }

  const app = await launchPackaged(["--qa-isolated-profile"]);
  try {
    const operation = await app.page.evaluate(async (paths) => {
      const desktopWindow = window as typeof window & {
        readonly gitClient?: DesktopApi;
      };
      const api = desktopWindow.gitClient;
      if (api === undefined) throw new Error("Electron preload API is unavailable");
      const opened = await Promise.all(paths.map((path) => api.git.openRepository(path)));
      const result = await api.git.executeSynchronizedBranchOperation(
        opened.map(({ id }) => id),
        {
          kind: "createBranch",
          name: "feature/packaged-parity",
          startPoint: "HEAD",
          checkout: true,
        },
      );
      return { ids: opened.map(({ id }) => id), result };
    }, repositories);
    expect(operation.result.outcomes).toHaveLength(2);
    expect(operation.result.outcomes.every(({ succeeded }) => succeeded)).toBe(true);
    for (const repository of repositories) {
      expect(gitText(repository, "branch", "--show-current").trim()).toBe(
        "feature/packaged-parity",
      );
    }

    const rollback = await app.page.evaluate(async (steps) => {
      const desktopWindow = window as typeof window & {
        readonly gitClient?: DesktopApi;
      };
      const api = desktopWindow.gitClient;
      if (api === undefined) throw new Error("Electron preload API is unavailable");
      return api.git.applyMultiRootRollback(steps);
    }, operation.result.rollbackPlan);
    expect(rollback).toHaveLength(2);
    expect(rollback.every(({ succeeded }) => succeeded)).toBe(true);
    for (const repository of repositories) {
      expect(gitText(repository, "branch", "--show-current").trim()).toBe("main");
      expect(gitText(repository, "branch", "--list", "feature/packaged-parity").trim()).toBe("");
    }
  } finally {
    await app.close();
    await rm(parent, { recursive: true, force: true });
  }
});

test("cancels a packaged in-flight Git query with terminal event ordering", async () => {
  test.setTimeout(60_000);
  await resetQaProfile(runtimeProfileName);
  const parent = await mkdtemp(join(tmpdir(), "git-client-electron-cancel-e2e-"));
  const repository = join(parent, "repository");
  await mkdir(repository);
  git(repository, "init", "--initial-branch=main");
  git(repository, "config", "user.name", "Git Client QA");
  git(repository, "config", "user.email", "qa@example.invalid");
  await writeFile(join(repository, "tracked.txt"), "baseline\n", "utf8");
  git(repository, "add", "tracked.txt");
  git(repository, "commit", "-m", "fixture");

  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Unable to start the hanging Git HTTP fixture");
  }
  git(repository, "remote", "add", "origin", `http://127.0.0.1:${address.port}/repository.git`);
  const stateBeforeCancellation = captureGitState(repository);

  const app = await launchPackaged(["--qa-isolated-profile"]);
  try {
    const result = await app.page.evaluate(async (path) => {
      const desktopWindow = window as typeof window & {
        readonly gitClient?: DesktopApi;
      };
      const api = desktopWindow.gitClient;
      if (api === undefined) throw new Error("Electron preload API is unavailable");
      const snapshot = await api.git.openRepository(path);
      const requestId = crypto.randomUUID();
      const eventKinds: string[] = [];
      let notifyStarted: (() => void) | undefined;
      const started = new Promise<void>((resolveStarted) => {
        notifyStarted = resolveStarted;
      });
      const running = api.git.executeQuery(
        {
          kind: "pushPreview",
          repositoryId: snapshot.id,
          remote: "origin",
          remoteRef: "refs/heads/main",
          localRevision: "HEAD",
          requestId,
        },
        (event) => {
          eventKinds.push(event.kind);
          if (event.kind === "started") notifyStarted?.();
        },
      );
      await started;
      const accepted = await api.git.cancelQuery(requestId);
      const terminal = await running;
      return { accepted, eventKinds, terminalKind: terminal.kind };
    }, repository);
    expect(result.accepted).toBe(true);
    expect(result.eventKinds[0]).toBe("started");
    expect(result.eventKinds.at(-1)).toBe("cancelled");
    expect(result.terminalKind).toBe("cancelled");
    expect(captureGitState(repository)).toEqual(stateBeforeCancellation);
  } finally {
    await app.close();
    for (const socket of sockets) socket.destroy();
    server.close();
    await once(server, "close");
    await rm(parent, { recursive: true, force: true });
  }
});
