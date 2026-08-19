import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { DesktopApi } from "../src/shared/contracts/desktop-api";
import type { HostingAccount } from "../src/shared/contracts/hosting";
import {
    inspectHostingProfile,
    launchPackagedHosting,
    resetHostingProfile,
    startLoopbackHostingServer,
} from "./packaged-hosting-harness";
import type {
    LoopbackHostingServer,
    PackagedHostingApp,
} from "./packaged-hosting-harness";

interface FirstRunResult {
    readonly accounts: readonly HostingAccount[];
    readonly errorWasRedacted: boolean;
    readonly gitHubCount: number;
    readonly gitLabCount: number;
    readonly rendererResponsesAreSafe: boolean;
}

interface RestoredRunResult {
    readonly deleteErrorsAreSafe: boolean;
    readonly deletedAccountsReject: boolean;
    readonly gitHubCount: number;
    readonly gitLabCount: number;
    readonly rendererResponsesAreSafe: boolean;
}

test("[성공] 사전 로드, 가져올 수 있는 IPC, 가져오기 및 보관된 공유기를 통해 배터리를 사용할 수 있음", async () => {
    test.setTimeout(90_000);
    const gitHubCredential = `ghp_e2e_${randomUUID().replaceAll("-", "")}`;
    const gitLabCredential = `glpat-e2e-${randomUUID().replaceAll("-", "")}`;
    const credentials = [gitHubCredential, gitLabCredential];
    const repositoryPath = await mkdtemp(
        join(tmpdir(), "git-client-hosting-ui-"),
    );
    execFileSync("git", ["init", "--initial-branch=main"], {
        cwd: repositoryPath,
        stdio: "ignore",
    });
    execFileSync("git", ["config", "user.name", "Hosting QA"], {
        cwd: repositoryPath,
    });
    execFileSync("git", ["config", "user.email", "hosting@example.invalid"], {
        cwd: repositoryPath,
    });
    await writeFile(
        join(repositoryPath, "README.md"),
        "hosting fixture\n",
        "utf8",
    );
    execFileSync("git", ["add", "README.md"], { cwd: repositoryPath });
    execFileSync("git", ["commit", "-m", "hosting fixture"], {
        cwd: repositoryPath,
        stdio: "ignore",
    });
    execFileSync(
        "git",
        ["remote", "add", "origin", "https://github.com/owner/repo.git"],
        { cwd: repositoryPath },
    );
    let server: LoopbackHostingServer | null = null;
    let firstApp: PackagedHostingApp | null = null;
    let restoredApp: PackagedHostingApp | null = null;

    await resetHostingProfile();
    try {
        server = await startLoopbackHostingServer(
            gitHubCredential,
            gitLabCredential,
        );
        firstApp = await launchPackagedHosting(server.certificatePath);
        const firstRun = await firstApp.page.evaluate<
            FirstRunResult,
            {
                readonly baseUrl: string;
                readonly gitHubCredential: string;
                readonly gitLabCredential: string;
            }
        >(
            async ({ baseUrl, gitHubCredential, gitLabCredential }) => {
                const desktopWindow = window as typeof window & {
                    readonly gitClient?: DesktopApi;
                };
                const api = desktopWindow.gitClient;
                if (api === undefined)
                    throw new Error("Electron preload API is unavailable");

                const gitHubAccount = await api.hosting.saveAccount(
                    "gitHub",
                    baseUrl,
                    gitHubCredential,
                );
                const gitLabAccount = await api.hosting.saveAccount(
                    "gitLab",
                    baseUrl,
                    gitLabCredential,
                );
                const gitHubResponse = await api.hosting.execute(
                    gitHubAccount.id,
                    {
                        kind: "list",
                        project: "owner/repo",
                        page: 1,
                    },
                );
                const gitLabResponse = await api.hosting.execute(
                    gitLabAccount.id,
                    {
                        kind: "list",
                        project: "group/repo",
                        page: 1,
                    },
                );

                let errorWasRedacted = false;
                try {
                    await api.hosting.execute(gitHubAccount.id, {
                        kind: "list",
                        project: "owner/error",
                        page: 1,
                    });
                } catch (error) {
                    const message =
                        error instanceof Error ? error.message : String(error);
                    errorWasRedacted =
                        message.includes("[redacted]") &&
                        !message.includes(gitHubCredential) &&
                        !message.includes(gitLabCredential) &&
                        !message.includes(`Bearer ${gitHubCredential}`);
                }

                const rendererPayload = JSON.stringify([
                    gitHubAccount,
                    gitLabAccount,
                    gitHubResponse,
                    gitLabResponse,
                ]);
                const rendererResponsesAreSafe =
                    !rendererPayload.includes(gitHubCredential) &&
                    !rendererPayload.includes(gitLabCredential) &&
                    !/"(?:token|authorization)"\s*:/iu.test(rendererPayload);
                const accounts = [gitHubAccount, gitLabAccount].map(
                    (account) => ({
                        id: account.id,
                        provider: account.provider,
                        baseUrl: account.baseUrl,
                        login: account.login,
                    }),
                );
                return {
                    accounts,
                    errorWasRedacted,
                    gitHubCount:
                        gitHubResponse.kind === "changeRequests"
                            ? gitHubResponse.items.length
                            : -1,
                    gitLabCount:
                        gitLabResponse.kind === "changeRequests"
                            ? gitLabResponse.items.length
                            : -1,
                    rendererResponsesAreSafe,
                };
            },
            { baseUrl: server.baseUrl, gitHubCredential, gitLabCredential },
        );

        expect(firstRun).toMatchObject({
            errorWasRedacted: true,
            gitHubCount: 1,
            gitLabCount: 1,
            rendererResponsesAreSafe: true,
        });
        expect(firstRun.accounts).toHaveLength(2);
        await firstApp.page.evaluate(
            async ({ accounts, repositoryPath }) => {
                const api = (
                    window as typeof window & {
                        readonly gitClient?: DesktopApi;
                    }
                ).gitClient;
                if (api === undefined)
                    throw new Error("Electron preload API is unavailable");
                await api.settings.set("openRepositoryPaths", [repositoryPath]);
                await api.settings.set("activeRepositoryPath", repositoryPath);
                await api.settings.set("hostingAccounts", accounts);
            },
            { accounts: [...firstRun.accounts], repositoryPath },
        );
        await firstApp.page.reload();
        await expect(
            firstApp.page.getByRole("region", { name: "Commit log" }),
        ).toBeVisible();
        await firstApp.page
            .getByRole("button", { name: "Search Everywhere" })
            .click();
        const palette = firstApp.page.getByRole("dialog", {
            name: "Search Everywhere",
        });
        await palette.getByRole("combobox").fill("Manage Accounts");
        await palette.getByRole("option", { name: /Manage Accounts/u }).click();
        const hostingDialog = firstApp.page.getByRole("dialog", {
            name: "GitHub / GitLab",
        });
        await expect(hostingDialog).toBeVisible();
        await expect(hostingDialog.getByLabel("Account")).toContainText(
            "github-qa · GitHub",
        );
        await hostingDialog.getByLabel("Hosting project").fill("owner/repo");
        await hostingDialog.getByRole("button", { name: "Load" }).click();
        const request = hostingDialog.getByRole("button", {
            name: /Packaged GitHub request/u,
        });
        await expect(request).toBeVisible();
        await expect(
            hostingDialog.getByText(
                "Select a change request to inspect files and timeline.",
            ),
        ).toBeVisible();
        await hostingDialog.getByLabel("Hosting project").fill("");
        await request.click();
        await expect(request).toHaveAttribute("aria-current", "true");
        const details = hostingDialog.getByRole("region", {
            name: "Change request detail",
        });
        await expect(details).toContainText("#7 Packaged GitHub request");
        await firstApp.close();
        expect(firstApp.outputContainsCredential(credentials)).toBe(false);
        firstApp = null;
        await expect(inspectHostingProfile(credentials)).resolves.toEqual({
            credentialCount: 2,
            containsCredential: false,
        });

        restoredApp = await launchPackagedHosting(server.certificatePath);
        const restoredRun = await restoredApp.page.evaluate<
            RestoredRunResult,
            {
                readonly accounts: readonly HostingAccount[];
                readonly gitHubCredential: string;
                readonly gitLabCredential: string;
            }
        >(
            async ({ accounts, gitHubCredential, gitLabCredential }) => {
                const desktopWindow = window as typeof window & {
                    readonly gitClient?: DesktopApi;
                };
                const api = desktopWindow.gitClient;
                if (api === undefined)
                    throw new Error("Electron preload API is unavailable");
                const gitHubAccount = accounts.find(
                    (account) => account.provider === "gitHub",
                );
                const gitLabAccount = accounts.find(
                    (account) => account.provider === "gitLab",
                );
                if (
                    gitHubAccount === undefined ||
                    gitLabAccount === undefined
                ) {
                    throw new Error("Hosting account metadata is incomplete");
                }

                await api.hosting.restoreAccounts(accounts);
                const gitHubResponse = await api.hosting.execute(
                    gitHubAccount.id,
                    {
                        kind: "list",
                        project: "owner/repo",
                        page: 1,
                    },
                );
                const gitLabResponse = await api.hosting.execute(
                    gitLabAccount.id,
                    {
                        kind: "list",
                        project: "group/repo",
                        page: 1,
                    },
                );
                await api.hosting.deleteAccount(gitHubAccount.id);
                await api.hosting.deleteAccount(gitLabAccount.id);

                let rejected = 0;
                let deleteErrorsAreSafe = true;
                for (const account of accounts) {
                    try {
                        await api.hosting.execute(account.id, {
                            kind: "list",
                            project:
                                account.provider === "gitHub"
                                    ? "owner/repo"
                                    : "group/repo",
                            page: 1,
                        });
                    } catch (error) {
                        rejected += 1;
                        const message =
                            error instanceof Error
                                ? error.message
                                : String(error);
                        deleteErrorsAreSafe =
                            deleteErrorsAreSafe &&
                            !message.includes(gitHubCredential) &&
                            !message.includes(gitLabCredential) &&
                            !message.includes(`Bearer ${gitHubCredential}`);
                    }
                }

                const rendererPayload = JSON.stringify([
                    gitHubResponse,
                    gitLabResponse,
                ]);
                return {
                    deleteErrorsAreSafe,
                    deletedAccountsReject: rejected === accounts.length,
                    gitHubCount:
                        gitHubResponse.kind === "changeRequests"
                            ? gitHubResponse.items.length
                            : -1,
                    gitLabCount:
                        gitLabResponse.kind === "changeRequests"
                            ? gitLabResponse.items.length
                            : -1,
                    rendererResponsesAreSafe:
                        !rendererPayload.includes(gitHubCredential) &&
                        !rendererPayload.includes(gitLabCredential) &&
                        !/"(?:token|authorization)"\s*:/iu.test(
                            rendererPayload,
                        ),
                };
            },
            {
                accounts: firstRun.accounts,
                gitHubCredential,
                gitLabCredential,
            },
        );

        expect(restoredRun).toEqual({
            deleteErrorsAreSafe: true,
            deletedAccountsReject: true,
            gitHubCount: 1,
            gitLabCount: 1,
            rendererResponsesAreSafe: true,
        });
        await restoredApp.close();
        expect(restoredApp.outputContainsCredential(credentials)).toBe(false);
        restoredApp = null;
        await expect(inspectHostingProfile(credentials)).resolves.toEqual({
            credentialCount: 0,
            containsCredential: false,
        });

        const requests = server.requests();
        expect(requests).toHaveLength(8);
        expect(requests.every((request) => request.credentialAccepted)).toBe(
            true,
        );
        expect(
            requests.filter((request) => request.provider === "gitHub"),
        ).toHaveLength(5);
        expect(
            requests.filter((request) => request.provider === "gitLab"),
        ).toHaveLength(3);
        expect(
            requests.filter((request) => request.method === "POST"),
        ).toHaveLength(0);
    } finally {
        await firstApp?.close();
        await restoredApp?.close();
        await server?.close();
        await resetHostingProfile();
        await rm(repositoryPath, { recursive: true, force: true });
    }
});
