import { describe, expect, it } from "vitest";
import type { GitRequest, RequestId } from "../shared/contracts/model/index";
import { describeGitRequest, recordGitConsoleEvent } from "./gitConsole";

const request: GitRequest = { kind: "status", repositoryId: "repository-1" };
const requestId = "request-1" as RequestId;

describe("힘내 콘솔", () => {
    it("[성공] 탐지 가능하고 유용한 키보드 설명을 사용함", () => {
        expect(describeGitRequest(request)).toBe(
            "git status --porcelain=v2 --branch -z",
        );
        expect(
            describeGitRequest({
                kind: "operation",
                repositoryId: "repository-1",
                operation: { kind: "fetch", remote: "origin", prune: true },
            }),
        ).toBe("git fetch  # Fetching");
    });

    it("[성공] 계속해서 살아남고 기록하고 자격을 증명함", () => {
        let entries = recordGitConsoleEvent(
            [],
            request,
            {
                kind: "started",
                requestId,
                displayCommand: "git status --porcelain=v2",
                startedAtMs: 10,
            },
            10,
        );
        entries = recordGitConsoleEvent(
            entries,
            request,
            {
                kind: "output",
                requestId,
                sequence: 0,
                stream: "stderr",
                data: "https://user:secret@example.test/repo token=ghp_private\n",
            },
            11,
        );
        entries = recordGitConsoleEvent(
            entries,
            request,
            {
                kind: "completed",
                requestId,
                exitCode: 0,
                durationMs: 2,
            },
            12,
        );

        expect(entries).toEqual([
            expect.objectContaining({
                requestId,
                status: "completed",
                startedAt: 10,
                completedAt: 12,
            }),
        ]);
        expect(entries[0]?.output).toContain(
            "https://[redacted]@example.test/repo",
        );
        expect(entries[0]?.output).not.toContain("secret");
        expect(entries[0]?.output).not.toContain("ghp_private");
    });

    it("[성공] 실패 및 취소를 최종 상태로 기록함", () => {
        const failed = recordGitConsoleEvent(
            [],
            request,
            {
                kind: "failed",
                requestId,
                message: "fatal: denied",
                exitCode: 1,
                durationMs: 10,
            },
            20,
        );
        const cancelled = recordGitConsoleEvent(
            [],
            request,
            {
                kind: "cancelled",
                requestId,
                durationMs: 10,
            },
            30,
        );

        expect(failed[0]).toMatchObject({
            status: "failed",
            output: "fatal: denied",
        });
        expect(cancelled[0]).toMatchObject({
            status: "cancelled",
            completedAt: 30,
        });
    });
});
