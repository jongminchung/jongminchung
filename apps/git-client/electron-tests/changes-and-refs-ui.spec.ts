import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { launchPackaged, resetQaProfile, runtimeProfileName } from "./packaged-app-harness";

interface GitEvidence {
  readonly head: string;
  readonly index: string;
  readonly parents: readonly string[];
  readonly refs: string;
  readonly stash: string;
  readonly status: string;
  readonly worktree: string;
}

function git(repository: string, ...args: readonly string[]): string {
  return execFileSync("git", args, {
    cwd: repository,
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" },
  });
}

function gitVoid(repository: string, ...args: readonly string[]): void {
  execFileSync("git", args, {
    cwd: repository,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" },
    stdio: "ignore",
  });
}

function stashList(repository: string): string {
  if (git(repository, "for-each-ref", "--format=%(refname)", "refs/stash").trim() === "") {
    return "";
  }
  try {
    return git(repository, "stash", "list", "--format=%H%x00%gs");
  } catch (error) {
    const refStillExists =
      git(repository, "for-each-ref", "--format=%(refname)", "refs/stash").trim() !== "";
    if (refStillExists) throw error;
    return "";
  }
}

function evidence(repository: string): GitEvidence {
  const head = git(repository, "rev-parse", "HEAD").trim();
  const revision = git(repository, "rev-list", "--parents", "-n", "1", "HEAD").trim().split(/\s+/);
  return {
    head,
    index: git(repository, "diff", "--cached", "--binary"),
    parents: revision.slice(1),
    refs: git(repository, "for-each-ref", "--sort=refname", "--format=%(refname)%00%(objectname)"),
    stash: stashList(repository),
    status: git(repository, "status", "--porcelain=v2", "--untracked-files=all"),
    worktree: git(repository, "diff", "--binary"),
  };
}

