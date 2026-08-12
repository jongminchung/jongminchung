import { describe, expect, it } from "vitest";
import {
    assertFixedReleaseVersion,
    assertReleaseMetadata,
    createGhDeleteTagArguments,
    createGhReleaseArguments,
    createGhTagReferenceArguments,
    createGitHubEnvironment,
    createReleaseNotes,
    createReleaseTag,
    createReleaseTitle,
    fixedReleaseVersion,
    parsePublishArguments,
    parseReleaseMetadata,
} from "./publish-release.mjs";

describe("fixed Git Client release publisher", () => {
    it("always uses the manual 1.0.0 release identity", () => {
        expect(fixedReleaseVersion).toBe("1.0.0");
        expect(assertFixedReleaseVersion("1.0.0")).toBe("1.0.0");
        expect(() => assertFixedReleaseVersion("1.0.1")).toThrow(
            "must reuse version 1.0.0",
        );
        expect(createReleaseNotes()).toBe(
            "# 1.0.0\n\nManual Git Client release.\n",
        );
    });

    it("uses the agreed tag, title, and draft creation arguments", () => {
        expect(createReleaseTag("1.0.0")).toBe("git-client-1.0.0");
        expect(createReleaseTitle("1.0.0")).toBe("Git Client 1.0.0");
        expect(
            createGhReleaseArguments({
                artifacts: {
                    checksum: "/tmp/app.dmg.sha256",
                    dmg: "/tmp/app.dmg",
                    provenance: "/tmp/app.dmg.provenance.json",
                },
                notesFile: "/tmp/notes.md",
                sha: "abc123",
                version: "1.0.0",
            }),
        ).toEqual([
            "release",
            "create",
            "git-client-1.0.0",
            "/tmp/app.dmg",
            "/tmp/app.dmg.sha256",
            "/tmp/app.dmg.provenance.json",
            "--repo",
            "jongminchung/jongminchung",
            "--target",
            "abc123",
            "--title",
            "Git Client 1.0.0",
            "--notes-file",
            "/tmp/notes.md",
            "--draft",
        ]);
        expect(createGhTagReferenceArguments("git-client-1.0.0")).toEqual([
            "api",
            "repos/jongminchung/jongminchung/git/ref/tags/git-client-1.0.0",
            "--jq",
            ".object.sha",
        ]);
        expect(createGhDeleteTagArguments("git-client-1.0.0")).toEqual([
            "api",
            "--method",
            "DELETE",
            "repos/jongminchung/jongminchung/git/refs/tags/git-client-1.0.0",
        ]);
    });

    it("maps a local GH_PAT to the GH_TOKEN used by child processes", () => {
        expect(
            createGitHubEnvironment({ GH_PAT: "local-token" }),
        ).toMatchObject({
            GH_PAT: "local-token",
            GH_TOKEN: "local-token",
        });
        expect(
            createGitHubEnvironment({ GH_PAT: "local", GH_TOKEN: "ci" })
                .GH_TOKEN,
        ).toBe("ci");
        expect(() => createGitHubEnvironment({})).toThrow("GH_TOKEN");
    });

    it("validates GitHub release metadata before publication", () => {
        const metadata = parseReleaseMetadata(
            JSON.stringify({
                assets: [
                    { name: "Git-Client_1.0.0_macos_arm64.dmg" },
                    { name: "Git-Client_1.0.0_macos_arm64.dmg.sha256" },
                    {
                        name: "Git-Client_1.0.0_macos_arm64.dmg.provenance.json",
                    },
                ],
                isDraft: true,
                isPrerelease: false,
                name: "Git Client 1.0.0",
                tagName: "git-client-1.0.0",
            }),
        );

        expect(() =>
            assertReleaseMetadata(metadata, "1.0.0", true),
        ).not.toThrow();
        expect(() => assertReleaseMetadata(metadata, "1.0.0", false)).toThrow(
            "publication state",
        );
        expect(() => parseReleaseMetadata("[]")).toThrow("object");
    });

    it("accepts only the dry-run publisher flag", () => {
        expect(parsePublishArguments(["--dry-run"])).toEqual({
            dryRun: true,
        });
        expect(() => parsePublishArguments(["--verbose"])).toThrow(
            "Unknown release argument",
        );
        expect(() => parsePublishArguments(["1.2.3"])).toThrow(
            "Unknown release argument",
        );
    });
});
