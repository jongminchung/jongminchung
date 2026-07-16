import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];
const workspaceRoot = join(dirname(new URL(import.meta.url).pathname), "../../..");
const rendererModule = new URL("./nx-changelog-renderer.mjs", import.meta.url).href;

async function run(cwd: string, command: string, arguments_: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync(command, arguments_, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NX_DAEMON: "false" },
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function commit(cwd: string, message: string): Promise<void> {
  await run(cwd, "git", ["add", "."]);
  await run(cwd, "git", ["commit", "-m", message]);
}

async function createFixture(tagInitialRelease = true): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "git-client-nx-release-"));
  temporaryDirectories.push(directory);
  await symlink(join(workspaceRoot, "node_modules"), join(directory, "node_modules"), "dir");
  await writeJson(join(directory, "package.json"), {
    name: "release-fixture",
    private: true,
    workspaces: ["apps/*", "packages/*"],
  });
  await writeFile(
    join(directory, "pnpm-workspace.yaml"),
    'packages:\n  - "apps/*"\n  - "packages/*"\n',
  );
  await writeFile(join(directory, ".gitignore"), "node_modules/\n");
  await writeJson(join(directory, "nx.json"), {
    extends: "nx/presets/npm.json",
    pluginsConfig: {
      "@nx/js": { projectsAffectedByDependencyUpdates: "auto" },
    },
    release: {
      conventionalCommits: {
        useCommitScope: false,
        types: {
          feat: { semverBump: "minor" },
          fix: { semverBump: "patch" },
          perf: { semverBump: "patch" },
        },
      },
      version: {
        git: { commit: false, push: false, stageChanges: false, tag: false },
      },
      changelog: {
        git: { commit: false, push: false, stageChanges: false, tag: false },
        workspaceChangelog: false,
      },
      groups: {
        "git-client": {
          projects: ["@fixture/git-client"],
          projectsRelationship: "fixed",
          releaseTag: { pattern: "git-client-{version}", requireSemver: true },
          version: {
            adjustSemverBumpsForZeroMajorVersion: false,
            currentVersionResolver: "git-tag",
            fallbackCurrentVersionResolver: "disk",
            specifierSource: "conventional-commits",
            versionActionsOptions: { skipLockFileUpdate: true },
          },
          changelog: { createRelease: false, entryWhenNoChanges: false, file: false },
        },
      },
    },
  });
  await writeJson(join(directory, "apps/git-client/package.json"), {
    name: "@fixture/git-client",
    version: "0.1.0",
    private: true,
    dependencies: { "@fixture/shared": "workspace:*" },
  });
  await writeJson(join(directory, "apps/other/package.json"), {
    name: "@fixture/other",
    version: "0.1.0",
    private: true,
  });
  await writeJson(join(directory, "packages/shared/package.json"), {
    name: "@fixture/shared",
    version: "0.1.0",
    private: true,
  });
  await writeFile(join(directory, "apps/git-client/index.js"), "export const client = true;\n");
  await writeFile(join(directory, "apps/other/index.js"), "export const other = 1;\n");
  await writeFile(join(directory, "packages/shared/index.js"), "export const shared = 1;\n");
  await writeFile(
    join(directory, "release-check.mjs"),
    `import { createProjectGraphAsync } from "@nx/devkit";
import { ReleaseClient } from "nx/release";
import { collectTransitiveWorkspaceDependencies, createDependencyAwareChangelogRenderer } from ${JSON.stringify(rendererModule)};
const project = "@fixture/git-client";
const projectGraph = await createProjectGraphAsync();
const renderer = createDependencyAwareChangelogRenderer({
  includedProjects: collectTransitiveWorkspaceDependencies(projectGraph, project),
  projectName: project,
  workspaceRoot: process.cwd(),
});
const client = new ReleaseClient({
  groups: {
    "git-client": {
      changelog: {
        file: "{projectRoot}/release-artifacts/release-notes.md",
        renderer,
      },
      projects: [project],
    },
  },
});
const firstRelease = process.env.FIRST_RELEASE === "true";
const result = await client.releaseVersion({
  dryRun: true,
  firstRelease,
  groups: ["git-client"],
  specifier: firstRelease ? "1.0.0" : undefined,
});
const versionData = result.projectsVersionData[project];
let notes = null;
if (firstRelease && versionData?.newVersion !== null) {
  notes = "Initial Git Client release.";
} else if (versionData?.newVersion !== null) {
  const changelog = await client.releaseChangelog({
    dryRun: true,
    firstRelease: false,
    from: process.env.RELEASE_FROM,
    groups: ["git-client"],
    releaseGraph: result.releaseGraph,
    versionData: result.projectsVersionData,
  });
  notes = changelog.projectChangelogs?.[project]?.contents ?? null;
}
console.log("__NX_RELEASE_RESULT__" + JSON.stringify({ notes, version: versionData?.newVersion ?? null }));
`,
  );

  await run(directory, "git", ["init", "--initial-branch=main"]);
  await run(directory, "git", ["config", "user.email", "release-test@example.com"]);
  await run(directory, "git", ["config", "user.name", "Release Test"]);
  await commit(directory, "chore: initialize fixture");
  if (tagInitialRelease) await run(directory, "git", ["tag", "git-client-1.0.0"]);
  return directory;
}

