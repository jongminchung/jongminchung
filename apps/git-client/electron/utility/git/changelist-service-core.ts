import { isUtf8 } from "node:buffer";
import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import type { RepositoryId, RepositoryRecord } from "../../../src/shared/contracts/git-utility";
import type {
  Changelist,
  ChangelistCommitOptions,
  ChangelistCommitResult,
} from "../../../src/shared/contracts/model";
import {
  MANIFEST_DIRECTORY,
  MANIFEST_VERSION,
  MAX_CHANGELIST_MANIFEST_BYTES,
  MAX_CHANGELISTS,
  MAX_GIT_DIAGNOSTIC_BYTES,
  assertNotAborted,
  checksum,
  cloneChangelist,
  clonePayload,
  encodedManifest,
  invalid,
  payloadBytes,
  validateChangelistId,
  validateCommitOptions,
  validatePayload,
  validateRepositoryId,
  validateSaveInput,
  type ChangelistRepositoryRegistryLike,
  type ManifestPayload,
  type PinnedDirectory,
} from "./changelist-foundation";
import {
  assertPinnedDirectory,
  atomicWriteContainedFile,
  ensureChildDirectory,
  ensureStorageRoot,
  optionalChildDirectory,
  readContainedFile,
} from "./changelist-storage";
import {
  RepositoryMutex,
  backupIndex,
  captureGit,
  captureHead,
  equalEntries,
  parseIndexEntries,
  parseNulPaths,
  parsedObjectId,
  pinRepository,
  rollbackTransaction,
} from "./changelist-transaction";
import { GitUtilityError } from "./git-error";
import { PatchProcessRunner, type PatchProcessRunnerLike } from "./patch-service";

export class ChangelistService {
  readonly #registry: ChangelistRepositoryRegistryLike;
  readonly #storageRoot: string;
  readonly #runner: PatchProcessRunnerLike;
  readonly #mutex = new RepositoryMutex();

  private constructor(
    registry: ChangelistRepositoryRegistryLike,
    storageRoot: string,
    runner: PatchProcessRunnerLike,
  ) {
    if (
      typeof storageRoot !== "string" ||
      storageRoot.length === 0 ||
      storageRoot.length > 16_384 ||
      storageRoot.includes("\0") ||
      !isAbsolute(storageRoot)
    ) {
      throw invalid("Changelist storage root must be an absolute path");
    }
    this.#registry = registry;
    this.#storageRoot = storageRoot;
    this.#runner = runner;
  }

  static of(
    registry: ChangelistRepositoryRegistryLike,
    storageRoot: string,
    runner: PatchProcessRunnerLike = new PatchProcessRunner(),
  ): ChangelistService {
    return new ChangelistService(registry, storageRoot, runner);
  }

