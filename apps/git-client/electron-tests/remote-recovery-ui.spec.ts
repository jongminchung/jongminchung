import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import {
    captureGitState,
    compareGitStates,
} from "../scripts/independent-audit/git-state-oracle.mjs";
import {
    launchPackaged,
    resetQaProfile,
    runtimeProfileName,
} from "./packaged-app-harness";

const GIT_ENVIRONMENT = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_EDITOR: "true",
    GIT_PAGER: "cat",
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C",
    TZ: "UTC",
};

function git(cwd: string, ...args: readonly string[]): string {
    return execFileSync("git", args, {
        cwd,
        encoding: "utf8",
        env: GIT_ENVIRONMENT,
    });
}

function gitRefExists(cwd: string, ref: string): boolean {
    return (
        spawnSync("git", ["rev-parse", "--quiet", "--verify", ref], {
            cwd,
            encoding: "utf8",
            env: GIT_ENVIRONMENT,
            shell: false,
        }).status === 0
    );
}

async function configureRepository(repository: string): Promise<void> {
    git(repository, "config", "user.name", "Git Client QA");
    git(repository, "config", "user.email", "qa@example.invalid");
    git(repository, "config", "commit.gpgsign", "false");
    git(repository, "config", "core.autocrlf", "false");
}

async function commitFile(
    repository: string,
    path: string,
    content: string,
    subject: string,
): Promise<string> {
    await writeFile(join(repository, path), content, "utf8");
    git(repository, "add", "--", path);
    git(repository, "commit", "--no-gpg-sign", "-m", subject);
    return git(repository, "rev-parse", "HEAD").trim();
}

async function seedQaProfile(repository: string): Promise<void> {
    const canonicalRepository = await realpath(repository);
    const profilePath = join(
        homedir(),
        "Library",
        "Application Support",
        runtimeProfileName,
    );
    await mkdir(profilePath, { recursive: true });
    await writeFile(
        join(profilePath, "settings.json"),
        `${JSON.stringify(
            {
                schemaVersion: 1,
                values: {
                    activeRepositoryPath: canonicalRepository,
                    openRepositoryPaths: [canonicalRepository],
                    recentRepositories: [canonicalRepository],
                    schemaVersion: 4,
                },
            },
            null,
            2,
        )}\n`,
        "utf8",
    );
}

async function waitForRepository(
    page: Page,
    repository: string,
): Promise<void> {
    await expect(
        page.getByRole("button", {
            name: `Project: ${basename(repository)}`,
        }),
    ).toBeVisible();
}

async function openBranches(page: Page, branch: string): Promise<void> {
    await page
        .getByRole("banner", { name: "Main Toolbar" })
        .getByRole("button", { name: branch, exact: true })
        .click();
    await expect(
        page.getByRole("dialog", { name: "Git Branches" }),
    ).toBeVisible();
}

async function fetchThroughUi(page: Page, branch: string): Promise<void> {
    await openBranches(page, branch);
    const popup = page.getByRole("dialog", { name: "Git Branches" });
    await popup.getByRole("button", { name: "Fetch", exact: true }).click();
    await expect(popup).not.toHaveAttribute("aria-busy", "true");
}

async function openPush(page: Page): Promise<Locator> {
    await page
        .getByRole("banner", { name: "Main Toolbar" })
        .getByRole("button", { name: "Push…", exact: true })
        .click();
    const dialog = page.getByRole("dialog", { name: "Push" });
    await expect(dialog.getByLabel("Destination branch")).toHaveValue(
        "refs/heads/main",
    );
    await expect(
        dialog.getByRole("button", { name: "Review destination" }),
    ).toBeEnabled();
    return dialog;
}

