import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createProjectGraphAsync } from "@nx/devkit";
import { ReleaseClient } from "nx/release";
import {
  collectTransitiveWorkspaceDependencies,
  createDependencyAwareChangelogRenderer,
} from "./nx-changelog-renderer.mjs";
import { captureCommand, executeCommand } from "./process.mjs";
import { buildRelease, createReleaseArtifactNames, parseReleaseVersion } from "./release.mjs";

export const gitClientProject = "@jongminchung/git-client";
export const gitClientReleaseGroup = "git-client";
export const githubRepository = "jongminchung/jongminchung";
export const initialReleaseVersion = "1.0.0";

const stableReleaseTagPattern = /^git-client-(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const appRoot = fileURLToPath(new URL("../", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));

export function createReleaseTag(value) {
  return `git-client-${parseReleaseVersion(value)}`;
}

export function createReleaseTitle(value) {
  return `Git Client ${parseReleaseVersion(value)}`;
}

export function createInitialReleaseNotes() {
  return `# ${initialReleaseVersion}\n\nInitial Git Client release.\n`;
}

export function hasStableReleaseTag(tags) {
  return tags.some((tag) => stableReleaseTagPattern.test(tag));
}

export function findLatestStableReleaseTag(tags) {
  return tags
    .filter((tag) => stableReleaseTagPattern.test(tag))
    .sort((left, right) => {
      const leftVersion = left.replace("git-client-", "").split(".").map(Number);
      const rightVersion = right.replace("git-client-", "").split(".").map(Number);
      for (let index = 0; index < leftVersion.length; index += 1) {
        if (leftVersion[index] !== rightVersion[index]) {
          return rightVersion[index] - leftVersion[index];
        }
      }
      return 0;
    })[0];
}

export function createVersionOptions(tags, verbose = false) {
  const firstRelease = !hasStableReleaseTag(tags);
  return {
    dryRun: true,
    firstRelease,
    groups: [gitClientReleaseGroup],
    specifier: firstRelease ? initialReleaseVersion : undefined,
    verbose,
  };
}

export function createGitHubEnvironment(environment) {
  const token = environment.GH_TOKEN ?? environment.GH_PAT;
  if (!token) throw new Error("Set GH_TOKEN in CI or GH_PAT for a local GitHub release");
  return { ...environment, GH_TOKEN: token };
}

export function createGhReleaseArguments({ artifacts, notesFile, sha, version }) {
  return [
    "release",
    "create",
    createReleaseTag(version),
    artifacts.dmg,
    artifacts.checksum,
    "--repo",
    githubRepository,
    "--target",
    sha,
    "--title",
    createReleaseTitle(version),
    "--notes-file",
    notesFile,
    "--draft",
  ];
}

export function createGhTagReferenceArguments(tag) {
  return ["api", `repos/${githubRepository}/git/ref/tags/${tag}`, "--jq", ".object.sha"];
}

export function createGhDeleteTagArguments(tag) {
  return ["api", "--method", "DELETE", `repos/${githubRepository}/git/refs/tags/${tag}`];
}

export function parseReleaseMetadata(value) {
  const parsed = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected GitHub release metadata to be an object");
  }
  if (
    typeof parsed.isDraft !== "boolean" ||
    typeof parsed.isPrerelease !== "boolean" ||
    typeof parsed.name !== "string" ||
    typeof parsed.tagName !== "string" ||
    !Array.isArray(parsed.assets)
  ) {
    throw new Error("GitHub release metadata is missing required fields");
  }
  const assets = parsed.assets.map((asset) => {
    if (typeof asset !== "object" || asset === null || typeof asset.name !== "string") {
      throw new Error("GitHub release metadata contains an invalid asset");
    }
    return asset.name;
  });
  return {
    assets,
    isDraft: parsed.isDraft,
    isPrerelease: parsed.isPrerelease,
    name: parsed.name,
    tagName: parsed.tagName,
  };
}

export function assertReleaseMetadata(metadata, version, expectedDraft) {
  const names = createReleaseArtifactNames(version);
  const expectedAssets = [names.checksum, names.dmg].sort((left, right) =>
    left.localeCompare(right),
  );
  const actualAssets = [...metadata.assets].sort((left, right) => left.localeCompare(right));
  if (metadata.tagName !== createReleaseTag(version)) {
    throw new Error(`Unexpected release tag: ${metadata.tagName}`);
  }
  if (metadata.name !== createReleaseTitle(version)) {
    throw new Error(`Unexpected release title: ${metadata.name}`);
  }
  if (metadata.isDraft !== expectedDraft || metadata.isPrerelease) {
    throw new Error("Unexpected GitHub release publication state");
  }
  if (JSON.stringify(actualAssets) !== JSON.stringify(expectedAssets)) {
    throw new Error(`Unexpected release assets: ${actualAssets.join(", ")}`);
  }
}

async function listReleaseTags() {
  const output = await captureCommand("git", ["tag", "--list", "git-client-*"], {
    cwd: workspaceRoot,
  });
  return output === "" ? [] : output.split("\n");
}