async function calculateRelease(
  cwd: string,
  firstRelease = false,
): Promise<{ notes: string | null; version: string | null }> {
  const tag = await run(cwd, "git", ["tag", "--list", "git-client-*", "--sort=-v:refname"]);
  const { stdout } = await execFileAsync(process.execPath, ["release-check.mjs"], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      FIRST_RELEASE: String(firstRelease),
      NX_DAEMON: "false",
      RELEASE_FROM: tag.split("\n")[0],
    },
    maxBuffer: 10 * 1024 * 1024,
  });
  const output = stdout.trim();
  const marker = output.split("\n").find((line) => line.startsWith("__NX_RELEASE_RESULT__"));
  if (!marker) throw new Error(`Nx result marker not found in output: ${output}`);
  return JSON.parse(marker.replace("__NX_RELEASE_RESULT__", ""));
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("Nx release project affectedness", () => {
  it("starts at exactly 1.0.0 when no Git Client release tag exists", async () => {
    const directory = await createFixture(false);
    const manifestBefore = await readFile(join(directory, "apps/git-client/package.json"), "utf8");

    expect(await calculateRelease(directory, true)).toEqual({
      notes: "Initial Git Client release.",
      version: "1.0.0",
    });
    expect(await readFile(join(directory, "apps/git-client/package.json"), "utf8")).toBe(
      manifestBefore,
    );
  }, 30_000);

  it("includes workspace dependencies while excluding unrelated apps", async () => {
    const directory = await createFixture();
    const manifestBefore = await readFile(join(directory, "apps/git-client/package.json"), "utf8");

    await writeFile(join(directory, "packages/shared/index.js"), "export const shared = 2;\n");
    await commit(directory, "fix: repair shared behavior");
    await writeFile(join(directory, "apps/other/index.js"), "export const other = 2;\n");
    await commit(directory, "feat: change unrelated app");

    const dependencyRelease = await calculateRelease(directory);
    expect(dependencyRelease.version).toBe("1.0.1");
    expect(dependencyRelease.notes).toContain("repair shared behavior");
    expect(dependencyRelease.notes).not.toContain("change unrelated app");
    expect(await readFile(join(directory, "apps/git-client/package.json"), "utf8")).toBe(
      manifestBefore,
    );

    await run(directory, "git", ["tag", "git-client-1.0.1"]);
    await writeFile(join(directory, "apps/other/index.js"), "export const other = 3;\n");
    await commit(directory, "feat: update only the other app");
    expect(await calculateRelease(directory)).toEqual({ notes: null, version: null });

    await writeFile(join(directory, "apps/git-client/index.js"), "export const client = false;\n");
    await commit(directory, "feat: add client capability");
    const clientRelease = await calculateRelease(directory);
    expect(clientRelease.version).toBe("1.1.0");
    expect(clientRelease.notes).toContain("add client capability");
    expect(clientRelease.notes).not.toContain("update only the other app");

    await run(directory, "git", ["tag", "git-client-1.1.0"]);
    await writeFile(join(directory, "apps/git-client/index.js"), "export const client = 'fast';\n");
    await commit(directory, "perf: accelerate client graph");
    const performanceRelease = await calculateRelease(directory);
    expect(performanceRelease.version).toBe("1.1.1");
    expect(performanceRelease.notes).toContain("accelerate client graph");

    await run(directory, "git", ["tag", "git-client-1.1.1"]);
    await writeFile(join(directory, "apps/git-client/index.js"), "export const client = 'v2';\n");
    await commit(directory, "feat!: replace client contract");
    const breakingRelease = await calculateRelease(directory);
    expect(breakingRelease.version).toBe("2.0.0");
    expect(breakingRelease.notes).toContain("replace client contract");
  }, 30_000);
});
