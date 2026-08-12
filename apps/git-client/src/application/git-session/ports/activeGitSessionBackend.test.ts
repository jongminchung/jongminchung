import { describe, expect, it } from "vitest";
import type { WorkspaceState } from "../state/GitSessionState";
import {
    getGitSessionBackend,
    installGitSessionBackend,
} from "./activeGitSessionBackend";
import type { GitSessionBackend } from "./GitSessionBackend";

function backend(kind: "live" | "fixture"): GitSessionBackend<WorkspaceState> {
    return { kind } as unknown as GitSessionBackend<WorkspaceState>;
}

describe("active Git session backend", () => {
    it("installs and restores nested backend scopes", () => {
        expect(() => getGitSessionBackend()).toThrow(
            "Git session backend was not installed",
        );
        const live = backend("live");
        const fixture = backend("fixture");
        const uninstallLive = installGitSessionBackend(live);
        const uninstallFixture = installGitSessionBackend(fixture);

        expect(getGitSessionBackend()).toBe(fixture);
        uninstallFixture();
        expect(getGitSessionBackend()).toBe(live);
        uninstallLive();
        expect(() => getGitSessionBackend()).toThrow(
            "Git session backend was not installed",
        );
    });
});
