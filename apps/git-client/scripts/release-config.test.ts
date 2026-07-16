import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const nxConfig = JSON.parse(readFileSync(new URL("../../../nx.json", import.meta.url), "utf8"));

describe("Nx release configuration", () => {
  it("isolates Git Client in a fixed release group", () => {
    const group = nxConfig.release.groups["git-client"];

    expect(group.projects).toEqual(["@jongminchung/git-client"]);
    expect(group.projectsRelationship).toBe("fixed");
    expect(group.releaseTag).toEqual({
      pattern: "git-client-{version}",
      requireSemver: true,
    });
  });

  it("uses file affectedness and the agreed conventional commit bumps", () => {
    expect(nxConfig.release.conventionalCommits).toMatchObject({
      useCommitScope: false,
      types: {
        feat: { semverBump: "minor" },
        fix: { semverBump: "patch" },
        perf: { semverBump: "patch" },
      },
    });
    expect(nxConfig.release.groups["git-client"].version).toMatchObject({
      adjustSemverBumpsForZeroMajorVersion: false,
      currentVersionResolver: "git-tag",
      fallbackCurrentVersionResolver: "disk",
      specifierSource: "conventional-commits",
      versionActionsOptions: { skipLockFileUpdate: true },
    });
  });

  it("avoids broad lockfile invalidation and Nx git mutations", () => {
    expect(nxConfig.pluginsConfig["@nx/js"].projectsAffectedByDependencyUpdates).toBe("auto");
    const disabledGitMutations = {
      commit: false,
      push: false,
      stageChanges: false,
      tag: false,
    };
    expect(nxConfig.release.version.git).toEqual(disabledGitMutations);
    expect(nxConfig.release.changelog.git).toEqual(disabledGitMutations);
    expect(nxConfig.release.groups["git-client"].changelog).toMatchObject({
      createRelease: false,
      file: false,
    });
  });
});