  async list(repositoryId: RepositoryId, signal?: AbortSignal): Promise<readonly Changelist[]> {
    const validatedRepositoryId = validateRepositoryId(repositoryId);
    return this.#mutex.run(validatedRepositoryId, signal, async () => {
      this.#repository(validatedRepositoryId);
      const manifest = await this.#readManifest(validatedRepositoryId, false);
      const entries = manifest.changelists.map(cloneChangelist);
      entries.sort((left, right) => left.createdAtMs - right.createdAtMs);
      return Object.freeze(entries);
    });
  }

  async save(
    repositoryId: RepositoryId,
    id: string | null,
    name: string,
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<Changelist> {
    const validatedRepositoryId = validateRepositoryId(repositoryId);
    const input = validateSaveInput(id, name, paths);
    return this.#mutex.run(validatedRepositoryId, signal, async () => {
      this.#repository(validatedRepositoryId);
      const manifest = await this.#readManifest(validatedRepositoryId, true);
      const now = Date.now();
      let saved: Changelist;
      let changelists: Changelist[];
      if (input.id === null) {
        if (manifest.changelists.length >= MAX_CHANGELISTS) {
          throw new GitUtilityError(
            "outputLimit",
            `A repository cannot contain more than ${MAX_CHANGELISTS} changelists`,
          );
        }
        saved = {
          id: randomUUID(),
          repositoryId: validatedRepositoryId,
          name: input.name,
          paths: [...input.paths],
          createdAtMs: now,
          updatedAtMs: now,
        };
        changelists = [...manifest.changelists.map(cloneChangelist), saved];
      } else {
        const index = manifest.changelists.findIndex((entry) => entry.id === input.id);
        if (index < 0) throw invalid("Changelist does not exist");
        const existing = manifest.changelists[index];
        if (existing === undefined) throw invalid("Changelist does not exist");
        const updatedAtMs = Math.max(now, existing.createdAtMs, existing.updatedAtMs);
        saved = {
          ...existing,
          name: input.name,
          paths: [...input.paths],
          updatedAtMs,
        };
        changelists = manifest.changelists.map((entry, entryIndex) =>
          entryIndex === index ? saved : cloneChangelist(entry),
        );
      }
      await this.#writeManifest(
        {
          version: MANIFEST_VERSION,
          repositoryId: validatedRepositoryId,
          changelists,
        },
        signal,
      );
      return cloneChangelist(saved);
    });
  }

  async delete(
    repositoryId: RepositoryId,
    changelistId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const validatedRepositoryId = validateRepositoryId(repositoryId);
    const validatedChangelistId = validateChangelistId(changelistId);
    await this.#mutex.run(validatedRepositoryId, signal, async () => {
      this.#repository(validatedRepositoryId);
      const manifest = await this.#readManifest(validatedRepositoryId, true);
      await this.#writeManifest(
        {
          ...manifest,
          changelists: manifest.changelists
            .filter((entry) => entry.id !== validatedChangelistId)
            .map(cloneChangelist),
        },
        signal,
      );
    });
  }

  async commit(
    repositoryId: RepositoryId,
    changelistId: string,
    options: ChangelistCommitOptions,
    signal?: AbortSignal,
  ): Promise<ChangelistCommitResult> {
    const validatedRepositoryId = validateRepositoryId(repositoryId);
    const validatedChangelistId = validateChangelistId(changelistId);
    const validatedOptions = validateCommitOptions(options);
    return this.#mutex.run(validatedRepositoryId, signal, async () => {
      const repository = this.#repository(validatedRepositoryId);
      const repositoryRoot = await pinRepository(repository);
      const manifest = await this.#readManifest(validatedRepositoryId, true);
      const changelist = manifest.changelists.find((entry) => entry.id === validatedChangelistId);
      if (changelist === undefined) throw invalid("Changelist does not exist");
      if (changelist.paths.length === 0) throw invalid("Changelist has no files");

      const originalHead = await captureHead(this.#runner, repository, signal);
      const indexBackup = await backupIndex(this.#runner, repository, signal);
      const unselectedBefore = parseIndexEntries(
        await captureGit(this.#runner, repository, ["ls-files", "--stage", "-z"], signal),
        changelist.paths,
      );

      try {
        const untracked = parseNulPaths(
          await captureGit(
            this.#runner,
            repository,
            ["ls-files", "--others", "--exclude-standard", "-z", "--", ...changelist.paths],
            signal,
          ),
        );
        if (untracked.length > 0) {
          await captureGit(
            this.#runner,
            repository,
            ["add", "--intent-to-add", "--", ...untracked],
            signal,
            MAX_GIT_DIAGNOSTIC_BYTES,
          );
        }
        const arguments_: string[] = ["commit", "--only", "--message", validatedOptions.message];
        if (validatedOptions.amend) arguments_.push("--amend");
        if (validatedOptions.signOff) arguments_.push("--signoff");
        if (validatedOptions.gpgSign) arguments_.push("--gpg-sign");
        arguments_.push("--", ...changelist.paths);
        await captureGit(this.#runner, repository, arguments_, signal, MAX_GIT_DIAGNOSTIC_BYTES);
        assertNotAborted(signal);
        await assertPinnedDirectory(repositoryRoot, "Repository root");
        const commitOid = parsedObjectId(
          await captureGit(
            this.#runner,
            repository,
            ["rev-parse", "--verify", "HEAD"],
            signal,
            64 * 1024,
          ),
          "the changelist commit",
        );
        const unselectedAfter = parseIndexEntries(
          await captureGit(this.#runner, repository, ["ls-files", "--stage", "-z"], signal),
          changelist.paths,
        );
        if (!equalEntries(unselectedBefore, unselectedAfter)) {
          throw new GitUtilityError(
            "commandFailed",
            "Selected changelist commit changed unrelated index entries",
          );
        }
        await this.#writeManifest(
          {
            ...manifest,
            changelists: manifest.changelists
              .filter((entry) => entry.id !== validatedChangelistId)
              .map(cloneChangelist),
          },
          signal,
        );
        return { changelistId: validatedChangelistId, commitOid };
      } catch (error) {
        return rollbackTransaction(this.#runner, repository, originalHead, indexBackup, error);
      }
    });
  }

  #repository(repositoryId: RepositoryId): RepositoryRecord {
    const repository = this.#registry.get(repositoryId);
    if (repository.id !== repositoryId) {
      throw new GitUtilityError("repositoryNotOpen", "Repository registry identity changed");
    }
    return repository;
  }

  async #manifestDirectory(create: boolean): Promise<PinnedDirectory | null> {
    const root = await ensureStorageRoot(this.#storageRoot);
    return create
      ? ensureChildDirectory(root, MANIFEST_DIRECTORY, "Changelist directory")
      : optionalChildDirectory(root, MANIFEST_DIRECTORY, "Changelist directory");
  }

  async #readManifest(
    repositoryId: RepositoryId,
    createDirectory: boolean,
  ): Promise<ManifestPayload> {
    const directory = await this.#manifestDirectory(createDirectory);
    if (directory === null) {
      return {
        version: MANIFEST_VERSION,
        repositoryId,
        changelists: [],
      };
    }
    const bytes = await readContainedFile(
      directory,
      `${repositoryId}.json`,
      MAX_CHANGELIST_MANIFEST_BYTES,
      "Changelist manifest",
    );
    if (bytes.kind === "missing") {
      return {
        version: MANIFEST_VERSION,
        repositoryId,
        changelists: [],
      };
    }
    if (!isUtf8(bytes.bytes)) {
      throw invalid("Changelist manifest must be UTF-8 JSON");
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(bytes.bytes.toString("utf8")) as unknown;
    } catch {
      throw invalid("Changelist manifest is not valid JSON");
    }
    return validatePayload(decoded, repositoryId);
  }

  async #writeManifest(payload: ManifestPayload, signal: AbortSignal | undefined): Promise<void> {
    const directory = await this.#manifestDirectory(true);
    if (directory === null) throw invalid("Unable to create changelist directory");
    const bytes = encodedManifest(clonePayload(payload));
    await atomicWriteContainedFile(directory, `${payload.repositoryId}.json`, bytes, signal);
    const persisted = await this.#readManifest(payload.repositoryId, false);
    if (checksum(payloadBytes(persisted)) !== checksum(payloadBytes(payload))) {
      throw invalid("Changelist manifest failed semantic verification");
    }
  }
}
