import { describe, expect, it, vi } from "vitest";
import { sampleRepository } from "../../domain/sampleData";
import type { PushPreview } from "../../shared/contracts/model/index";
import { createGitSessionBackend } from "./createGitSessionBackend";

const request = {
    snapshot: sampleRepository.snapshot,
    remote: null,
    remoteRef: null,
    localRevision: "HEAD",
};

const livePreview = {
    sourceBranch: null,
    sourceRevision: "HEAD",
    localOid: "0".repeat(40),
    remote: "origin",
    remoteRef: "refs/heads/main",
    upstreamConfigured: false,
    setUpstreamDefault: true,
    remoteOid: null,
    expectedLeaseOid: null,
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
} satisfies PushPreview;

describe.each([
    ["live", false],
    ["fixture", true],
] as const)("[성공] %s Git 세션 백엔드계약", (kind, fixtureMode) => {
    it("[성공] 별자리를 구현함", async () => {
        const backend = createGitSessionBackend(fixtureMode);
        const workspace = await backend.repository.initialWorkspace();
        const refresh = vi.fn(async () => undefined);
        const watch = vi.fn(async () => undefined);

        await backend.repository.refresh(refresh);
        await backend.repository.watch(watch);

        expect(backend.kind).toBe(kind);
        expect(backend.fixtureMode).toBe(fixtureMode);
        expect(refresh).toHaveBeenCalledTimes(fixtureMode ? 0 : 1);
        expect(watch).toHaveBeenCalledTimes(fixtureMode ? 0 : 1);
        expect(workspace?.activeTab.kind ?? "welcome").toBe(
            fixtureMode ? "repository" : "welcome",
        );
    });

    it("[성공] 쿼리 포트 구현", async () => {
        const backend = createGitSessionBackend(fixtureMode);
        const live = vi.fn(async () => "live");
        const fixture = vi.fn(async () => "fixture");

        await expect(backend.queries.diff(live, fixture)).resolves.toBe(
            fixtureMode ? "fixture" : "live",
        );
        expect(live).toHaveBeenCalledTimes(fixtureMode ? 0 : 1);
        expect(fixture).toHaveBeenCalledTimes(fixtureMode ? 1 : 0);
    });

    it("[성공] 돌연변이 포트를 구현함", async () => {
        const backend = createGitSessionBackend(fixtureMode);
        const operation = vi.fn(async () => undefined);

        await backend.mutations.execute(operation);

        expect(backend.mutations.enabled).toBe(!fixtureMode);
        expect(operation).toHaveBeenCalledTimes(fixtureMode ? 0 : 1);
    });

    it("[성공] 히스토리 포트를 구현함", async () => {
        const backend = createGitSessionBackend(fixtureMode);
        const live = vi.fn(async () => livePreview);

        const preview = await backend.history.loadPushPreview(request, live);

        expect(preview.remote).toBe("origin");
        expect(live).toHaveBeenCalledTimes(fixtureMode ? 0 : 1);
    });

    it("[성공] 어댑터의 서버 가용성을 게시함", () => {
        const backend = createGitSessionBackend(fixtureMode, {
            electronRuntime: true,
        });

        expect(backend.terminal.kind).toBe(
            fixtureMode ? "unavailable" : "available",
        );
    });

    it("[성공] 예외 쿼리 어댑터를 통해 요청을 실행함", async () => {
        const backend = createGitSessionBackend(fixtureMode);
        const live = vi.fn(async () => "live output");

        const output = await backend.queries.executeRequest("status", live);

        expect(live).toHaveBeenCalledTimes(fixtureMode ? 0 : 1);
        expect(output).toBe(fixtureMode ? "" : "live output");
    });
});

describe("Git 세션 작업을 수행하는 기능이 있음", () => {
    it("[성공] 기본 복원과 파티션 브라우저를 유지하고 유지함", async () => {
        const backend = createGitSessionBackend(false, {
            workspacePersistence: false,
        });
        const restore = vi.fn(async () => undefined);
        const persist = vi.fn(async () => undefined);

        await backend.repository.restore(restore);
        await backend.repository.persist(persist);

        expect(restore).not.toHaveBeenCalled();
        expect(persist).not.toHaveBeenCalled();
    });

    it("[성공] 예외에서 기본 터미널을 사용할 수 있도록 유지함", () => {
        const backend = createGitSessionBackend(false, {
            electronRuntime: false,
        });

        expect(backend.terminal.kind).toBe("unavailable");
    });
});
