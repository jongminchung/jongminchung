import { strict as assert } from "node:assert";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
    resolvePackagedAppPath,
    resolvePackagedExecutablePath,
} from "./packaged-app-path.ts";

await describe("packaged Electron path", async () => {
    await it("derives the Forge output from platform and architecture", async () => {
        assert.equal(
            resolvePackagedAppPath({
                cwd: "/workspace/git-client",
                environment: {},
                platform: "darwin",
                architecture: "x64",
            }),
            join(
                "/workspace/git-client",
                "out",
                "Git Client-darwin-x64",
                "Git Client.app",
            ),
        );
    });

    await it("prefers the explicit package path", async () => {
        assert.equal(
            resolvePackagedExecutablePath({
                cwd: "/workspace/git-client",
                environment: {
                    GIT_CLIENT_ELECTRON_APP_PATH: "artifacts/QA.app",
                },
                platform: "darwin",
                architecture: "arm64",
            }),
            join(
                "/workspace/git-client",
                "artifacts",
                "QA.app",
                "Contents",
                "MacOS",
                "Git Client",
            ),
        );
    });
});
