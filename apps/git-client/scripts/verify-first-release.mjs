import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { captureCommand, executeCommand } from "./process.mjs";
import {
  assertReleaseMetadata,
  createGitHubEnvironment,
  createReleaseTag,
  githubRepository,
  initialReleaseVersion,
  parseReleaseMetadata,
} from "./publish-release.mjs";
import { createReleaseArtifactNames } from "./release.mjs";

const workflowFile = "git-client.yml";
const confirmation = createReleaseTag(initialReleaseVersion);
const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));
const activeWorkflowStatuses = new Set([
  "in_progress",
  "pending",
  "queued",
  "requested",
  "waiting",
]);

export function parseVerificationArguments(arguments_) {
  if (arguments_.length !== 2 || arguments_[0] !== "--confirm" || arguments_[1] !== confirmation) {
    throw new Error(`Pass --confirm ${confirmation} to recreate the public first release`);
  }
  return { confirmation };
}

export function normalizeGitHubRemote(value) {
  const trimmed = value.trim().replace(/\.git$/, "");
  const ssh = /^git@github\.com:(.+)$/.exec(trimmed);
  if (ssh) return ssh[1];
  const https = /^https:\/\/github\.com\/(.+)$/.exec(trimmed);
  if (https) return https[1];
  const sshUrl = /^ssh:\/\/git@github\.com\/(.+)$/.exec(trimmed);
  if (sshUrl) return sshUrl[1];
  throw new Error(`Unsupported GitHub origin URL: ${value}`);
}

export function findNewerReleaseTags(tags, targetVersion = initialReleaseVersion) {
  const target = targetVersion.split(".").map(Number);
  return tags.filter((tag) => {
    const match = /^git-client-(\d+)\.(\d+)\.(\d+)$/.exec(tag);
    if (!match) return false;
    const version = match.slice(1).map(Number);
    for (let index = 0; index < target.length; index += 1) {
      if (version[index] > target[index]) return true;
      if (version[index] < target[index]) return false;
    }
    return false;
  });
}

export function parseMountPoint(value) {
  for (const line of value.split("\n")) {
    const match = /(\/Volumes\/.+)$/.exec(line.trim());
    if (match) return match[1];
  }
  throw new Error("Unable to find the mounted DMG volume");
}

function parseJsonArray(value, label) {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error(`Expected ${label} to be an array`);
  return parsed;
}

async function ensureNoActiveWorkflowRuns(environment) {
  const output = await captureCommand(
    "gh",
    [
      "run",
      "list",
      "--repo",
      githubRepository,
      "--workflow",
      workflowFile,
      "--limit",
      "30",
      "--json",
      "databaseId,status",
    ],
    { cwd: workspaceRoot, env: environment },
  );
  const active = parseJsonArray(output, "workflow runs").filter(
    (run) =>
      typeof run === "object" &&
      run !== null &&
      typeof run.status === "string" &&
      activeWorkflowStatuses.has(run.status),
  );
  if (active.length > 0) throw new Error("A Git Client workflow is already active");
}

async function listRemoteReleaseTags() {
  const output = await captureCommand(
    "git",
    ["ls-remote", "--tags", "origin", "refs/tags/git-client-*"],
    { cwd: workspaceRoot },
  );
  if (output === "") return [];
  return output
    .split("\n")
    .map((line) => line.split("\t")[1])
    .filter((ref) => typeof ref === "string" && !ref.endsWith("^{}"))
    .map((ref) => ref.replace("refs/tags/", ""));
}

async function removeExistingFirstRelease(environment, remoteTags) {
  const tag = createReleaseTag(initialReleaseVersion);
  const release = await executeCommand("gh", ["release", "view", tag, "--repo", githubRepository], {
    allowFailure: true,
    capture: true,
    cwd: workspaceRoot,
    env: environment,
  });
  if (release.code === 0) {
    await executeCommand(
      "gh",
      ["release", "delete", tag, "--repo", githubRepository, "--cleanup-tag", "--yes"],
      { cwd: workspaceRoot, env: environment },
    );
  } else if (remoteTags.includes(tag)) {
    await executeCommand("git", ["push", "origin", "--delete", tag], { cwd: workspaceRoot });
  }
  await executeCommand("git", ["tag", "--delete", tag], {
    allowFailure: true,
    capture: true,
    cwd: workspaceRoot,
  });
}

function selectWorkflowRun(value, sha, notBefore) {
  const runs = parseJsonArray(value, "workflow runs");
  for (const run of runs) {
    if (typeof run !== "object" || run === null) continue;
    if (
      typeof run.databaseId === "number" &&
      run.headSha === sha &&
      typeof run.createdAt === "string" &&
      Date.parse(run.createdAt) >= notBefore
    ) {
      return run.databaseId;
    }
  }
  return null;
}

async function waitForDispatchedRun(environment, sha, notBefore) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const output = await captureCommand(
      "gh",
      [
        "run",
        "list",
        "--repo",
        githubRepository,
        "--workflow",
        workflowFile,
        "--event",
        "workflow_dispatch",
        "--limit",
        "20",
        "--json",
        "createdAt,databaseId,headSha,status",
      ],
      { cwd: workspaceRoot, env: environment },
    );
    const runId = selectWorkflowRun(output, sha, notBefore);
    if (runId !== null) return runId;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2000));
  }
  throw new Error("Timed out waiting for the dispatched Git Client workflow");
}

