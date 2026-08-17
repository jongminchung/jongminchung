import { describe, expect, it } from "vitest";
import {
    homeRelativePath,
    parseRecentProjects,
    updateRecentProjects,
} from "./recentProjects";

describe("최근 프로젝트", () => {
    it("[실패] 레거시 경로를 마이그레이션하고 단독으로 사용함", () => {
        expect(
            parseRecentProjects(["/tmp/one", "/tmp/one", "/tmp/two"]),
        ).toEqual([
            { path: "/tmp/one", name: "one", branch: null, lastOpenedAt: 3 },
            { path: "/tmp/two", name: "two", branch: null, lastOpenedAt: 1 },
        ]);
    });

    it("[성공] 최신 업데이트 데이터를 향후 이동함", () => {
        expect(
            updateRecentProjects(
                [
                    {
                        path: "/tmp/one",
                        name: "one",
                        branch: null,
                        lastOpenedAt: 1,
                    },
                ],
                {
                    path: "/tmp/two",
                    name: "two",
                    branch: "main",
                    lastOpenedAt: 2,
                },
            ).map((entry) => entry.path),
        ).toEqual(["/tmp/two", "/tmp/one"]);
    });

    it("[성공] 사용자 홈 아래의 경로를 단축함", () => {
        expect(homeRelativePath("/Users/test/work/repo", "/Users/test")).toBe(
            "~/work/repo",
        );
    });
});
