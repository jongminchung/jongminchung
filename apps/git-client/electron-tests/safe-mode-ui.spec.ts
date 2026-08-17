import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { expect, test } from "@playwright/test";
import {
    captureGitState,
    compareGitStates,
} from "../scripts/independent-audit/git-state-oracle.ts";
import {
    launchPackaged,
    resetQaProfile,
    runtimeProfileName,
} from "./packaged-app-harness";

function git(repository: string, ...args: readonly string[]): void {
    execFileSync("git", args, { cwd: repository, stdio: "ignore" });
}

async function initializeSafeRepository(parent: string): Promise<string> {
    const repository = join(parent, "safe repository");
    await mkdir(repository);
    git(repository, "init", "--initial-branch=main");
    git(repository, "config", "user.name", "Git Client Safe Mode QA");
    git(repository, "config", "user.email", "safe-mode@example.invalid");
    await writeFile(
        join(repository, "README.md"),
        "safe mode baseline\n",
        "utf8",
    );
    git(repository, "add", "README.md");
    git(repository, "commit", "-m", "safe mode baseline");
    await writeFile(
        join(repository, "README.md"),
        "safe mode baseline\ndirty change\n",
        "utf8",
    );
    await writeFile(
        join(repository, "untracked.txt"),
        "must remain untracked\n",
        "utf8",
    );
    return realpath(repository);
}

