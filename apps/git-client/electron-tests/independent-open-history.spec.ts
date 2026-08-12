import { execFileSync } from "node:child_process";
import {
    mkdir,
    mkdtemp,
    readFile,
    realpath,
    rm,
    writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { expect, test } from "@playwright/test";
import {
    captureGitState,
    compareGitStates,
} from "../scripts/independent-audit/git-state-oracle.mjs";
import {
    launchPackaged,
    resetQaProfile,
    runtimeProfileName,
} from "./packaged-app-harness";

function git(cwd: string, ...args: readonly string[]): void {
    execFileSync("git", args, { cwd, stdio: "ignore" });
}

function gitText(cwd: string, ...args: readonly string[]): string {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

async function initializeRepository(
    repository: string,
    label: string,
): Promise<void> {
    await mkdir(repository);
    git(repository, "init", "--initial-branch=main");
    git(repository, "config", "user.name", "Git Client QA");
    git(repository, "config", "user.email", "qa@example.invalid");
    await writeFile(join(repository, "README.md"), `${label}\n`, "utf8");
    git(repository, "add", "README.md");
    git(repository, "commit", "-m", `${label} baseline`);
}

async function seedRecentProjects(
    profileName: string,
    projects: readonly {
        readonly branch: string;
        readonly name: string;
        readonly path: string;
    }[],
): Promise<void> {
    const profilePath = join(
        homedir(),
        "Library",
        "Application Support",
        profileName,
    );
    await mkdir(profilePath, { recursive: true });
    await writeFile(
        join(profilePath, "settings.json"),
        `${JSON.stringify(
            {
                schemaVersion: 1,
                values: {
                    activeRepositoryPath: null,
                    openRepositoryPaths: [],
                    recentProjects: projects.map((project, index) => ({
                        ...project,
                        lastOpenedAt: projects.length - index,
                    })),
                    schemaVersion: 10,
                },
            },
            null,
            2,
        )}\n`,
        "utf8",
    );
}

async function persistedValues(
    profileName: string,
): Promise<Readonly<Record<string, unknown>>> {
    const settingsPath = join(
        homedir(),
        "Library",
        "Application Support",
        profileName,
        "settings.json",
    );
    const parsed = JSON.parse(await readFile(settingsPath, "utf8")) as {
        readonly values?: Readonly<Record<string, unknown>>;
    };
    return parsed.values ?? {};
}

test("opens a recent project through the packaged UI and restores its history review", async () => {
    test.setTimeout(60_000);
    await resetQaProfile(runtimeProfileName);
    const parent = await mkdtemp(
        join(tmpdir(), "git-client-independent-open-history-"),
    );
    const repository = join(parent, "audit repository");
    const otherRepository = join(parent, "other repository");

    await initializeRepository(repository, "foundation");
    await mkdir(join(repository, "docs"));
    await writeFile(
        join(repository, "docs", "audit-guide.md"),
        "# Independent audit\n\naudit evidence line\n",
        "utf8",
    );
    await writeFile(
        join(repository, "README.md"),
        "foundation\naudit guide linked\n",
        "utf8",
    );
    git(repository, "add", "README.md", "docs/audit-guide.md");
    git(repository, "commit", "-m", "docs: add audit guide");
    const auditOid = gitText(repository, "rev-parse", "HEAD");
    await mkdir(join(repository, "src"));
    await writeFile(
        join(repository, "src", "head.txt"),
        "current head\n",
        "utf8",
    );
    git(repository, "add", "src/head.txt");
    git(repository, "commit", "-m", "feat: add head marker");

    await initializeRepository(otherRepository, "secondary");
    const [canonicalRepository, canonicalOtherRepository] = await Promise.all([
        realpath(repository),
        realpath(otherRepository),
    ]);
    const initialGitState = await captureGitState(canonicalRepository);

    // The native macOS directory picker is outside Playwright's CDP automation boundary.
    // Seed only Recent Projects; opening the repository remains a visible double-click action.
    await seedRecentProjects(runtimeProfileName, [
        {
            branch: "main",
            name: basename(canonicalRepository),
            path: canonicalRepository,
        },
        {
            branch: "main",
            name: basename(canonicalOtherRepository),
            path: canonicalOtherRepository,
        },
    ]);

    try {
        const app = await launchPackaged(["--qa-isolated-profile"]);
        try {
            const { page } = app;
            await expect(page).toHaveTitle("Welcome to Git Client");
            const recentProjects = page.getByRole("listbox", {
                name: "Recent Projects",
            });
            await expect(recentProjects).toBeVisible();
            await expect(recentProjects.getByRole("option")).toHaveCount(2);

            const projectSearch = page.getByPlaceholder("Search projects");
            await projectSearch.fill("audit repository");
            const auditProject = recentProjects.getByRole("option", {
                name: /audit repository.*main/u,
            });
            await expect(auditProject).toBeVisible();
            await expect(recentProjects.getByRole("option")).toHaveCount(1);
            await auditProject.dblclick();

            const projectButton = page.getByRole("button", {
                name: `Project: ${basename(canonicalRepository)}`,
            });
            await expect(projectButton).toBeVisible();
            await expect(
                page.getByRole("region", { name: "Commit log" }),
            ).toBeVisible();

            const projectDialog = page.getByRole("dialog", {
                name: "Projects",
            });
            await projectButton.focus();
            await projectButton.press("Enter");
            await expect(projectDialog).toBeVisible();
            await expect(projectDialog).toContainText("Open Projects");
            await expect(projectDialog).toContainText("Recent Projects");
            await expect(projectDialog).toContainText(
                basename(canonicalOtherRepository),
            );
            await page.keyboard.press("Escape");

            const logTable = page.getByRole("table", { name: "Git log" });
            await expect(logTable.locator("[data-oid]")).toHaveCount(3);
            const historySearch = page.getByPlaceholder("Text or hash");
            await historySearch.fill("add audit guide");
            await expect(logTable.locator("[data-oid]")).toHaveCount(1);
            const auditCommit = logTable.locator(`[data-oid="${auditOid}"]`);
            await expect(auditCommit).toContainText("docs: add audit guide");
            await auditCommit.click();

            const review = page.getByRole("complementary", {
                name: "Revision review",
            });
            await expect(
                review.getByText(auditOid, { exact: true }),
            ).toBeVisible();
            await expect(review).toContainText("Git Client QA");
            const changedFiles = review.getByRole("navigation", {
                name: "Changed files",
            });
            const auditFile = changedFiles
                .getByRole("button")
                .filter({ hasText: "audit-guide.md" });
            await expect(auditFile).toBeVisible();
            await auditFile.dblclick();
            const diff = page.getByRole("region", {
                name: "Diff for docs/audit-guide.md",
            });
            await expect(diff).toBeVisible();
            await expect(
                page.getByRole("region", {
                    name: "Diff content for docs/audit-guide.md",
                }),
            ).toContainText("audit evidence line");

            await historySearch.fill("");
            await expect(logTable.locator("[data-oid]")).toHaveCount(3);
            await expect(
                logTable.locator(`[data-oid="${auditOid}"]`),
            ).toHaveAttribute("aria-selected", "true");

            await expect
                .poll(async () => {
                    const values = await persistedValues(runtimeProfileName);
                    const repositoryState = Object.entries(values).find(
                        ([key]) => key.startsWith("repositoryUiState:"),
                    )?.[1] as
                        | {
                              readonly historySelectedPath?: unknown;
                              readonly selectedOids?: unknown;
                          }
                        | undefined;
                    return {
                        activeRepositoryPath: values.activeRepositoryPath,
                        historySelectedPath:
                            repositoryState?.historySelectedPath,
                        openRepositoryPaths: values.openRepositoryPaths,
                        selectedOids: repositoryState?.selectedOids,
                    };
                })
                .toEqual({
                    activeRepositoryPath: canonicalRepository,
                    historySelectedPath: "docs/audit-guide.md",
                    openRepositoryPaths: [canonicalRepository],
                    selectedOids: [auditOid],
                });
        } finally {
            await app.close();
        }

        const reopenedApp = await launchPackaged(["--qa-isolated-profile"]);
        try {
            const { page } = reopenedApp;
            await expect(
                page.getByRole("button", {
                    name: `Project: ${basename(canonicalRepository)}`,
                }),
            ).toBeVisible();
            const restoredCommit = page
                .getByRole("table", { name: "Git log" })
                .locator(`[data-oid="${auditOid}"]`);
            await expect(restoredCommit).toHaveAttribute(
                "aria-selected",
                "true",
            );
            const restoredReview = page.getByRole("complementary", {
                name: "Revision review",
            });
            await expect(
                restoredReview.getByText(auditOid, { exact: true }),
            ).toBeVisible();
            const restoredFile = restoredReview
                .getByRole("navigation", { name: "Changed files" })
                .getByRole("button")
                .filter({ hasText: "audit-guide.md" });
            await expect(restoredFile).toHaveAttribute("aria-current", "true");
            await restoredReview
                .getByRole("button", { name: "Show Diff" })
                .click();
            await expect(
                page.getByRole("region", {
                    name: "Diff content for docs/audit-guide.md",
                }),
            ).toContainText("audit evidence line");

            await page
                .getByRole("button", {
                    name: `Project: ${basename(canonicalRepository)}`,
                })
                .click();
            const restoredProjects = page.getByRole("dialog", {
                name: "Projects",
            });
            await expect(restoredProjects).toContainText(
                basename(canonicalRepository),
            );
            await expect(restoredProjects).toContainText(
                basename(canonicalOtherRepository),
            );
        } finally {
            await reopenedApp.close();
        }

        const finalGitState = await captureGitState(canonicalRepository);
        expect(compareGitStates(initialGitState, finalGitState)).toEqual({
            differences: [],
            equal: true,
        });
    } finally {
        await rm(parent, { recursive: true, force: true });
    }
});
