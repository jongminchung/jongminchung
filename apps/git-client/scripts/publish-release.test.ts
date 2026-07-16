import { describe, expect, it } from "vitest";
import {
  assertReleaseMetadata,
  createGhDeleteTagArguments,
  createGhReleaseArguments,
  createGhTagReferenceArguments,
  createGitHubEnvironment,
  createInitialReleaseNotes,
  createReleaseTag,
  createReleaseTitle,
  createVersionOptions,
  findLatestStableReleaseTag,
  parsePublishArguments,
  parseReleaseMetadata,
} from "./publish-release.mjs";

describe("Nx Git Client release publisher", () => {
  it("forces the first release to 1.0.0 and later releases to conventional commits", () => {
    expect(createVersionOptions([])).toEqual({
      dryRun: true,
      firstRelease: true,
      groups: ["git-client"],
      specifier: "1.0.0",
      verbose: false,
    });
    expect(createVersionOptions(["git-client-1.0.0"], true)).toEqual({
      dryRun: true,
      firstRelease: false,
      groups: ["git-client"],
      specifier: undefined,
      verbose: true,
    });
    expect(createInitialReleaseNotes()).toBe("# 1.0.0\n\nInitial Git Client release.\n");
    expect(
      findLatestStableReleaseTag(["git-client-1.2.0", "git-client-2.0.0", "git-client-1.10.0"]),
    ).toBe("git-client-2.0.0");
  });

  it("uses the agreed tag, title, and draft creation arguments", () => {
    expect(createReleaseTag("1.2.3")).toBe("git-client-1.2.3");
    expect(createReleaseTitle("1.2.3")).toBe("Git Client 1.2.3");
    expect(
      createGhReleaseArguments({
        artifacts: { checksum: "/tmp/app.dmg.sha256", dmg: "/tmp/app.dmg" },
        notesFile: "/tmp/notes.md",
        sha: "abc123",
        version: "1.2.3",
      }),
    ).toEqual([
      "release",
      "create",
      "git-client-1.2.3",
      "/tmp/app.dmg",
      "/tmp/app.dmg.sha256",
      "--repo",
      "jongminchung/jongminchung",
      "--target",
      "abc123",
      "--title",
      "Git Client 1.2.3",
      "--notes-file",
      "/tmp/notes.md",
      "--draft",
    ]);
    expect(createGhTagReferenceArguments("git-client-1.2.3")).toEqual([
      "api",
      "repos/jongminchung/jongminchung/git/ref/tags/git-client-1.2.3",
      "--jq",
      ".object.sha",
    ]);
    expect(createGhDeleteTagArguments("git-client-1.2.3")).toEqual([
      "api",
      "--method",
      "DELETE",
      "repos/jongminchung/jongminchung/git/refs/tags/git-client-1.2.3",
    ]);
  });

  it("maps a local GH_PAT to the GH_TOKEN used by child processes", () => {
    expect(createGitHubEnvironment({ GH_PAT: "local-token" })).toMatchObject({
      GH_PAT: "local-token",
      GH_TOKEN: "local-token",
    });
    expect(createGitHubEnvironment({ GH_PAT: "local", GH_TOKEN: "ci" }).GH_TOKEN).toBe("ci");
    expect(() => createGitHubEnvironment({})).toThrow("GH_TOKEN");
  });

  it("validates GitHub release metadata before publication", () => {
    const metadata = parseReleaseMetadata(
      JSON.stringify({
        assets: [
          { name: "Git-Client_1.2.3_macos_aarch64.dmg" },
          { name: "Git-Client_1.2.3_macos_aarch64.dmg.sha256" },
        ],
        isDraft: true,
        isPrerelease: false,
        name: "Git Client 1.2.3",
        tagName: "git-client-1.2.3",
      }),
    );

    expect(() => assertReleaseMetadata(metadata, "1.2.3", true)).not.toThrow();
    expect(() => assertReleaseMetadata(metadata, "1.2.3", false)).toThrow("publication state");
    expect(() => parseReleaseMetadata("[]")).toThrow("object");
  });

  it("accepts only dry-run and verbose publisher flags", () => {
    expect(parsePublishArguments(["--dry-run", "--verbose"])).toEqual({
      dryRun: true,
      verbose: true,
    });
    expect(() => parsePublishArguments(["1.2.3"])).toThrow("Unknown release argument");
  });
});
