import { describe, expect, it } from "vitest";
import { createInitialWorkspaceState } from "./createInitialWorkspaceState";

describe("createInitialWorkspaceState", () => {
    it("creates an isolated welcome state from injected runtime policy", () => {
        const recentProjects = [
            {
                path: "/tmp/repository",
                name: "Repository",
                branch: "main",
                lastOpenedAt: 1,
            },
        ];

        const state = createInitialWorkspaceState({
            recentProjects,
            restoring: false,
        });

        expect(state).toEqual({
            sessions: [],
            activeTab: { kind: "welcome" },
            recentProjects,
            restoring: false,
            error: null,
        });
        expect(state.recentProjects).toBe(recentProjects);
    });
});