async function readPublishedRelease(environment) {
  const output = await captureCommand(
    "gh",
    [
      "release",
      "view",
      createReleaseTag(initialReleaseVersion),
      "--repo",
      githubRepository,
      "--json",
      "assets,isDraft,isPrerelease,name,tagName",
    ],
    { cwd: workspaceRoot, env: environment },
  );
  return parseReleaseMetadata(output);
}

async function verifyDownloadedRelease(environment) {
  const directory = await mkdtemp(join(tmpdir(), "git-client-first-release-"));
  const names = createReleaseArtifactNames(initialReleaseVersion);
  const tag = createReleaseTag(initialReleaseVersion);
  let mountPoint = null;

  try {
    await executeCommand(
      "gh",
      ["release", "download", tag, "--repo", githubRepository, "--dir", directory],
      { cwd: workspaceRoot, env: environment },
    );
    const downloaded = (await readdir(directory)).sort((left, right) => left.localeCompare(right));
    const expected = [names.checksum, names.dmg].sort((left, right) => left.localeCompare(right));
    if (JSON.stringify(downloaded) !== JSON.stringify(expected)) {
      throw new Error(`Unexpected downloaded release files: ${downloaded.join(", ")}`);
    }

    await executeCommand("shasum", ["-a", "256", "-c", names.checksum], { cwd: directory });
    const dmg = join(directory, names.dmg);
    if ((await stat(dmg)).size > 75 * 1024 * 1024) {
      throw new Error("Published DMG exceeds the 75 MiB budget");
    }

    const mountOutput = await captureCommand("hdiutil", ["attach", dmg, "-nobrowse", "-readonly"], {
      cwd: directory,
    });
    mountPoint = parseMountPoint(mountOutput);
    const apps = (await readdir(mountPoint)).filter((entry) => entry.endsWith(".app"));
    if (apps.length !== 1) throw new Error(`Expected one app in the DMG, found ${apps.length}`);
    const app = join(mountPoint, apps[0]);
    const plist = join(app, "Contents", "Info.plist");
    const version = await captureCommand(
      "plutil",
      ["-extract", "CFBundleShortVersionString", "raw", "-o", "-", plist],
      { cwd: directory },
    );
    if (version !== initialReleaseVersion) throw new Error(`Unexpected app version: ${version}`);
    const executableName = await captureCommand(
      "plutil",
      ["-extract", "CFBundleExecutable", "raw", "-o", "-", plist],
      { cwd: directory },
    );
    const architectures = await captureCommand(
      "lipo",
      ["-archs", join(app, "Contents", "MacOS", executableName)],
      { cwd: directory },
    );
    if (architectures !== "arm64")
      throw new Error(`Unexpected app architectures: ${architectures}`);
  } finally {
    if (mountPoint !== null) {
      await executeCommand("hdiutil", ["detach", mountPoint], {
        allowFailure: true,
        capture: true,
        cwd: directory,
      });
    }
    await rm(directory, { force: true, recursive: true });
  }
}

async function main() {
  parseVerificationArguments(process.argv.slice(2));
  if (!process.env.GH_PAT) throw new Error("Set GH_PAT before recreating the first release");
  const environment = createGitHubEnvironment({ ...process.env, GH_TOKEN: process.env.GH_PAT });

  const origin = await captureCommand("git", ["remote", "get-url", "origin"], {
    cwd: workspaceRoot,
  });
  if (normalizeGitHubRemote(origin) !== githubRepository) {
    throw new Error(`Expected origin to be ${githubRepository}`);
  }
  await executeCommand("git", ["fetch", "--no-tags", "origin", "main"], { cwd: workspaceRoot });
  const remoteSha = await captureCommand("git", ["rev-parse", "origin/main"], {
    cwd: workspaceRoot,
  });
  const localSha = await captureCommand("git", ["rev-parse", "HEAD"], { cwd: workspaceRoot });
  if (localSha !== remoteSha) throw new Error("Local HEAD must match origin/main exactly");

  await ensureNoActiveWorkflowRuns(environment);
  const remoteTags = await listRemoteReleaseTags();
  const newerTags = findNewerReleaseTags(remoteTags);
  if (newerTags.length > 0) {
    throw new Error(`Refusing to recreate 1.0.0 after later releases: ${newerTags.join(", ")}`);
  }
  await removeExistingFirstRelease(environment, remoteTags);

  const dispatchStartedAt = Date.now() - 5000;
  await executeCommand(
    "gh",
    [
      "workflow",
      "run",
      workflowFile,
      "--repo",
      githubRepository,
      "--ref",
      "main",
      "-f",
      "recreate_first_release=true",
    ],
    { cwd: workspaceRoot, env: environment },
  );
  const runId = await waitForDispatchedRun(environment, remoteSha, dispatchStartedAt);
  await executeCommand(
    "gh",
    ["run", "watch", String(runId), "--repo", githubRepository, "--exit-status"],
    { cwd: workspaceRoot, env: environment },
  );

  const metadata = await readPublishedRelease(environment);
  assertReleaseMetadata(metadata, initialReleaseVersion, false);
  const tagSha = await captureCommand(
    "gh",
    [
      "api",
      `repos/${githubRepository}/git/ref/tags/${createReleaseTag(initialReleaseVersion)}`,
      "--jq",
      ".object.sha",
    ],
    { cwd: workspaceRoot, env: environment },
  );
  if (tagSha !== remoteSha)
    throw new Error(`Release tag points to ${tagSha}, expected ${remoteSha}`);
  await verifyDownloadedRelease(environment);
  console.log(`Verified ${createReleaseTag(initialReleaseVersion)} at ${remoteSha}`);
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
