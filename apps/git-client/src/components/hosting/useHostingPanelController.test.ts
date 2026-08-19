import { describe, expect, it } from "vitest";
import {
    HostingInspectionSequence,
    inferRemoteCoordinates,
} from "./useHostingPanelController";

describe("hosting remote 좌표", () => {
    it.each([
        [
            "https://github.com/openai/codex.git",
            {
                baseUrl: "https://github.com",
                project: "openai/codex",
                provider: "gitHub",
            },
        ],
        [
            "git@gitlab.example.com:team/project.git",
            {
                baseUrl: "https://gitlab.example.com",
                project: "team/project",
                provider: "gitLab",
            },
        ],
    ])("[성공] %s에서 provider와 project를 추론함", (remote, expected) => {
        expect(inferRemoteCoordinates(remote)).toEqual(expected);
    });

    it("[실패] host 또는 project가 없는 remote를 거부함", () => {
        expect(inferRemoteCoordinates()).toBeUndefined();
        expect(inferRemoteCoordinates("not-a-remote")).toBeUndefined();
        expect(inferRemoteCoordinates("https://github.com")).toBeUndefined();
    });
});

describe("Hosting 상세 선택 sequence", () => {
    it("[경계] 늦게 도착한 이전 선택과 account 전환 응답을 폐기함", () => {
        const guard = new HostingInspectionSequence();
        const firstSelection = guard.begin();
        const secondSelection = guard.begin();

        expect(guard.isCurrent(firstSelection)).toBe(false);
        expect(guard.isCurrent(secondSelection)).toBe(true);

        guard.invalidate();
        expect(guard.isCurrent(secondSelection)).toBe(false);
    });
});
