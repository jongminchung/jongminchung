import { describe, expect, it } from "vitest";
import type {
    HostingAccount,
    HostingChangeRequest,
    HostingProviderKind,
    HostingRequest,
    HostingResponse,
} from "../shared/contracts/model/index";
import {
    ElectronHostingBridge,
    ElectronHostingBridgeError,
    type ElectronHostingApi,
} from "./ElectronHostingBridge";

const ACCOUNT: HostingAccount = {
    id: "account-1",
    provider: "gitHub",
    baseUrl: "https://github.com",
    login: "octocat",
};

const CHANGE_REQUEST: HostingChangeRequest = {
    number: 7,
    title: "Ship",
    state: "open",
    author: "octocat",
    sourceBranch: "feature",
    targetBranch: "main",
    webUrl: "https://github.com/acme/repo/pull/7",
    nodeId: "PR_kwDOExample",
    draft: false,
    updatedAt: "2026-01-01T00:00:00Z",
};

interface SavedAccountCall {
    readonly provider: HostingProviderKind;
    readonly baseUrl: string;
    readonly token: string;
}

interface ExecuteCall {
    readonly accountId: string;
    readonly request: HostingRequest;
}

class FakeElectronHostingApi implements ElectronHostingApi {
    readonly saved: SavedAccountCall[] = [];
    readonly restored: HostingAccount[][] = [];
    readonly deleted: string[] = [];
    readonly executions: ExecuteCall[] = [];
    saveResult: unknown = ACCOUNT;
    readonly executeResults: unknown[] = [];
    restoreError: unknown = null;
    deleteError: unknown = null;

    async saveAccount(
        provider: HostingProviderKind,
        baseUrl: string,
        token: string,
    ): Promise<HostingAccount> {
        this.saved.push({ provider, baseUrl, token });
        if (this.saveResult instanceof Error) throw this.saveResult;
        return this.saveResult as HostingAccount;
    }

    async restoreAccounts(accounts: readonly HostingAccount[]): Promise<void> {
        if (this.restoreError !== null) throw this.restoreError;
        this.restored.push(accounts.map((account) => ({ ...account })));
    }

    async deleteAccount(accountId: string): Promise<void> {
        if (this.deleteError !== null) throw this.deleteError;
        this.deleted.push(accountId);
    }

    async execute(
        accountId: string,
        request: HostingRequest,
    ): Promise<HostingResponse> {
        this.executions.push({ accountId, request });
        const result = this.executeResults.shift();
        if (result === undefined)
            throw new Error("Fake hosting response is missing");
        if (result instanceof Error) throw result;
        return result as HostingResponse;
    }
}

interface PendingExecution {
    readonly accountId: string;
    readonly request: HostingRequest;
    readonly resolve: (response: HostingResponse) => void;
}

class DeferredElectronHostingApi extends FakeElectronHostingApi {
    readonly pending: PendingExecution[] = [];

    override execute(
        accountId: string,
        request: HostingRequest,
    ): Promise<HostingResponse> {
        this.executions.push({ accountId, request });
        return new Promise((resolve) => {
            this.pending.push({ accountId, request, resolve });
        });
    }
}

function responseFor(request: HostingRequest): HostingResponse {
    switch (request.kind) {
        case "list":
            return {
                kind: "changeRequests",
                items: [CHANGE_REQUEST],
                nextPage: null,
            };
        case "get":
        case "create":
            return { kind: "changeRequest", item: CHANGE_REQUEST };
        case "files":
            return {
                kind: "files",
                items: [
                    {
                        path: "src/new.ts",
                        previousPath: null,
                        status: "added",
                        additions: 3,
                        deletions: 0,
                        patch: "@@ patch",
                    },
                ],
            };
        case "timeline":
            return {
                kind: "timeline",
                items: [
                    {
                        id: "event-1",
                        kind: "comment",
                        author: "octocat",
                        body: "Looks good",
                        createdAt: "2026-01-02T00:00:00Z",
                    },
                ],
            };
        case "viewedFiles":
            return { kind: "viewedFiles", paths: ["src/new.ts"] };
        case "setViewed":
            return { kind: "completed", message: "Viewed state updated" };
        case "comment":
        case "review":
        case "updateBranch":
        case "syncFork":
            return { kind: "completed", message: "Completed" };
        case "listNamespaces":
            return {
                kind: "namespaces",
                items: [
                    {
                        id: null,
                        fullName: "Octocat",
                        fullPath: "octocat",
                        personal: true,
                    },
                ],
            };
        case "listShareRepositories":
            return {
                kind: "shareRepositories",
                canCreatePrivate: true,
                names: ["existing"],
            };
        case "checkShareRepository":
            return { kind: "repositoryAvailability", exists: false };
        case "shareRepository":
            return {
                kind: "repository",
                project: "octocat/new-repository",
                webUrl: "https://github.com/octocat/new-repository",
                cloneUrl: "https://github.com/octocat/new-repository.git",
                sshUrl: "git@github.com:octocat/new-repository.git",
            };
    }
}

