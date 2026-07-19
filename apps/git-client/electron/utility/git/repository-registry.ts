import { realpath, stat } from "node:fs/promises";
import { basename, isAbsolute, resolve } from "node:path";
import { v5 as uuidV5 } from "uuid";
import {
  MINIMUM_GIT_VERSION,
  RepositoryIdSchema,
  type GitVersion,
  type RepositoryId,
  type RepositoryRecord,
} from "../../../src/shared/contracts/git-utility";
import { GitUtilityError } from "./git-error";
import type { GitProcessOutcome, GitProcessRunnerLike } from "./git-process";
import { safeErrorMessage } from "./redaction";
import { validateRepositoryPath } from "./validation";

interface InternalRepositoryRecord extends RepositoryRecord {
  readonly path: string;
}

function outputText(outcome: GitProcessOutcome, stream: "stdout" | "stderr"): string {
  return outcome.output
    .filter((entry) => entry.stream === stream)
    .map((entry) => entry.data)
    .join("");
}

export class RepositoryRegistry {
  readonly #runner: GitProcessRunnerLike;
  readonly #repositories = new Map<RepositoryId, InternalRepositoryRecord>();
  #gitVersion: GitVersion | null = null;

  constructor(runner: GitProcessRunnerLike) {
    this.#runner = runner;
  }

  async open(path: string): Promise<RepositoryRecord> {
    validateRepositoryPath(path);
    const gitVersion = await this.#detectGitVersion();
    let canonicalInput: string;
    try {
      canonicalInput = await realpath(path);
      if (!(await stat(canonicalInput)).isDirectory()) throw new Error("Path is not a directory");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Path is not accessible";
      throw new GitUtilityError("notRepository", `${path} (${safeErrorMessage(detail)})`);
    }

    const isBareText = await this.#capture(
      canonicalInput,
      ["rev-parse", "--is-bare-repository"],
      "notRepository",
    );
    const isBare = isBareText.trim() === "true";
    const root = isBare
      ? canonicalInput
      : await this.#canonicalGitPath(
          canonicalInput,
          canonicalInput,
          ["rev-parse", "--show-toplevel"],
          "notRepository",
        );
    const gitDirectory = await this.#canonicalGitPath(
      root,
      root,
      ["rev-parse", "--absolute-git-dir"],
      "notRepository",
    );
    const commonDirectory = await this.#canonicalGitPath(
      root,
      root,
      ["rev-parse", "--git-common-dir"],
      "notRepository",
    );
    const id = RepositoryIdSchema.parse(uuidV5(root, uuidV5.URL));
    const record: InternalRepositoryRecord = Object.freeze({
      id,
      name: basename(root) || "Repository",
      path: root,
      gitDirectory,
      commonDirectory,
      isBare,
      gitVersion,
    });
    this.#repositories.set(id, record);
    return record;
  }

  close(repositoryId: RepositoryId): boolean {
    return this.#repositories.delete(RepositoryIdSchema.parse(repositoryId));
  }

  get(repositoryId: RepositoryId): RepositoryRecord {
    const id = RepositoryIdSchema.parse(repositoryId);
    const record = this.#repositories.get(id);
    if (record === undefined) throw new GitUtilityError("repositoryNotOpen", "Repository is not open");
    return record;
  }

  list(): readonly RepositoryRecord[] {
    return Object.freeze([...this.#repositories.values()]);
  }

  async #detectGitVersion(): Promise<GitVersion> {
    if (this.#gitVersion !== null) return this.#gitVersion;
    const outcome = await this.#runner.run({ args: ["--version"] });
    if (outcome.kind !== "completed") {
      const detail = outputText(outcome, "stderr");
      throw new GitUtilityError(
        "gitUnavailable",
        safeErrorMessage(detail || (outcome.kind === "failed" ? outcome.message : "Git version check was cancelled")),
        outcome.kind === "failed" ? outcome.exitCode : null,
      );
    }
    const display = outputText(outcome, "stdout").trim();
    const match = /(?:^|\s)(\d+)\.(\d+)(?:\.(\d+))?/u.exec(display);
    if (match === null) throw new GitUtilityError("gitUnavailable", `Unrecognized Git version: ${display}`);
    const version: GitVersion = Object.freeze({
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: Number(match[3] ?? 0),
      display,
    });
    if (
      version.major < MINIMUM_GIT_VERSION.major ||
      (version.major === MINIMUM_GIT_VERSION.major && version.minor < MINIMUM_GIT_VERSION.minor)
    ) {
      throw new GitUtilityError(
        "unsupportedGit",
        `Git ${MINIMUM_GIT_VERSION.major}.${MINIMUM_GIT_VERSION.minor} or newer is required (${display})`,
      );
    }
    this.#gitVersion = version;
    return version;
  }

  async #canonicalGitPath(
    cwd: string,
    root: string,
    args: readonly string[],
    failureCode: "notRepository" | "commandFailed",
  ): Promise<string> {
    const rawPath = (await this.#capture(cwd, args, failureCode)).trim();
    const absolutePath = isAbsolute(rawPath) ? rawPath : resolve(root, rawPath);
    try {
      return await realpath(absolutePath);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Git path is not accessible";
      throw new GitUtilityError(failureCode, safeErrorMessage(detail));
    }
  }

  async #capture(
    cwd: string,
    args: readonly string[],
    failureCode: "notRepository" | "commandFailed",
  ): Promise<string> {
    const outcome = await this.#runner.run({ cwd, args });
    if (outcome.kind === "completed") return outputText(outcome, "stdout");
    if (outcome.kind === "cancelled") {
      throw new GitUtilityError("commandFailed", `Git command was cancelled (${outcome.reason})`);
    }
    const detail = outputText(outcome, "stderr");
    throw new GitUtilityError(
      failureCode,
      safeErrorMessage(detail || outcome.message),
      outcome.exitCode,
    );
  }
}