async function seedSafeProfile(repository: string): Promise<void> {
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
                    activeRepositoryPath: repository,
                    openRepositoryPaths: [repository],
                    recentProjects: [
                        {
                            branch: "main",
                            lastOpenedAt: 1,
                            name: basename(repository),
                            path: repository,
                        },
                    ],
                    safeRepositoryPaths: [repository],
                    schemaVersion: 10,
                },
            },
            null,
            2,
        )}\n`,
        "utf8",
    );
}

test("keeps a packaged safe-mode project read-only across restart", async () => {
    test.setTimeout(60_000);
    await resetQaProfile(runtimeProfileName);
    const parent = await mkdtemp(join(tmpdir(), "git-client-safe-mode-ui-"));
    const repository = await initializeSafeRepository(parent);
    await seedSafeProfile(repository);
    const before = await captureGitState(repository);

    try {
        const app = await launchPackaged(["--qa-isolated-profile"]);
        try {
            const { page } = app;
            await expect(
                page.getByRole("button", {
                    name: `Project: ${basename(repository)}`,
                }),
            ).toBeVisible();
            await expect(
                page.getByRole("status", { name: "Safe Mode" }),
            ).toBeVisible();
            await expect(
                page.getByRole("region", { name: "Commit log" }),
            ).toBeVisible();
            await expect(
                page
                    .getByRole("grid", { name: "Git log" })
                    .locator("[data-oid]"),
            ).toHaveCount(1);

            const mainToolbar = page.getByRole("banner", {
                name: "Main Toolbar",
            });
            await expect(
                mainToolbar.getByRole("button", { name: "Update Project..." }),
            ).toBeDisabled();
            await expect(
                mainToolbar.getByRole("button", { name: "Push…" }),
            ).toBeDisabled();
            await expect(
                mainToolbar.getByRole("button", { name: "main", exact: true }),
            ).toBeDisabled();

            const leftToolbar = page.getByRole("navigation", {
                name: "Left Toolbar",
            });
            await expect(
                leftToolbar.getByRole("button", {
                    name: "Commit",
                    exact: true,
                }),
            ).toBeDisabled();
            await expect(
                leftToolbar.getByRole("button", {
                    name: "Terminal",
                    exact: true,
                }),
            ).toBeDisabled();

            await mainToolbar
                .getByRole("button", { name: "Search Everywhere" })
                .click();
            const palette = page.getByRole("dialog", {
                name: "Search Everywhere",
            });
            const search = palette.getByRole("combobox", {
                name: "Search Everywhere",
            });
            await search.fill("Manage Accounts");
            const hosting = palette.getByRole("option", {
                name: /Manage Accounts…/u,
            });
            await expect(hosting).toHaveAttribute("aria-disabled", "true");
            await expect(hosting).toContainText(
                "Git changes and executable tools are unavailable in Safe Mode.",
            );

            await search.fill("Stage All Tracked");
            const mutation = palette.getByRole("option", {
                name: /Stage All Tracked/u,
            });
            await expect(mutation).toHaveAttribute("aria-disabled", "true");
            await mutation.focus();
            await page.keyboard.press("Enter");
            await expect(palette).toBeVisible();
            await page.keyboard.press("Escape");

            await page.locator('[data-project-path="README.md"]').dblclick();
            const editor = page.getByRole("region", {
                name: "Editor: README.md",
            });
            await expect(editor.locator(".cm-content")).toHaveAttribute(
                "contenteditable",
                "false",
            );
            await expect(
                editor.getByRole("button", { name: "Save", exact: true }),
            ).toBeDisabled();

            const directBoundaryResults = await page.evaluate(async (path) => {
                const api = window.gitClient;
                if (api === undefined)
                    throw new Error("Git Client preload API is unavailable");
                const repositoryRecord = await api.git.openRepository(path);
                const rejected = async (
                    label: string,
                    operation: () => Promise<unknown>,
                ) => {
                    try {
                        await operation();
                        return `${label}: allowed`;
                    } catch (error) {
                        return `${label}: ${error instanceof Error ? error.message : String(error)}`;
                    }
                };
                return Promise.all([
                    rejected("operation", () =>
                        api.git.executeQuery(
                            {
                                kind: "operation",
                                requestId: crypto.randomUUID(),
                                repositoryId: repositoryRecord.id,
                                operation: { kind: "stageAll" },
                            },
                            () => undefined,
                        ),
                    ),
                    rejected("pre-commit", () =>
                        api.git.preCommitCheck(repositoryRecord.id),
                    ),
                    rejected("write", () =>
                        api.git.writeWorkingTreeFile(
                            repositoryRecord.id,
                            "README.md",
                            "unsafe write\n",
                        ),
                    ),
                    rejected("external", () =>
                        api.git.openWorkingTreeFile(
                            repositoryRecord.id,
                            "README.md",
                        ),
                    ),
                    rejected("terminal", () =>
                        api.terminal.listLaunchTargets(),
                    ),
                    rejected("hosting", () => api.hosting.restoreAccounts([])),
                ]);
            }, repository);
            expect(directBoundaryResults).toHaveLength(6);
            for (const result of directBoundaryResults) {
                expect(result).toContain("Safe Mode");
                expect(result).not.toContain("allowed");
            }

            expect(
                compareGitStates(before, await captureGitState(repository)),
            ).toEqual({
                differences: [],
                equal: true,
            });

            await mainToolbar
                .getByRole("button", { name: "Search Everywhere" })
                .click();
            const closePalette = page.getByRole("dialog", {
                name: "Search Everywhere",
            });
            await closePalette
                .getByRole("combobox", { name: "Search Everywhere" })
                .fill("Close Project");
            const closeProject = closePalette.getByRole("option", {
                name: /Close Project/u,
            });
            await expect(closeProject).not.toHaveAttribute(
                "aria-disabled",
                "true",
            );
            await closeProject.click();
            await expect(page).toHaveTitle("Welcome to Git Client");
            await expect
                .poll(async () =>
                    page.evaluate(async () => {
                        const api = window.gitClient;
                        if (api === undefined)
                            throw new Error(
                                "Git Client preload API is unavailable",
                            );
                        return {
                            openRepositoryPaths: await api.settings.get(
                                "openRepositoryPaths",
                            ),
                            safeRepositoryPaths: await api.settings.get(
                                "safeRepositoryPaths",
                            ),
                        };
                    }),
                )
                .toEqual({
                    openRepositoryPaths: [],
                    safeRepositoryPaths: [repository],
                });
        } finally {
            await app.close();
        }

        const reopened = await launchPackaged(["--qa-isolated-profile"]);
        try {
            await expect(reopened.page).toHaveTitle("Welcome to Git Client");
            const recentProject = reopened.page
                .getByRole("listbox", { name: "Recent Projects" })
                .getByRole("option", {
                    name: new RegExp(basename(repository), "u"),
                });
            await recentProject.dblclick();
            await expect(
                reopened.page.getByRole("status", { name: "Safe Mode" }),
            ).toBeVisible();
            await expect(
                reopened.page
                    .getByRole("navigation", { name: "Left Toolbar" })
                    .getByRole("button", { name: "Terminal", exact: true }),
            ).toBeDisabled();
        } finally {
            await reopened.close();
        }

        expect(
            compareGitStates(before, await captureGitState(repository)),
        ).toEqual({
            differences: [],
            equal: true,
        });
    } finally {
        await rm(parent, { recursive: true, force: true });
        await resetQaProfile(runtimeProfileName);
    }
});