describe("ElectronHostingBridge 계정 경계", () => {
    it("[실패] 자격 증명을 반환하지 않고 저장된 계정 ID를 인증하고 보증함", async () => {
        const api = new FakeElectronHostingApi();
        api.saveResult = {
            id: "gitlab-account",
            provider: "gitLab",
            baseUrl: "https://gitlab.example.test",
            login: "fox",
        } satisfies HostingAccount;
        const bridge = ElectronHostingBridge.of(api);

        const account = await bridge.saveAccount(
            "gitLab",
            " https://gitlab.example.test/groups/repository ",
            "provider-secret-token",
        );

        expect(api.saved).toEqual([
            {
                provider: "gitLab",
                baseUrl: "https://gitlab.example.test",
                token: "provider-secret-token",
            },
        ]);
        expect(account).toEqual(api.saveResult);
        expect(JSON.stringify(account)).not.toContain("provider-secret-token");
    });

    it("[실패] 형식이 잘못되어 일치하지 않는 로그가 렌더러로 다시 돌아왔기 때문에", async () => {
        const api = new FakeElectronHostingApi();
        const bridge = ElectronHostingBridge.of(api);

        await expect(
            bridge.saveAccount("gitHub", "http://github.com", "secret"),
        ).rejects.toMatchObject({ operation: "saveAccount" });
        expect(api.saved).toEqual([]);

        api.saveResult = { ...ACCOUNT, provider: "gitLab" };
        await expect(
            bridge.saveAccount("gitHub", "https://github.com", "secret"),
        ).rejects.toThrow("identity did not match");

        api.saveResult = { ...ACCOUNT, token: "must-not-cross" };
        await expect(
            bridge.saveAccount("gitHub", "https://github.com", "secret"),
        ).rejects.toThrow("account response is invalid");
    });

    it("[실패] 로그인된 계정을 다시 사용하고 마지막으로 승리를 입력해야 함", async () => {
        const api = new FakeElectronHostingApi();
        const bridge = ElectronHostingBridge.of(api);
        const accounts: HostingAccount[] = [
            { ...ACCOUNT, login: "first" },
            { ...ACCOUNT, login: "last" },
        ];

        await bridge.restoreAccounts(accounts);
        accounts[0] = { ...ACCOUNT, login: "mutated-after-call" };

        expect(api.restored).toEqual([
            [
                { ...ACCOUNT, login: "first" },
                { ...ACCOUNT, login: "last" },
            ],
        ]);
        await expect(
            bridge.restoreAccounts([
                {
                    ...ACCOUNT,
                    token: "credential",
                } as unknown as HostingAccount,
            ]),
        ).rejects.toMatchObject({ operation: "restoreAccounts" });
        expect(api.restored).toHaveLength(1);
    });

    it("[실패]계정 삭제를 멱등성으로 유지하고 모든 하위 명령을 확인함", async () => {
        const api = new FakeElectronHostingApi();
        const bridge = ElectronHostingBridge.of(api);

        await bridge.deleteAccount("account-1");
        await bridge.deleteAccount("account-1");
        await expect(bridge.deleteAccount("")).rejects.toMatchObject({
            operation: "deleteAccount",
        });

        expect(api.deleted).toEqual(["account-1", "account-1"]);
    });
});