test("uses visible Fetch, Pull, Push, and exact force-with-lease controls against a real remote", async () => {
    test.setTimeout(120_000);
    await resetQaProfile(runtimeProfileName);
    const parent = await mkdtemp(
        join(tmpdir(), "git-client-electron-remote-ui-"),
    );
    const remote = join(parent, "remote.git");
    const seed = join(parent, "seed");
    const repository = join(parent, "repository");
    const peer = join(parent, "peer");

    try {
        git(parent, "init", "--bare", "--initial-branch=main", remote);
        await mkdir(seed);
        git(seed, "init", "--initial-branch=main");
        await configureRepository(seed);
        await commitFile(seed, "tracked.txt", "baseline\n", "remote baseline");
        git(seed, "remote", "add", "origin", remote);
        git(seed, "push", "--set-upstream", "origin", "main");
        git(parent, "clone", remote, repository);
        git(parent, "clone", remote, peer);
        await Promise.all([
            configureRepository(repository),
            configureRepository(peer),
        ]);

        git(peer, "switch", "-c", "fetch-only");
        await commitFile(
            peer,
            "fetch-only.txt",
            "fetch fixture\n",
            "fetch-only remote commit",
        );
        git(peer, "push", "--set-upstream", "origin", "fetch-only");
        git(peer, "switch", "main");
        await seedQaProfile(repository);

        const app = await launchPackaged(["--qa-isolated-profile"]);
        try {
            const { page } = app;
            await waitForRepository(page, repository);

            await fetchThroughUi(page, "main");
            await expect
                .poll(() =>
                    gitRefExists(repository, "refs/remotes/origin/fetch-only"),
                )
                .toBe(true);
            await expect
                .poll(() =>
                    git(
                        repository,
                        "rev-parse",
                        "refs/remotes/origin/fetch-only",
                    ).trim(),
                )
                .toBe(git(peer, "rev-parse", "fetch-only").trim());
            await page.keyboard.press("Escape");

            const pulledOid = await commitFile(
                peer,
                "pulled.txt",
                "pulled through visible UI\n",
                "remote pull fixture",
            );
            git(peer, "push", "origin", "main");
            await page
                .getByRole("banner", { name: "Main Toolbar" })
                .getByRole("button", { name: "Update Project...", exact: true })
                .click();
            await expect
                .poll(() => git(repository, "rev-parse", "HEAD").trim())
                .toBe(pulledOid);

            const normalPushOid = await commitFile(
                repository,
                "pushed.txt",
                "pushed through visible UI\n",
                "normal push fixture",
            );
            const normalPushDialog = await openPush(page);
            await expect(
                normalPushDialog.getByText("Fast-forward", { exact: true }),
            ).toBeVisible();
            await normalPushDialog
                .getByRole("button", { name: "Push", exact: true })
                .click();
            await expect(normalPushDialog).toHaveCount(0);
            await expect
                .poll(() => git(remote, "rev-parse", "refs/heads/main").trim())
                .toBe(normalPushOid);

            git(repository, "reset", "--hard", `${normalPushOid}^`);
            const rewrittenOid = await commitFile(
                repository,
                "rewritten.txt",
                "local rewritten history\n",
                "local rewritten commit",
            );
            const staleDialog = await openPush(page);
            await expect(
                staleDialog.getByText("Diverged / rewritten", { exact: true }),
            ).toBeVisible();
            await staleDialog
                .getByRole("radio", { name: /Force push with lease/ })
                .check();
            await staleDialog
                .getByLabel(/confirm force push with lease/)
                .fill("main");

            git(peer, "fetch", "origin");
            git(peer, "reset", "--hard", "origin/main");
            const racedRemoteOid = await commitFile(
                peer,
                "remote-race.txt",
                "remote changed after review\n",
                "remote lease race",
            );
            git(peer, "push", "origin", "main");
            await staleDialog
                .getByRole("button", {
                    name: "Force Push with Lease",
                    exact: true,
                })
                .click();
            await expect(
                staleDialog.getByText(
                    /reviewed remote state is no longer reusable/i,
                ),
            ).toBeVisible();
            expect(git(remote, "rev-parse", "refs/heads/main").trim()).toBe(
                racedRemoteOid,
            );
            await staleDialog
                .getByRole("button", { name: "Cancel", exact: true })
                .click();

            await fetchThroughUi(page, "main");
            await expect
                .poll(() =>
                    git(
                        repository,
                        "rev-parse",
                        "refs/remotes/origin/main",
                    ).trim(),
                )
                .toBe(racedRemoteOid);
            await page.keyboard.press("Escape");

            const reviewedDialog = await openPush(page);
            await expect(
                reviewedDialog.getByText("Diverged / rewritten", {
                    exact: true,
                }),
            ).toBeVisible();
            await reviewedDialog
                .getByRole("radio", { name: /Force push with lease/ })
                .check();
            await reviewedDialog
                .getByLabel(/confirm force push with lease/)
                .fill("main");
            await reviewedDialog
                .getByRole("button", {
                    name: "Force Push with Lease",
                    exact: true,
                })
                .click();
            await expect(reviewedDialog).toHaveCount(0);
            await expect
                .poll(() => git(remote, "rev-parse", "refs/heads/main").trim())
                .toBe(rewrittenOid);
        } finally {
            await app.close();
        }
    } finally {
        await rm(parent, { recursive: true, force: true });
    }
});

