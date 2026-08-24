import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  readlink,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import {
  GitRelativePathSchema,
  type RepositoryId,
} from "../../../src/shared/contracts/git-utility";
import { GitUtilityError } from "./git-error";
import type { GitProcessRunnerLike } from "./git-process";
import {
  isLocalHistoryTextPath,
  type FileState,
  type OptionalFileState,
} from "./local-history-model";
import {
  LocalHistoryStorage,
  gunzipLocalHistory,
} from "./local-history-storage";
import {
  commandFailure,
  contained,
  invalid,
  isErrno,
  looksLikeText,
  parseDirty,
  parseIndex,
  parseNul,
  processOutput,
} from "./local-history-support";
import type { RepositoryRegistry } from "./repository-registry";

export class LocalHistoryCapture {
  constructor(
    private readonly registry: RepositoryRegistry,
    private readonly runner: GitProcessRunnerLike,
    private readonly storage: LocalHistoryStorage,
  ) {}
  async captureState(
    repositoryId: RepositoryId,
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, FileState>> {
    const repository = this.registry.get(repositoryId);
    const [indexText, untrackedText, statusText] = await Promise.all([
      this.git(repository.path, ["ls-files", "--stage", "-z", "--"], signal),
      this.git(
        repository.path,
        ["ls-files", "--others", "--exclude-standard", "-z", "--"],
        signal,
      ),
      this.git(
        repository.path,
        ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--"],
        signal,
      ),
    ]);
    const indexed = parseIndex(indexText);
    const untracked = parseNul(untrackedText);
    const dirty = parseDirty(statusText);
    const paths = [...new Set([...indexed.keys(), ...untracked])].sort();
    const state = new Map<string, FileState>();
    for (const path of paths) {
      if (signal?.aborted === true)
        throw new GitUtilityError(
          "commandFailed",
          "Local History was cancelled",
        );
      const absolute = join(repository.path, ...path.split("/"));
      if (!contained(repository.path, absolute))
        throw invalid("Local History path escaped the project");
      let metadata;
      try {
        metadata = await lstat(absolute);
      } catch (error) {
        if (isErrno(error, "ENOENT")) continue;
        throw error;
      }
      if (!metadata.isFile() && !metadata.isSymbolicLink()) continue;
      const mode = metadata.mode & 0o777;
      let contentType: FileState["contentType"] = "binary";
      try {
        contentType =
          metadata.isSymbolicLink() ||
          isLocalHistoryTextPath(path) ||
          (await looksLikeText(absolute))
            ? "text"
            : "binary";
      } catch {
        contentType = "binary";
      }
      if (!dirty.has(path) && indexed.has(path)) {
        state.set(path, {
          kind: metadata.isSymbolicLink() ? "symlink" : "file",
          mode,
          contentType,
          content: { kind: "git", oid: indexed.get(path) ?? "" },
        });
        continue;
      }
      try {
        if (contentType === "binary") {
          state.set(path, {
            kind: "file",
            mode,
            contentType,
            content: { kind: "unavailable" },
          });
          continue;
        }
        const bytes = metadata.isSymbolicLink()
          ? Buffer.from(await readlink(absolute))
          : await readFile(absolute);
        const sha256 = await this.storage.writeBlob(bytes);
        state.set(path, {
          kind: metadata.isSymbolicLink() ? "symlink" : "file",
          mode,
          contentType,
          content: { kind: "blob", sha256 },
        });
      } catch {
        state.set(path, {
          kind: metadata.isSymbolicLink() ? "symlink" : "file",
          mode,
          contentType,
          content: { kind: "unavailable" },
        });
      }
    }
    return state;
  }

  async git(
    cwd: string,
    args: readonly string[],
    signal?: AbortSignal,
  ): Promise<string> {
    const outcome = await this.runner.run(
      {
        cwd,
        args,
        redactStdout: false,
        outputLimitBytes: 32 * 1024 * 1024,
      },
      signal,
    );
    if (outcome.kind !== "completed") throw commandFailure(outcome);
    return processOutput(outcome, "stdout");
  }

  async readContent(
    repositoryId: RepositoryId,
    state: OptionalFileState,
    signal?: AbortSignal,
  ): Promise<Buffer | null> {
    if (state === null) return Buffer.alloc(0);
    if (state.contentType === "binary") return null;
    if (state.content.kind === "unavailable") return null;
    if (state.content.kind === "blob") {
      return gunzipLocalHistory(
        await readFile(this.storage.blobPath(state.content.sha256)),
      );
    }
    const repository = this.registry.get(repositoryId);
    const outcome = await this.runner.run(
      {
        cwd: repository.path,
        args: ["cat-file", "blob", state.content.oid],
        redactStdout: false,
        outputLimitBytes: 256 * 1024 * 1024,
      },
      signal,
    );
    if (outcome.kind !== "completed") return null;
    return Buffer.from(processOutput(outcome, "stdout"), "utf8");
  }

  async restoreState(
    repositoryId: RepositoryId,
    path: string,
    state: OptionalFileState,
    signal?: AbortSignal,
  ): Promise<void> {
    const repository = this.registry.get(repositoryId);
    const safePath = GitRelativePathSchema.parse(path);
    const absolute = join(repository.path, ...safePath.split("/"));
    if (!contained(repository.path, absolute))
      throw invalid("Local History restore escaped the project");
    if (state === null) {
      await rm(absolute, { force: true });
      return;
    }
    const bytes = await this.readContent(repositoryId, state, signal);
    if (bytes === null)
      throw invalid(`Content for ${safePath} was not stored in Local History`);
    await mkdir(join(absolute, ".."), { recursive: true });
    const temporary = `${absolute}.local-history-${randomUUID()}`;
    if (state.kind === "symlink") {
      await symlink(bytes.toString("utf8"), temporary);
    } else {
      await writeFile(temporary, bytes, { mode: state.mode });
      await chmod(temporary, state.mode);
    }
    await rename(temporary, absolute);
  }
}