describe("ElectronHostingBridge 분야", () => {
    it("[성공] 15가지 HostingRequest 종류를 모두 검증하고 신원을 확인함", async () => {
        const api = new FakeElectronHostingApi();
        const bridge = ElectronHostingBridge.of(api);
        const requests = [
            { kind: "list", project: "acme/repo", page: 1 },
            { kind: "get", project: "acme/repo", number: 7 },
            { kind: "files", project: "acme/repo", number: 7 },
            { kind: "timeline", project: "acme/repo", number: 7 },
            { kind: "viewedFiles", project: "acme/repo", number: 7 },
            {
                kind: "setViewed",
                pullRequestId: "PR_kwDOExample",
                path: "src/new.ts",
                viewed: true,
            },
            {
                kind: "create",
                project: "acme/repo",
                title: "Ship",
                body: "Description",
                sourceBranch: "feature",
                targetBranch: "main",
                draft: true,
            },
            { kind: "comment", project: "acme/repo", number: 7, body: "Hello" },
            {
                kind: "review",
                project: "acme/repo",
                number: 7,
                event: "approve",
                body: "Approved",
            },
            { kind: "updateBranch", project: "acme/repo", number: 7 },
            { kind: "syncFork", project: "acme/repo", branch: "main" },
            { kind: "listNamespaces" },
            { kind: "listShareRepositories" },
            {
                kind: "checkShareRepository",
                namespacePath: "acme/team",
                name: "repo",
            },
            {
                kind: "shareRepository",
                name: "new-repository",
                description: "Description",
                private: true,
                namespaceId: null,
            },
        ] satisfies readonly HostingRequest[];

        expect(requests).toHaveLength(15);
        expect(new Set(requests.map((request) => request.kind)).size).toBe(15);
        for (const request of requests) {
            const response = responseFor(request);
            api.executeResults.push(response);
            await expect(
                bridge.execute("account-1", request),
                request.kind,
            ).resolves.toEqual(response);
        }
        expect(api.executions).toEqual(
            requests.map((request) => ({ accountId: "account-1", request })),
        );
    });

    it("[실패] 잘못된 요청, 잘못된 응답, 다른 요청에 대한 응답 종류를 가지고 있음", async () => {
        const api = new FakeElectronHostingApi();
        const bridge = ElectronHostingBridge.of(api);
        const list: HostingRequest = {
            kind: "list",
            project: "acme/repo",
            page: 1,
        };

        await expect(
            bridge.execute("account-1", {
                ...list,
                extra: true,
            } as unknown as HostingRequest),
        ).rejects.toMatchObject({ operation: "execute" });
        expect(api.executions).toEqual([]);

        api.executeResults.push({ kind: "completed", message: "wrong kind" });
        await expect(bridge.execute("account-1", list)).rejects.toThrow(
            "did not match list",
        );

        api.executeResults.push({
            kind: "changeRequests",
            items: [],
            nextPage: null,
            token: "leak",
        });
        await expect(bridge.execute("account-1", list)).rejects.toThrow(
            "hosting response is invalid",
        );
    });

    it("[실패] 그냥 귀찮게 요청하지 않고 접착제로 유지함", async () => {
        const api = new DeferredElectronHostingApi();
        const bridge = ElectronHostingBridge.of(api);
        const request: HostingRequest = {
            kind: "list",
            project: "acme/repo",
            page: 1,
        };
        const first = bridge.execute("account-1", request);
        const second = bridge.execute("account-1", request);
        expect(api.pending).toHaveLength(2);

        api.pending[1]?.resolve({
            kind: "changeRequests",
            items: [{ ...CHANGE_REQUEST, number: 2 }],
            nextPage: null,
        });
        await expect(second).resolves.toMatchObject({
            kind: "changeRequests",
            items: [{ number: 2 }],
        });
        api.pending[0]?.resolve({
            kind: "changeRequests",
            items: [{ ...CHANGE_REQUEST, number: 1 }],
            nextPage: null,
        });
        await expect(first).resolves.toMatchObject({
            kind: "changeRequests",
            items: [{ number: 1 }],
        });
        expect(api.executions).toHaveLength(2);
    });

    it("[성공] 자격 증명 및 취소됨의 경계심을 지닌 삭제함", async () => {
        const api = new FakeElectronHostingApi();
        const bridge = ElectronHostingBridge.of(api);
        const token = "plain-secret-value";
        api.saveResult = new Error(
            `Authorization: Bearer ${token}; token=${token}; https://alice:password@example.test`,
        );

        const saveError = await bridge
            .saveAccount("gitHub", "https://github.com", token)
            .catch((error: unknown) => error);
        expect(saveError).toBeInstanceOf(ElectronHostingBridgeError);
        expect(String((saveError as Error).message)).toContain("[redacted]");
        expect(String((saveError as Error).message)).not.toContain(token);
        expect(String((saveError as Error).message)).not.toContain("password");

        api.executeResults.push(
            new DOMException(
                "Hosting request aborted; PRIVATE-TOKEN=glpat-provider-secret",
                "AbortError",
            ),
        );
        const executeError = await bridge
            .execute("account-1", {
                kind: "get",
                project: "acme/repo",
                number: 7,
            })
            .catch((error: unknown) => error);
        expect(executeError).toMatchObject({ operation: "execute" });
        expect(String((executeError as Error).message)).toContain("[redacted]");
        expect(String((executeError as Error).message)).not.toContain(
            "glpat-provider-secret",
        );
        expect(Reflect.has(bridge, "cancel")).toBe(false);
    });
});