async function calculateRelease(verbose) {
  const tags = await listReleaseTags();
  const versionOptions = createVersionOptions(tags, verbose);
  const projectGraph = await createProjectGraphAsync();
  const includedProjects = collectTransitiveWorkspaceDependencies(projectGraph, gitClientProject);
  const renderer = createDependencyAwareChangelogRenderer({
    includedProjects,
    projectName: gitClientProject,
    workspaceRoot,
  });
  const releaseClient = new ReleaseClient({
    groups: {
      [gitClientReleaseGroup]: {
        changelog: {
          file: "{projectRoot}/release-artifacts/release-notes.md",
          renderer,
        },
        projects: [gitClientProject],
      },
    },
  });
  const { projectsVersionData, releaseGraph } = await releaseClient.releaseVersion(versionOptions);
  const versionData = projectsVersionData[gitClientProject];
  if (!versionData) throw new Error(`Nx did not return version data for ${gitClientProject}`);
  if (versionData.newVersion === null) return null;
  if (versionOptions.firstRelease) {
    return {
      notes: createInitialReleaseNotes(),
      version: initialReleaseVersion,
    };
  }

  const changelogResult = await releaseClient.releaseChangelog({
    dryRun: true,
    firstRelease: false,
    from: findLatestStableReleaseTag(tags),
    groups: [gitClientReleaseGroup],
    releaseGraph,
    verbose,
    versionData: projectsVersionData,
  });
  const changelog = changelogResult.projectChangelogs?.[gitClientProject];
  if (!changelog) throw new Error(`Nx did not return a changelog for ${gitClientProject}`);

  return {
    notes: changelog.contents,
    version: parseReleaseVersion(versionData.newVersion),
  };
}

async function readReleaseMetadata(tag, environment, allowFailure = false) {
  const result = await executeCommand(
    "gh",
    [
      "release",
      "view",
      tag,
      "--repo",
      githubRepository,
      "--json",
      "assets,isDraft,isPrerelease,name,tagName",
    ],
    { allowFailure, capture: true, cwd: workspaceRoot, env: environment },
  );
  if (result.code !== 0) return null;
  return parseReleaseMetadata(result.stdout);
}

async function removeDraftRelease(tag, environment) {
  const metadata = await readReleaseMetadata(tag, environment, true);
  if (metadata?.isDraft !== true) return;
  await executeCommand(
    "gh",
    ["release", "delete", tag, "--repo", githubRepository, "--cleanup-tag", "--yes"],
    { cwd: workspaceRoot, env: environment },
  );
}

async function readRemoteTagSha(tag, environment) {
  const result = await executeCommand("gh", createGhTagReferenceArguments(tag), {
    allowFailure: true,
    capture: true,
    cwd: workspaceRoot,
    env: environment,
  });
  if (result.code !== 0) return null;
  const sha = result.stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(`Unexpected GitHub tag object SHA: ${sha}`);
  }
  return sha;
}

async function removeTagCreatedByCurrentRun(tag, sha, environment) {
  if ((await readRemoteTagSha(tag, environment)) !== sha) return;
  await executeCommand("gh", createGhDeleteTagArguments(tag), {
    cwd: workspaceRoot,
    env: environment,
  });
}

async function publishRelease(release) {
  const environment = createGitHubEnvironment(process.env);
  const tag = createReleaseTag(release.version);
  if ((await readReleaseMetadata(tag, environment, true)) !== null) {
    throw new Error(`GitHub release already exists: ${tag}`);
  }

  const sha = await captureCommand("git", ["rev-parse", "HEAD"], { cwd: workspaceRoot });
  if ((await readRemoteTagSha(tag, environment)) !== null) {
    throw new Error(`GitHub tag already exists: ${tag}`);
  }
  const artifacts = await buildRelease(release.version);
  const notesFile = join(appRoot, "release-artifacts", "release-notes.md");
  await writeFile(notesFile, release.notes);

  let mayHaveCreatedDraft = false;
  try {
    mayHaveCreatedDraft = true;
    await executeCommand(
      "gh",
      createGhReleaseArguments({ artifacts, notesFile, sha, version: release.version }),
      { cwd: workspaceRoot, env: environment },
    );
    const draft = await readReleaseMetadata(tag, environment);
    if (!draft) throw new Error(`GitHub draft release was not created: ${tag}`);
    assertReleaseMetadata(draft, release.version, true);

    await executeCommand(
      "gh",
      ["release", "edit", tag, "--repo", githubRepository, "--draft=false"],
      { cwd: workspaceRoot, env: environment },
    );
    mayHaveCreatedDraft = false;
    const published = await readReleaseMetadata(tag, environment);
    if (!published) throw new Error(`GitHub release was not published: ${tag}`);
    assertReleaseMetadata(published, release.version, false);
  } catch (error) {
    if (mayHaveCreatedDraft) {
      try {
        await removeDraftRelease(tag, environment);
        await removeTagCreatedByCurrentRun(tag, sha, environment);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          `Release failed and cleanup was incomplete for ${tag}`,
        );
      }
    }
    throw error;
  }
}

export function parsePublishArguments(arguments_) {
  const unknown = arguments_.filter(
    (argument) => argument !== "--dry-run" && argument !== "--verbose",
  );
  if (unknown.length > 0) throw new Error(`Unknown release argument: ${unknown[0]}`);
  return {
    dryRun: arguments_.includes("--dry-run"),
    verbose: arguments_.includes("--verbose"),
  };
}

async function main() {
  const options = parsePublishArguments(process.argv.slice(2));
  const release = await calculateRelease(options.verbose);
  if (!release) {
    console.log("No releasable Git Client changes were detected.");
    return;
  }
  console.log(`Next Git Client release: ${release.version}`);
  if (options.dryRun) {
    console.log(release.notes);
    return;
  }
  await publishRelease(release);
}

const entryPoint = process.argv[1];
if (entryPoint && resolve(entryPoint) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