test("aborts a conflicting rebase from visible recovery controls and restores the Git oracle", async () => {
    test.setTimeout(90_000);
    await resetQaProfile(runtimeProfileName);
    const parent = await mkdtemp(
        join(tmpdir(), "git-client-electron-rebase-abort-ui-"),
    );
    const repository = join(parent, "repository");

    try {
        await mkdir(repository);
        git(repository, "init", "--initial-branch=main");
        await configureRepository(repository);
        await writeFile(join(repository, "conflict.txt"), "baseline\n", "utf8");
        await writeFile(
            join(repository, "staged.txt"),
            "staged baseline\n",
            "utf8",
        );
        await writeFile(
            join(repository, "worktree.txt"),
            "worktree baseline\n",
            "utf8",
        );
        git(repository, "add", ".");
        git(repository, "commit", "--no-gpg-sign", "-m", "rebase baseline");

        await writeFile(
            join(repository, "worktree.txt"),
            "saved stash\n",
            "utf8",
        );
        git(repository, "stash", "push", "--message", "pre-existing stash");
        git(repository, "switch", "-c", "target");
        await commitFile(
            repository,
            "conflict.txt",
            "target change\n",
            "target conflicting change",
        );
        git(repository, "switch", "main");
        git(repository, "switch", "-c", "topic");
        await commitFile(
            repository,
            "conflict.txt",
            "topic change\n",
            "topic conflicting change",
        );
        await writeFile(
            join(repository, "staged.txt"),
            "staged local edit\n",
            "utf8",
        );
        git(repository, "add", "staged.txt");
        await writeFile(
            join(repository, "worktree.txt"),
            "unstaged local edit\n",
            "utf8",
        );
        await writeFile(
            join(repository, "untracked.txt"),
            "untracked local edit\n",
            "utf8",
        );

        const before = await captureGitState(await realpath(repository));
        await seedQaProfile(repository);
        const app = await launchPackaged(["--qa-isolated-profile"]);
        try {
            const { page } = app;
            await waitForRepository(page, repository);
            await openBranches(page, "topic");
            await page
                .getByRole("dialog", { name: "Git Branches" })
                .getByRole("button", { name: "Settings", exact: true })
                .click();

            const branchesDialog = page.getByRole("dialog", {
                name: "Branches & Tags",
            });
            await branchesDialog.getByLabel("Reference").click();
            await page
                .getByRole("option", { name: "local · target", exact: true })
                .click();
            await branchesDialog
                .getByRole("button", { name: "Rebase current", exact: true })
                .click();
            const confirmation = page.getByRole("dialog", {
                name: "Rebase topic onto target?",
            });
            await confirmation
                .getByRole("button", { name: "Start rebase", exact: true })
                .click();
            await expect
                .poll(() => gitRefExists(repository, "REBASE_HEAD"))
                .toBe(true);

            await branchesDialog
                .getByRole("button", {
                    name: "Close Branches & Tags",
                    exact: true,
                })
                .click();
            await expect(
                page.getByText("rebase in progress", { exact: true }),
            ).toBeVisible();
            await page
                .getByRole("button", { name: "Abort", exact: true })
                .click();
            const abortDialog = page.getByRole("dialog", {
                name: "Abort rebase?",
            });
            await abortDialog
                .getByRole("button", { name: "Abort operation", exact: true })
                .click();

            await expect
                .poll(
                    async () =>
                        compareGitStates(
                            before,
                            await captureGitState(repository),
                        ),
                    {
                        timeout: 20_000,
                    },
                )
                .toEqual({ equal: true, differences: [] });
            expect(gitRefExists(repository, "REBASE_HEAD")).toBe(false);
        } finally {
            await app.close();
        }
    } finally {
        await rm(parent, { recursive: true, force: true });
    }
});

