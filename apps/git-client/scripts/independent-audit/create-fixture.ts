#!/usr/bin/env node
// oxlint-disable typescript/no-explicit-any -- Native TypeScript entry points retain dynamic process, fixture, and injected test-double boundaries.

import { lstat, mkdir, readdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runGit } from "./git-process.ts";

const IDENTITY_ENV = Object.freeze({
  GIT_AUTHOR_EMAIL: "rebased-audit@example.invalid",
  GIT_AUTHOR_NAME: "Rebased Audit",
  GIT_COMMITTER_EMAIL: "rebased-audit@example.invalid",
  GIT_COMMITTER_NAME: "Rebased Audit",
});

const FIXTURE_MANIFEST = Object.freeze({
  schemaVersion: 1,
  remote: "remote.git",
  repositories: Object.freeze({
    gitClient: "git-client-case",
    rebased: "rebased-case",
  }),
});

export async function createAuditFixture(rootPath: any) {
  const root = await prepareEmptyRoot(rootPath);
  const remotePath = join(root, FIXTURE_MANIFEST.remote);
  const seedPath = join(root, "seed");
  const rebasedPath = join(root, FIXTURE_MANIFEST.repositories.rebased);
  const gitClientPath = join(root, FIXTURE_MANIFEST.repositories.gitClient);

  await runGit(root, ["init", "--bare", "--initial-branch=main", remotePath]);
  await runGit(root, ["init", "--initial-branch=main", seedPath]);
  await configureRepository(seedPath);
  await writeFile(
    join(seedPath, "README.md"),
    "# Rebased 1.1.11 audit fixture\n",
    "utf8",
  );
  await mkdir(join(seedPath, "src"));
  await writeFile(
    join(seedPath, "src", "index.ts"),
    'export const version = "1.0.0";\n',
    "utf8",
  );
  await runGit(seedPath, ["add", "."]);
  await commit(seedPath, "fixture: initial state", "2020-01-02T03:04:05Z");

  await writeFile(
    join(seedPath, "src", "shared.ts"),
    "export const shared = true;\n",
    "utf8",
  );
  await runGit(seedPath, ["add", "src/shared.ts"]);
  await commit(seedPath, "fixture: add shared source", "2020-01-03T03:04:05Z");
  await runGit(seedPath, ["tag", "v1.0.0"]);

  await runGit(seedPath, ["switch", "-c", "feature/topic", "HEAD~1"]);
  await writeFile(
    join(seedPath, "src", "topic.ts"),
    "export const topic = true;\n",
    "utf8",
  );
  await runGit(seedPath, ["add", "src/topic.ts"]);
  await commit(seedPath, "fixture: add topic branch", "2020-01-04T03:04:05Z");
  await runGit(seedPath, ["switch", "main"]);
  await runGit(seedPath, ["remote", "add", "origin", remotePath]);
  await runGit(seedPath, [
    "push",
    "--set-upstream",
    "origin",
    "main",
    "feature/topic",
  ]);
  await runGit(seedPath, ["push", "origin", "v1.0.0"]);

  for (const repositoryPath of [rebasedPath, gitClientPath]) {
    await runGit(root, [
      "clone",
      "--origin",
      "origin",
      remotePath,
      repositoryPath,
    ]);
    await configureRepository(repositoryPath);
    await seedStash(repositoryPath);
    await seedWorkingState(repositoryPath);
  }

  await writeFile(
    join(root, "fixture-manifest.json"),
    `${JSON.stringify(FIXTURE_MANIFEST, null, 2)}\n`,
    "utf8",
  );

  return Object.freeze({
    root,
    remotePath,
    rebasedPath,
    gitClientPath,
  });
}

async function prepareEmptyRoot(rootPath: any) {
  if (typeof rootPath !== "string" || !isAbsolute(rootPath)) {
    throw new Error("Fixture root must be an absolute path");
  }
  const root = resolve(rootPath);
  try {
    const stat = await lstat(root);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`Fixture root must be a regular directory: ${root}`);
    }
    if ((await readdir(root)).length !== 0) {
      throw new Error(`Fixture root must be empty: ${root}`);
    }
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    )
      throw error;
    await mkdir(root, { recursive: false });
  }
  return root;
}

async function configureRepository(repositoryPath: any) {
  const entries = [
    ["user.name", IDENTITY_ENV.GIT_AUTHOR_NAME],
    ["user.email", IDENTITY_ENV.GIT_AUTHOR_EMAIL],
    ["commit.gpgSign", "false"],
    ["core.autocrlf", "false"],
  ];
  for (const [key, value] of entries)
    await runGit(repositoryPath, ["config", key, value]);
}

async function commit(repositoryPath: any, message: any, date: any) {
  await runGit(repositoryPath, ["commit", "--no-gpg-sign", "-m", message], {
    env: {
      ...IDENTITY_ENV,
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
    },
  });
}

async function seedStash(repositoryPath: any) {
  await writeFile(
    join(repositoryPath, "README.md"),
    "# Rebased 1.1.11 audit fixture\n\nstashed baseline note\n",
    "utf8",
  );
  const date = "2020-01-05T03:04:05Z";
  await runGit(repositoryPath, ["stash", "push", "-m", "audit-baseline"], {
    env: {
      ...IDENTITY_ENV,
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
    },
  });
}

async function seedWorkingState(repositoryPath: any) {
  const sourcePath = join(repositoryPath, "src", "index.ts");
  await writeFile(
    sourcePath,
    'export const version = "1.1.11";\nexport const staged = true;\n',
    "utf8",
  );
  await runGit(repositoryPath, ["add", "src/index.ts"]);
  await writeFile(
    sourcePath,
    'export const version = "1.1.11";\nexport const staged = true;\nexport const working = true;\n',
    "utf8",
  );
  await writeFile(
    join(repositoryPath, "notes.txt"),
    "untracked audit note\n",
    "utf8",
  );
}

function parseRootArgument(args: any) {
  if (args.length !== 2 || args[0] !== "--root" || !isAbsolute(args[1])) {
    throw new Error("Usage: create-fixture.ts --root /absolute/empty/path");
  }
  return args[1];
}

const scriptPath = fileURLToPath(import.meta.url);
const isEntryPoint =
  process.argv[1] !== undefined && resolve(process.argv[1]) === scriptPath;

if (isEntryPoint) {
  try {
    const result = await createAuditFixture(
      parseRootArgument(process.argv.slice(2)),
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
