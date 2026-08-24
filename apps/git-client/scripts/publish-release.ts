// oxlint-disable typescript/no-explicit-any -- Native TypeScript entry points retain dynamic process, fixture, and injected test-double boundaries.
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { executeCommand } from "./process.ts";
import {
  buildRelease,
  createReleaseArtifactNames,
  parseReleaseVersion,
  verifyReleaseSource,
} from "./release.ts";

export const githubRepository = "jongminchung/jongminchung";
const appRoot = fileURLToPath(new URL("../", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));

export function createReleaseTag(value: any) {
  return `git-client-${parseReleaseVersion(value)}`;
}

export function createReleaseTitle(value: any) {
  return `Git Client ${parseReleaseVersion(value)}`;
}

export function createReleaseNotes(value: any) {
  const version = parseReleaseVersion(value);
  return `# ${version}\n\nManual Git Client release.\n`;
}

export function assertMonotonicReleaseVersion(value: any, tags: any) {
  const version = parseReleaseVersion(value);
  const requested = version.split(".").map(Number);
  for (const tag of tags) {
    if (typeof tag !== "string" || !tag.startsWith("git-client-")) continue;
    const existingVersion = tag.slice("git-client-".length);
    let existing: number[];
    try {
      existing = parseReleaseVersion(existingVersion).split(".").map(Number);
    } catch {
      continue;
    }
    const comparison = requested.findIndex(
      (part, index) => part !== existing[index],
    );
    if (comparison === -1 || requested[comparison]! < existing[comparison]!) {
      throw new Error(
        `Release version must be newer than ${existingVersion}: ${version}`,
      );
    }
  }
  return version;
}

export function createGitHubEnvironment(environment: any) {
  const token = environment.GH_TOKEN ?? environment.GH_PAT;
  if (!token)
    throw new Error("Set GH_TOKEN in CI or GH_PAT for a local GitHub release");
  return { ...environment, GH_TOKEN: token };
}

export function createGhReleaseArguments({
  artifacts,
  notesFile,
  sha,
  version,
}: any) {
  return [
    "release",
    "create",
    createReleaseTag(version),
    artifacts.dmg,
    artifacts.checksum,
    artifacts.provenance,
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

export function createGhTagReferenceArguments(tag: any) {
  return [
    "api",
    `repos/${githubRepository}/git/ref/tags/${tag}`,
    "--jq",
    ".object.sha",
  ];
}

export function createGhDeleteTagArguments(tag: any) {
  return [
    "api",
    "--method",
    "DELETE",
    `repos/${githubRepository}/git/refs/tags/${tag}`,
  ];
}

export function parseReleaseMetadata(value: any) {
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
  const assets = parsed.assets.map((asset: any) => {
    if (
      typeof asset !== "object" ||
      asset === null ||
      typeof asset.name !== "string"
    ) {
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

export function assertReleaseMetadata(
  metadata: any,
  version: any,
  expectedDraft: any,
) {
  const names = createReleaseArtifactNames(version);
  const expectedAssets = [names.checksum, names.dmg, names.provenance].sort(
    (left: any, right: any) => left.localeCompare(right),
  );
  const actualAssets = [...metadata.assets].sort((left: any, right: any) =>
    left.localeCompare(right),
  );
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

async function readReleaseMetadata(
  tag: any,
  environment: any,
  allowFailure: any = false,
) {
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

async function removeDraftCreatedByCurrentRun(
  tag: any,
  sha: any,
  environment: any,
) {
  const metadata = await readReleaseMetadata(tag, environment, true);
  if (
    metadata === null ||
    !metadata.isDraft ||
    (await readRemoteTagSha(tag, environment)) !== sha
  )
    return;
  await executeCommand(
    "gh",
    [
      "release",
      "delete",
      tag,
      "--repo",
      githubRepository,
      "--cleanup-tag",
      "--yes",
    ],
    { cwd: workspaceRoot, env: environment },
  );
}

async function readRemoteTagSha(tag: any, environment: any) {
  const result = await executeCommand(
    "gh",
    createGhTagReferenceArguments(tag),
    {
      allowFailure: true,
      capture: true,
      cwd: workspaceRoot,
      env: environment,
    },
  );
  if (result.code !== 0) return null;
  const sha = result.stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(`Unexpected GitHub tag object SHA: ${sha}`);
  }
  return sha;
}

async function readPublishedReleaseTags(environment: any) {
  const result = await executeCommand(
    "gh",
    [
      "release",
      "list",
      "--repo",
      githubRepository,
      "--exclude-drafts",
      "--exclude-pre-releases",
      "--limit",
      "1000",
      "--json",
      "tagName",
    ],
    { capture: true, cwd: workspaceRoot, env: environment },
  );
  const releases = JSON.parse(result.stdout);
  if (!Array.isArray(releases))
    throw new Error("Expected GitHub release list to be an array");
  return releases.map((release: any) => {
    if (
      typeof release !== "object" ||
      release === null ||
      typeof release.tagName !== "string"
    )
      throw new Error("GitHub release list contains an invalid entry");
    return release.tagName;
  });
}

async function removeTagCreatedByCurrentRun(
  tag: any,
  sha: any,
  environment: any,
) {
  if ((await readRemoteTagSha(tag, environment)) !== sha) return;
  await executeCommand("gh", createGhDeleteTagArguments(tag), {
    cwd: workspaceRoot,
    env: environment,
  });
}

async function publishRelease(release: any) {
  const environment = createGitHubEnvironment(process.env);
  const tag = createReleaseTag(release.version);
  if ((await readReleaseMetadata(tag, environment, true)) !== null)
    throw new Error(`Release identity already exists and is immutable: ${tag}`);
  if ((await readRemoteTagSha(tag, environment)) !== null)
    throw new Error(`Release tag already exists and is immutable: ${tag}`);
  assertMonotonicReleaseVersion(
    release.version,
    await readPublishedReleaseTags(environment),
  );

  const artifacts = await buildRelease(release.version);
  const sha = artifacts.sourceSha;
  const notesFile = join(appRoot, "release-artifacts", "release-notes.md");
  await writeFile(notesFile, release.notes);

  let mayHaveCreatedDraft = false;
  try {
    mayHaveCreatedDraft = true;
    await executeCommand(
      "gh",
      createGhReleaseArguments({
        artifacts,
        notesFile,
        sha,
        version: release.version,
      }),
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
        await removeDraftCreatedByCurrentRun(tag, sha, environment);
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

export function parsePublishArguments(arguments_: any) {
  const normalized = arguments_.filter((argument: any) => argument !== "--");
  const unknownFlag = normalized.find(
    (argument: any) => argument.startsWith("--") && argument !== "--dry-run",
  );
  if (unknownFlag !== undefined)
    throw new Error(`Unknown release argument: ${unknownFlag}`);
  const versions = normalized.filter(
    (argument: any) => argument !== "--dry-run",
  );
  if (versions.length !== 1)
    throw new Error("Expected exactly one release version argument");
  return {
    dryRun: normalized.includes("--dry-run"),
    version: parseReleaseVersion(versions[0]),
  };
}

async function main() {
  const options = parsePublishArguments(process.argv.slice(2));
  if (!options.dryRun) await verifyReleaseSource(workspaceRoot);
  const release = {
    notes: createReleaseNotes(options.version),
    version: options.version,
  };
  console.log(`Git Client release: ${release.version}`);
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
