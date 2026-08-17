import { describe, expect, it } from "vitest";
import {
    GitRequestCancelledError,
    isGitRequestCancelled,
    isRetryableOperation,
    operationActivityLabel,
    sanitizeGitError,
} from "./gitActivity";

describe("힘내 활동", () => {
    it("[성공] 안전 사용자 대상 활동 라벨을 사용함", () => {
        expect(
            operationActivityLabel({
                kind: "fetch",
                remote: "origin",
                prune: false,
            }),
        ).toBe("Fetching");
        expect(
            operationActivityLabel({
                kind: "setConfig",
                key: "credential.helper",
                value: "secret",
            }),
        ).toBe("Updating Git config");
    });

    it("[성공] 멱등성 가져오기 작업에 대해서만 재시도를 소유함", () => {
        expect(
            isRetryableOperation({ kind: "fetch", remote: null, prune: false }),
        ).toBe(true);
        expect(isRetryableOperation({ kind: "pull", rebase: false })).toBe(
            false,
        );
    });

    it("[성공] 오류로부터 자격 증명 및 제어 문자를 변경함", () => {
        const sanitized = sanitizeGitError(
            "fatal:\u0000 https://user:password@github.com/org/repo token=ghp_secret glpat-private",
        );
        expect(sanitized).toBe(
            "fatal: https://[redacted]@github.com/org/repo token=[redacted] [redacted]",
        );
        expect(sanitized).not.toContain("password");
        expect(sanitized).not.toContain("secret");
    });

    it("[성공] 취소와 일반적인 실패를 거부함", () => {
        expect(isGitRequestCancelled(new GitRequestCancelledError())).toBe(
            true,
        );
        expect(isGitRequestCancelled(new Error("failed"))).toBe(false);
    });
});
