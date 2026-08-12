import assert from "node:assert/strict";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import {
    ELECTRON_LOCALE_ALLOWLIST,
    electronFrameworkResourcesPath,
    pruneElectronLocales,
} from "./electron-package-policy.mjs";

const testRoots = [];

async function makeBuildRoot() {
    const root = await mkdtemp(join(tmpdir(), "git-client-electron-locales-"));
    testRoots.push(root);
    const resourcesPath = electronFrameworkResourcesPath(root);
    await mkdir(resourcesPath, { recursive: true });
    for (const locale of ELECTRON_LOCALE_ALLOWLIST) {
        await mkdir(join(resourcesPath, locale));
    }
    return { root, resourcesPath };
}

after(async () => {
    const { rm } = await import("node:fs/promises");
    for (const root of testRoots) {
        await rm(root, { recursive: true, force: true });
    }
});

void describe("Electron locale package policy", () => {
    beforeEach(() => {
        assert.equal(new Set(ELECTRON_LOCALE_ALLOWLIST).size, 24);
    });

    void it("keeps the exact supported locale variants and removes other locale directories", async () => {
        const fixture = await makeBuildRoot();
        await mkdir(join(fixture.resourcesPath, "de.lproj"));
        await mkdir(join(fixture.resourcesPath, "fr_FEMININE.lproj"));
        await writeFile(
            join(fixture.resourcesPath, "not-a-locale.txt"),
            "preserved",
        );

        const result = await pruneElectronLocales({
            buildPath: fixture.root,
            platform: "darwin",
        });

        assert.equal(result.skipped, false);
        assert.deepEqual(result.removed, ["de.lproj", "fr_FEMININE.lproj"]);
        assert.deepEqual(
            result.kept,
            [...ELECTRON_LOCALE_ALLOWLIST].sort((a, b) => a.localeCompare(b)),
        );
    });

    void it("fails closed when Electron no longer contains every pinned locale", async () => {
        const fixture = await makeBuildRoot();
        const { rm } = await import("node:fs/promises");
        await rm(join(fixture.resourcesPath, "ko.lproj"), { recursive: true });

        await assert.rejects(
            pruneElectronLocales({
                buildPath: fixture.root,
                platform: "darwin",
            }),
            /allowlist is incomplete: ko\.lproj/,
        );
    });

    void it("refuses locale symlinks without modifying their target", async () => {
        const fixture = await makeBuildRoot();
        const outsidePath = join(fixture.root, "outside");
        await mkdir(outsidePath);
        await writeFile(join(outsidePath, "marker"), "still-here");
        await symlink(outsidePath, join(fixture.resourcesPath, "de.lproj"));

        await assert.rejects(
            pruneElectronLocales({
                buildPath: fixture.root,
                platform: "darwin",
            }),
            /Refusing to modify non-directory Electron locale: de\.lproj/,
        );

        const { readFile } = await import("node:fs/promises");
        assert.equal(
            await readFile(join(outsidePath, "marker"), "utf8"),
            "still-here",
        );
    });

    void it("does not inspect or modify builds for other platforms", async () => {
        const result = await pruneElectronLocales({
            buildPath: "/does/not/exist",
            platform: "linux",
        });
        assert.deepEqual(result, { skipped: true, removed: [], kept: [] });
    });
});