async function seedRepositoryProfile(repository: string): Promise<string> {
  const canonical = await realpath(repository);
  const profilePath = join(homedir(), "Library", "Application Support", runtimeProfileName);
  await mkdir(profilePath, { recursive: true });
  await writeFile(
    join(profilePath, "settings.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        values: {
          activeRepositoryPath: canonical,
          openRepositoryPaths: [canonical],
          recentRepositories: [canonical],
          schemaVersion: 4,
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return canonical;
}

async function initializeRepository(parent: string, name: string, branch: string): Promise<string> {
  const repository = join(parent, name);
  await mkdir(repository);
  gitVoid(repository, "init", `--initial-branch=${branch}`);
  gitVoid(repository, "config", "user.name", "Git Client UI QA");
  gitVoid(repository, "config", "user.email", "ui-qa@example.invalid");
  await writeFile(join(repository, "README.md"), "fixture\n", "utf8");
  gitVoid(repository, "add", "README.md");
  gitVoid(repository, "commit", "-m", "fixture base");
  return repository;
}

async function expectRepositoryLoaded(page: Page, repository: string): Promise<void> {
  await expect(
    page.getByRole("button", { name: `Project: ${basename(repository)}` }),
  ).toBeVisible();
}

function changedFiles(page: Page): Locator {
  return page.getByRole("complementary", { name: "Changed files" });
}

async function openCommitToolWindow(page: Page): Promise<void> {
  const commitButton = page
    .getByRole("navigation", { name: "Left Toolbar" })
    .getByRole("button", { name: "Commit", exact: true });
  if ((await changedFiles(page).count()) === 0) await commitButton.click();
  await expect(changedFiles(page)).toBeVisible();
}

function branchButton(page: Page, branch: string): Locator {
  return page
    .getByRole("banner", { name: "Main Toolbar" })
    .getByRole("button", { name: branch, exact: true });
}

async function openBranches(page: Page, branch: string): Promise<Locator> {
  await branchButton(page, branch).click();
  const popup = page.getByRole("dialog", { name: "Git Branches" });
  await expect(popup).toBeVisible();
  return popup;
}

async function createBranch(page: Page, current: string, name: string): Promise<void> {
  const popup = await openBranches(page, current);
  await popup.getByRole("treeitem", { name: /New Branch/ }).click();
  const dialog = page.getByRole("dialog", { name: "New Branch" });
  await dialog.getByRole("textbox", { name: "Branch name" }).fill(name);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
}

async function openBranchActions(page: Page, current: string, target: string): Promise<Locator> {
  const popup = await openBranches(page, current);
  const search = popup.getByRole("textbox", { name: "Search" });
  await search.fill(target);
  await search.press("ArrowRight");
  const actions = popup.getByLabel(`Actions for ${target}`);
  await expect(actions).toBeVisible();
  return actions;
}

async function checkoutBranch(page: Page, current: string, target: string): Promise<void> {
  const popup = await openBranches(page, current);
  await popup.getByRole("textbox", { name: "Search" }).fill(target);
  await popup.getByRole("treeitem").filter({ hasText: target }).dblclick();
}

test("mutates partial index, worktree, commit, and amend state only through visible controls", async () => {
  test.setTimeout(60_000);
  await resetQaProfile(runtimeProfileName);
  const parent = await mkdtemp(join(tmpdir(), "git-client-ui-changes-"));
  const repository = await initializeRepository(parent, "changes repository", "feature/ui");
  const baseline = Array.from({ length: 120 }, (_, index) => `line ${index + 1}`).join("\n");
  await writeFile(join(repository, "partial.txt"), `${baseline}\n`, "utf8");
  gitVoid(repository, "add", "partial.txt");
  gitVoid(repository, "commit", "-m", "add partial fixture");
  const baseHead = evidence(repository).head;
  const changed = baseline.split("\n");
  changed[1] = "line 2 changed for staged hunk";
  changed[99] = "line 100 changed for discarded hunk";
  await writeFile(join(repository, "partial.txt"), `${changed.join("\n")}\n`, "utf8");
  await seedRepositoryProfile(repository);

  try {
    const app = await launchPackaged(["--qa-isolated-profile"]);
    try {
      const { page } = app;
      await expectRepositoryLoaded(page, repository);
      await openCommitToolWindow(page);

      const worktreeGroup = changedFiles(page)
        .locator("section")
        .filter({ hasText: "Working Tree" });
      await worktreeGroup.getByRole("button", { name: /partial\.txt/ }).dblclick();
      await page.getByRole("button", { name: "Stage hunk", exact: true }).click();

      await expect
        .poll(() => evidence(repository).index)
        .toContain("line 2 changed for staged hunk");
      const partiallyStaged = evidence(repository);
      expect(partiallyStaged.head).toBe(baseHead);
      expect(partiallyStaged.parents).toHaveLength(1);
      expect(partiallyStaged.refs).toContain(`refs/heads/feature/ui\u0000${baseHead}`);
      expect(partiallyStaged.index).not.toContain("line 100 changed for discarded hunk");
      expect(partiallyStaged.worktree).toContain("line 100 changed for discarded hunk");
      expect(partiallyStaged.stash).toBe("");

      await page.getByRole("button", { name: "Exit focused diff" }).click();
      await worktreeGroup.getByRole("button", { name: /partial\.txt/ }).click();
      await changedFiles(page).getByRole("button", { name: "Discard…", exact: true }).click();
      const discardDialog = page.getByRole("dialog", {
        name: "Discard changes in partial.txt?",
      });
      await discardDialog.getByRole("button", { name: "Discard changes" }).click();
      await expect.poll(() => evidence(repository).worktree).toBe("");
      const discarded = evidence(repository);
      expect(discarded.head).toBe(baseHead);
      expect(discarded.index).toContain("line 2 changed for staged hunk");
      expect(discarded.status).toContain("partial.txt");

      await page.getByRole("textbox", { name: "Commit message" }).fill("UI partial commit");
      await page.getByRole("button", { name: "Commit", exact: true }).last().click();
      await expect
        .poll(() => git(repository, "log", "-1", "--format=%s").trim())
        .toBe("UI partial commit");
      const committed = evidence(repository);
      expect(committed.head).not.toBe(baseHead);
      expect(committed.parents).toEqual([baseHead]);
      expect(committed.index).toBe("");
      expect(committed.worktree).toBe("");

      await writeFile(join(repository, "partial.txt"), `${changed.join("\n")}\namend\n`, "utf8");
      await expect(worktreeGroup.getByRole("button", { name: /partial\.txt/ })).toBeVisible();
      await worktreeGroup.getByRole("button", { name: /partial\.txt/ }).click();
      await changedFiles(page).getByRole("button", { name: "Stage all", exact: true }).click();
      await expect.poll(() => evidence(repository).index).toContain("amend");
      await page.getByRole("textbox", { name: "Commit message" }).fill("UI amended commit");
      const commitOptions = page.getByRole("button", {
        name: /Commit options/,
      });
      await commitOptions.click();
      await page.getByRole("checkbox", { name: "Amend" }).check();
      await commitOptions.click();
      await page.getByRole("button", { name: "Commit", exact: true }).last().click();
      await expect
        .poll(() => git(repository, "log", "-1", "--format=%s").trim())
        .toBe("UI amended commit");
      const amended = evidence(repository);
      expect(amended.head).not.toBe(committed.head);
      expect(amended.parents).toEqual([baseHead]);
      expect(amended.refs).toContain(`refs/heads/feature/ui\u0000${amended.head}`);
      expect(amended.index).toBe("");
      expect(amended.worktree).toBe("");
      expect(amended.stash).toBe("");
    } finally {
      await app.close();
    }
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("creates, checks out, renames, merges, and deletes branches through the branch popup", async () => {
  test.setTimeout(60_000);
  await resetQaProfile(runtimeProfileName);
  const parent = await mkdtemp(join(tmpdir(), "git-client-ui-refs-"));
  const repository = await initializeRepository(parent, "refs repository", "main");
  const baseHead = evidence(repository).head;
  gitVoid(repository, "checkout", "-b", "merge-source");
  await writeFile(join(repository, "source.txt"), "source branch\n", "utf8");
  gitVoid(repository, "add", "source.txt");
  gitVoid(repository, "commit", "-m", "source change");
  const sourceHead = evidence(repository).head;
  gitVoid(repository, "checkout", "main");
  await writeFile(join(repository, "main.txt"), "main branch\n", "utf8");
  gitVoid(repository, "add", "main.txt");
  gitVoid(repository, "commit", "-m", "main change");
  const mainHead = evidence(repository).head;
  await seedRepositoryProfile(repository);

  try {
    const app = await launchPackaged(["--qa-isolated-profile"]);
    try {
      const { page } = app;
      await expectRepositoryLoaded(page, repository);

      await createBranch(page, "main", "ui-created");
      await expect
        .poll(() => git(repository, "branch", "--show-current").trim())
        .toBe("ui-created");
      const created = evidence(repository);
      expect(created.head).toBe(mainHead);
      expect(created.parents).toEqual([baseHead]);
      expect(created.refs).toContain(`refs/heads/ui-created\u0000${mainHead}`);
      expect(created.index).toBe("");
      expect(created.worktree).toBe("");

      const renameActions = await openBranchActions(page, "ui-created", "ui-created");
      await renameActions.getByRole("button", { name: "Rename…" }).click();
      const renameDialog = page.getByRole("dialog", {
        name: "Rename ui-created",
      });
      await renameDialog.getByRole("textbox", { name: "New branch name" }).fill("ui-renamed");
      await renameDialog.getByRole("button", { name: "Rename" }).click();
      await expect
        .poll(() => git(repository, "branch", "--show-current").trim())
        .toBe("ui-renamed");
      const renamed = evidence(repository);
      expect(renamed.refs).toContain(`refs/heads/ui-renamed\u0000${mainHead}`);
      expect(renamed.refs).not.toContain("refs/heads/ui-created\u0000");

      await checkoutBranch(page, "ui-renamed", "main");
      await expect.poll(() => git(repository, "branch", "--show-current").trim()).toBe("main");
      const checkedOut = evidence(repository);
      expect(checkedOut.head).toBe(mainHead);
      expect(checkedOut.index).toBe("");
      expect(checkedOut.worktree).toBe("");

      const mergeActions = await openBranchActions(page, "main", "merge-source");
      await mergeActions.getByRole("button", { name: "Merge into main…" }).click();
      const mergeDialog = page.getByRole("dialog", {
        name: "Merge merge-source into main?",
      });
      await mergeDialog.getByRole("button", { name: "Merge", exact: true }).click();
      await expect.poll(() => evidence(repository).parents).toHaveLength(2);
      const merged = evidence(repository);
      expect(merged.parents).toEqual([mainHead, sourceHead]);
      expect(merged.refs).toContain(`refs/heads/main\u0000${merged.head}`);
      expect(merged.index).toBe("");
      expect(merged.worktree).toBe("");
      expect(merged.stash).toBe("");
      expect(git(repository, "show", "HEAD:source.txt")).toBe("source branch\n");

      const deleteActions = await openBranchActions(page, "main", "ui-renamed");
      await deleteActions.getByRole("button", { name: "Delete…" }).click();
      const deleteDialog = page.getByRole("dialog", {
        name: "Delete ui-renamed?",
      });
      await deleteDialog.getByRole("button", { name: "Delete", exact: true }).click();
      await expect.poll(() => evidence(repository).refs).not.toContain("refs/heads/ui-renamed");
      const deleted = evidence(repository);
      expect(deleted.head).toBe(merged.head);
      expect(deleted.parents).toEqual([mainHead, sourceHead]);
      expect(deleted.index).toBe("");
      expect(deleted.worktree).toBe("");
      expect(deleted.stash).toBe("");
    } finally {
      await app.close();
    }
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("creates, applies, and drops a stash through visible VCS operations", async () => {
  test.setTimeout(60_000);
  await resetQaProfile(runtimeProfileName);
  const parent = await mkdtemp(join(tmpdir(), "git-client-ui-stash-"));
  const repository = await initializeRepository(parent, "stash repository", "feature/stash");
  const initial = evidence(repository);
  await writeFile(join(repository, "README.md"), "fixture\ntracked stash change\n", "utf8");
  await writeFile(join(repository, "untracked.txt"), "untracked stash change\n", "utf8");
  await seedRepositoryProfile(repository);

  try {
    const app = await launchPackaged(["--qa-isolated-profile"]);
    try {
      const { page } = app;
      await expectRepositoryLoaded(page, repository);
      await page.getByRole("button", { name: "Search Everywhere" }).click();
      const search = page.getByRole("combobox", {
        name: "Search Everywhere",
      });
      await search.fill("VCS Operations Popup");
      await page.getByRole("option", { name: /VCS Operations Popup…/ }).click();
      const operations = page.getByRole("dialog", {
        name: "VCS Operations",
      });
      await operations.getByRole("option", { name: /Stash Changes…/ }).click();
      const stashPanel = page.getByRole("tabpanel", {
        name: "Stash Tool Window Tab",
      });
      const createDialog = page.getByRole("dialog", {
        name: "Stash changes",
      });
      await createDialog.getByRole("textbox", { name: "Message (optional)" }).fill("UI stash");
      await createDialog.getByRole("button", { name: "Stash", exact: true }).click();

      await expect.poll(() => evidence(repository).stash).toContain("UI stash");
      const stashed = evidence(repository);
      expect(stashed.head).toBe(initial.head);
      expect(stashed.parents).toEqual(initial.parents);
      expect(stashed.refs).toContain(`refs/heads/feature/stash\u0000${initial.head}`);
      expect(stashed.index).toBe("");
      expect(stashed.worktree).toBe("");
      expect(stashed.status).toBe("");
      await expect(stashPanel).toContainText("UI stash");

      await stashPanel.getByRole("button", { name: "Apply", exact: true }).click();
      const applyDialog = page.getByRole("dialog", {
        name: "Apply stash@{0}?",
      });
      await applyDialog.getByRole("button", { name: "Apply stash" }).click();
      await expect.poll(() => evidence(repository).status).toContain("README.md");
      const applied = evidence(repository);
      expect(applied.head).toBe(initial.head);
      expect(applied.index).toBe("");
      expect(applied.worktree).toContain("tracked stash change");
      expect(applied.status).toContain("untracked.txt");
      expect(applied.stash).toContain("UI stash");

      await stashPanel.getByRole("button", { name: "Drop", exact: true }).click();
      const dropDialog = page.getByRole("dialog", {
        name: "Drop stash@{0}?",
      });
      await dropDialog.getByRole("button", { name: "Drop stash" }).click();
      await expect.poll(() => evidence(repository).stash).toBe("");
      const dropped = evidence(repository);
      expect(dropped.head).toBe(initial.head);
      expect(dropped.parents).toEqual(initial.parents);
      expect(dropped.refs).not.toContain("refs/stash");
      expect(dropped.index).toBe("");
      expect(dropped.worktree).toContain("tracked stash change");
      expect(dropped.status).toContain("untracked.txt");
    } finally {
      await app.close();
    }
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