test("resolves and continues a conflicting cherry-pick through visible history and recovery UI", async () => {
    test.setTimeout(90_000);
    await resetQaProfile(runtimeProfileName);
    const parent = await mkdtemp(
        join(tmpdir(), "git-client-electron-cherry-continue-ui-"),
    );
    const repository = join(parent, "repository");

    try {
        await mkdir(repository);
        git(repository, "init", "--initial-branch=main");
        await configureRepository(repository);
        await writeFile(join(repository, "conflict.txt"), "baseline\n", "utf8");
        git(repository, "add", "conflict.txt");
        git(
            repository,
            "commit",
            "--no-gpg-sign",
            "-m",
            "cherry-pick baseline",
        );
        git(repository, "switch", "-c", "source");
        const sourceOid = await commitFile(
            repository,
            "conflict.txt",
            "source change\n",
            "source conflicting change",
        );
        git(repository, "switch", "main");
        const mainOid = await commitFile(
            repository,
            "conflict.txt",
            "main change\n",
            "main conflicting change",
        );
        await seedQaProfile(repository);

        const app = await launchPackaged(["--qa-isolated-profile"]);
        try {
            const { page } = app;
            await waitForRepository(page, repository);
            const sourceRow = page
                .getByRole("row")
                .filter({ hasText: "source conflicting change" });
            await expect(sourceRow).toHaveCount(1);
            await sourceRow.click({ button: "right" });
            await page
                .getByRole("menuitem", { name: "Cherry-Pick", exact: true })
                .click();
            await expect
                .poll(() => gitRefExists(repository, "CHERRY_PICK_HEAD"))
                .toBe(true);
            await expect(
                page.getByText("cherryPick in progress", { exact: true }),
            ).toBeVisible();

            await page
                .getByRole("button", { name: "Commit", exact: true })
                .click();
            const changedFiles = page.locator(
                'aside[aria-label="Changed files"]',
            );
            const conflictFile = changedFiles
                .getByText("conflict.txt", { exact: true })
                .first();
            await expect(conflictFile).toBeVisible();
            await conflictFile.click();
            await changedFiles.focus();
            await changedFiles.press("Space");

            const conflictDialog = page.getByRole("dialog", {
                name: "Resolve conflict in conflict.txt",
            });
            await expect(conflictDialog).toBeVisible();
            await conflictDialog
                .getByRole("button", { name: "Remote", exact: true })
                .click();
            await conflictDialog
                .getByRole("button", { name: "Save and stage", exact: true })
                .click();
            await expect(conflictDialog).toHaveCount(0);
            await page
                .getByRole("button", { name: "Continue", exact: true })
                .click();

            await expect
                .poll(() => gitRefExists(repository, "CHERRY_PICK_HEAD"))
                .toBe(false);
            expect(git(repository, "rev-parse", "HEAD").trim()).not.toBe(
                mainOid,
            );
            expect(git(repository, "rev-parse", "HEAD").trim()).not.toBe(
                sourceOid,
            );
            expect(git(repository, "log", "-1", "--format=%s").trim()).toBe(
                "source conflicting change",
            );
            expect(git(repository, "show", "HEAD:conflict.txt")).toBe(
                "source change\n",
            );
            expect(git(repository, "status", "--porcelain=v2")).toBe("");
        } finally {
            await app.close();
        }
    } finally {
        await rm(parent, { recursive: true, force: true });
    }
});
