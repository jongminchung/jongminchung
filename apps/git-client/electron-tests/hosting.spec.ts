import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { HostingAccount } from "../electron/hosting/hosting-contract";
import type { DesktopApi } from "../src/shared/contracts/ipc";
import {
  inspectHostingProfile,
  launchPackagedHosting,
  resetHostingProfile,
  startLoopbackHostingServer,
} from "./packaged-hosting-harness";
import type { LoopbackHostingServer, PackagedHostingApp } from "./packaged-hosting-harness";

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

test("routes packaged hosting through preload, trusted IPC, fetch, and safeStorage", async () => {
  test.setTimeout(60_000);
  const gitHubCredential = `ghp_e2e_${randomUUID().replaceAll("-", "")}`;
  const gitLabCredential = `glpat-e2e-${randomUUID().replaceAll("-", "")}`;
  const credentials = [gitHubCredential, gitLabCredential];
  let server: LoopbackHostingServer | null = null;
  let firstApp: PackagedHostingApp | null = null;
  let restoredApp: PackagedHostingApp | null = null;

  await resetHostingProfile();
  try {
    server = await startLoopbackHostingServer(gitHubCredential, gitLabCredential);
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
        if (api === undefined) throw new Error("Electron preload API is unavailable");

        const gitHubAccount = await api.hosting.saveAccount("gitHub", baseUrl, gitHubCredential);
        const gitLabAccount = await api.hosting.saveAccount("gitLab", baseUrl, gitLabCredential);
        const gitHubResponse = await api.hosting.execute(gitHubAccount.id, {
          kind: "list",
          project: "owner/repo",
          page: 1,
        });
        const gitLabResponse = await api.hosting.execute(gitLabAccount.id, {
          kind: "list",
          project: "group/repo",
          page: 1,
        });

        let errorWasRedacted = false;
        try {
          await api.hosting.execute(gitHubAccount.id, {
            kind: "list",
            project: "owner/error",
            page: 1,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
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
        const accounts = [gitHubAccount, gitLabAccount].map((account) => ({
          id: account.id,
          provider: account.provider,
          baseUrl: account.baseUrl,
          login: account.login,
        }));
        return {
          accounts,
          errorWasRedacted,
          gitHubCount: gitHubResponse.kind === "changeRequests" ? gitHubResponse.items.length : -1,
          gitLabCount: gitLabResponse.kind === "changeRequests" ? gitLabResponse.items.length : -1,
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
        if (api === undefined) throw new Error("Electron preload API is unavailable");
        const gitHubAccount = accounts.find((account) => account.provider === "gitHub");
        const gitLabAccount = accounts.find((account) => account.provider === "gitLab");
        if (gitHubAccount === undefined || gitLabAccount === undefined) {
          throw new Error("Hosting account metadata is incomplete");
        }

        await api.hosting.restoreAccounts(accounts);
        const gitHubResponse = await api.hosting.execute(gitHubAccount.id, {
          kind: "list",
          project: "owner/repo",
          page: 1,
        });
        const gitLabResponse = await api.hosting.execute(gitLabAccount.id, {
          kind: "list",
          project: "group/repo",
          page: 1,
        });
        await api.hosting.deleteAccount(gitHubAccount.id);
        await api.hosting.deleteAccount(gitLabAccount.id);

        let rejected = 0;
        let deleteErrorsAreSafe = true;
        for (const account of accounts) {
          try {
            await api.hosting.execute(account.id, {
              kind: "list",
              project: account.provider === "gitHub" ? "owner/repo" : "group/repo",
              page: 1,
            });
          } catch (error) {
            rejected += 1;
            const message = error instanceof Error ? error.message : String(error);
            deleteErrorsAreSafe =
              deleteErrorsAreSafe &&
              !message.includes(gitHubCredential) &&
              !message.includes(gitLabCredential) &&
              !message.includes(`Bearer ${gitHubCredential}`);
          }
        }

        const rendererPayload = JSON.stringify([gitHubResponse, gitLabResponse]);
        return {
          deleteErrorsAreSafe,
          deletedAccountsReject: rejected === accounts.length,
          gitHubCount: gitHubResponse.kind === "changeRequests" ? gitHubResponse.items.length : -1,
          gitLabCount: gitLabResponse.kind === "changeRequests" ? gitLabResponse.items.length : -1,
          rendererResponsesAreSafe:
            !rendererPayload.includes(gitHubCredential) &&
            !rendererPayload.includes(gitLabCredential) &&
            !/"(?:token|authorization)"\s*:/iu.test(rendererPayload),
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
    expect(requests).toHaveLength(7);
    expect(requests.every((request) => request.credentialAccepted)).toBe(true);
    expect(requests.map(({ method, provider }) => ({ method, provider }))).toEqual([
      { method: "GET", provider: "gitHub" },
      { method: "GET", provider: "gitLab" },
      { method: "GET", provider: "gitHub" },
      { method: "GET", provider: "gitLab" },
      { method: "GET", provider: "gitHub" },
      { method: "GET", provider: "gitHub" },
      { method: "GET", provider: "gitLab" },
    ]);
  } finally {
    await firstApp?.close();
    await restoredApp?.close();
    await server?.close();
    await resetHostingProfile();
  }
});
