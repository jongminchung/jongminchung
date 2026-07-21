import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDirectory, "../..");
const contractPath = resolve(appRoot, "parity/rebased/1.1.8/fixtures/mvp-contract.json");
const slicesPath = resolve(appRoot, "parity/rebased/1.1.8/fixtures/slices");

const themesSchema = z.tuple([z.literal("light"), z.literal("dark")]);
const densitiesSchema = z.tuple([z.literal("regular"), z.literal("compact")]);
const repositoryStateSchema = z.enum(["clean", "dirty", "staged", "conflict"]);
const laneSchema = z.enum(["welcome", "log", "changes", "terminal"]);

const sliceSchema = z
  .object({
    id: z.string().min(1),
    lane: laneSchema,
    repositoryState: repositoryStateSchema.nullable(),
    themes: themesSchema,
    densities: densitiesSchema,
  })
  .strict();

const foundationSchema = z
  .object({
    schemaVersion: z.literal(1),
    referenceVersion: z.literal("1.1.8"),
    clock: z
      .object({
        iso: z.string().datetime(),
        timezone: z.literal("UTC"),
        locale: z.string().min(1),
      })
      .strict(),
    gitIdentity: z.object({ name: z.string().min(1), email: z.string().email() }).strict(),
  })
  .strict();

const contractSchema = foundationSchema
  .extend({ slices: z.array(sliceSchema) })
  .superRefine((contract, context) => {
    const ids = contract.slices.map((slice) => slice.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", message: "MVP slice ids must be unique" });
    }
    const lanes = contract.slices.map((slice) => slice.lane);
    if (new Set(lanes).size !== lanes.length) {
      context.addIssue({ code: "custom", message: "MVP lanes must be unique" });
    }
  });

export function loadMvpFixtureContract(path = contractPath) {
  const foundation = foundationSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  const slices = readdirSync(slicesPath)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => sliceSchema.parse(JSON.parse(readFileSync(resolve(slicesPath, name), "utf8"))));
  return contractSchema.parse({ ...foundation, slices });
}

function runGit(cwd, args, environment = {}) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_OPTIONAL_LOCKS: "0",
      LC_ALL: "C",
      TZ: "UTC",
      ...environment,
    },
  });
}

function runGitExpectFailure(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_OPTIONAL_LOCKS: "0",
      LC_ALL: "C",
      TZ: "UTC",
    },
  });
  if (result.status === 0) throw new Error(`git ${args.join(" ")} unexpectedly succeeded`);
}

function commitEnvironment(contract, iso) {
  return {
    GIT_AUTHOR_DATE: iso,
    GIT_AUTHOR_EMAIL: contract.gitIdentity.email,
    GIT_AUTHOR_NAME: contract.gitIdentity.name,
    GIT_COMMITTER_DATE: iso,
    GIT_COMMITTER_EMAIL: contract.gitIdentity.email,
    GIT_COMMITTER_NAME: contract.gitIdentity.name,
  };
}

function lines(value) {
  return value.trimEnd() === "" ? [] : value.trimEnd().split("\n");
}

export function createCanonicalGitFixture({ parentDirectory, state }) {
  const contract = loadMvpFixtureContract();
  const repositoryPath = resolve(parentDirectory, "repository");
  const remotePath = resolve(parentDirectory, "remote.git");
  mkdirSync(repositoryPath, { recursive: true });
  runGit(parentDirectory, ["init", "--bare", "--initial-branch=main", remotePath]);
  runGit(parentDirectory, ["init", "--initial-branch=main", repositoryPath]);
  runGit(repositoryPath, ["config", "user.name", contract.gitIdentity.name]);
  runGit(repositoryPath, ["config", "user.email", contract.gitIdentity.email]);
  runGit(repositoryPath, ["config", "core.autocrlf", "false"]);

  writeFileSync(resolve(repositoryPath, "README.md"), "# Rebased parity fixture\n", "utf8");
  runGit(repositoryPath, ["add", "README.md"]);
  runGit(
    repositoryPath,
    ["commit", "-m", "chore: initialize fixture"],
    commitEnvironment(contract, "2025-01-15T11:58:00.000Z"),
  );

  mkdirSync(resolve(repositoryPath, "src"), { recursive: true });
  writeFileSync(resolve(repositoryPath, "src/app.ts"), "export const parity = true;\n", "utf8");
  runGit(repositoryPath, ["add", "src/app.ts"]);
  runGit(
    repositoryPath,
    ["commit", "-m", "feat: add deterministic parity fixture"],
    commitEnvironment(contract, contract.clock.iso),
  );
  runGit(repositoryPath, ["remote", "add", "origin", remotePath]);
  runGit(repositoryPath, ["push", "--set-upstream", "origin", "main"]);

  if (state === "dirty" || state === "staged") {
    writeFileSync(resolve(repositoryPath, "src/app.ts"), "export const parity = false;\n", "utf8");
    writeFileSync(resolve(repositoryPath, "notes.txt"), "deterministic fixture note\n", "utf8");
    if (state === "staged") runGit(repositoryPath, ["add", "src/app.ts", "notes.txt"]);
  } else if (state === "conflict") {
    runGit(repositoryPath, ["switch", "-c", "parity/conflict"]);
    writeFileSync(
      resolve(repositoryPath, "src/app.ts"),
      'export const parity = "branch";\n',
      "utf8",
    );
    runGit(repositoryPath, ["add", "src/app.ts"]);
    runGit(
      repositoryPath,
      ["commit", "-m", "test: create branch side of conflict"],
      commitEnvironment(contract, "2025-01-15T12:01:00.000Z"),
    );
    runGit(repositoryPath, ["switch", "main"]);
    writeFileSync(resolve(repositoryPath, "src/app.ts"), 'export const parity = "main";\n', "utf8");
    runGit(repositoryPath, ["add", "src/app.ts"]);
    runGit(
      repositoryPath,
      ["commit", "-m", "test: create main side of conflict"],
      commitEnvironment(contract, "2025-01-15T12:02:00.000Z"),
    );
    runGitExpectFailure(repositoryPath, ["merge", "--no-edit", "parity/conflict"]);
  } else if (state !== "clean") {
    throw new Error(`Canonical Git fixture state is not implemented: ${state}`);
  }

  const fixture = Object.freeze({ repositoryPath, remotePath });
  return Object.freeze({ ...fixture, normalized: captureCanonicalGitFixtureState(fixture) });
}

export function captureCanonicalGitFixtureState({ repositoryPath, remotePath }) {
  return Object.freeze({
    branch: runGit(repositoryPath, ["branch", "--show-current"]).trim(),
    commitOids: Object.freeze(lines(runGit(repositoryPath, ["log", "--format=%H", "-2"]))),
    commitSubjects: Object.freeze(lines(runGit(repositoryPath, ["log", "--format=%s", "-2"]))),
    changedPaths: Object.freeze(lines(runGit(repositoryPath, ["status", "--short"]))),
    remoteRefs: Object.freeze(
      lines(runGit(remotePath, ["for-each-ref", "--format=%(refname)", "refs/heads"])),
    ),
  });
}

export const MVP_FIXTURE_CONTRACT_PATH = contractPath;
