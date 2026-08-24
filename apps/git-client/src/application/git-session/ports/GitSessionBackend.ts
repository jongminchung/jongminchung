import type {
  GitLocalHistoryActivitiesPage,
  GitLocalHistoryActivityDetail,
} from "../../../shared/contracts/git-utility";
import type {
  FileContent,
  FilePreview,
  FileSource,
  HistoryRewritePreview,
  PushPreview,
  RecoveryEntry,
  RepositorySnapshot,
  SubmoduleDiff,
} from "../../../shared/contracts/model/index";
import type { TerminalAvailability } from "../../terminal/ports/TerminalAvailability";

export type AsyncOperation<T> = () => Promise<T>;

export interface PushPreviewRequest {
  readonly snapshot: RepositorySnapshot;
  readonly remote: string | null;
  readonly remoteRef: string | null;
  readonly localRevision: string;
}

export interface HistoryRewritePreviewSource {
  readonly snapshot: RepositorySnapshot;
  readonly commits: readonly {
    readonly oid: string;
    readonly parents: readonly string[];
    readonly subject: string;
  }[];
  readonly ahead: number;
}

export interface HistoryRewritePreviewRequest {
  readonly repository: HistoryRewritePreviewSource | null;
  readonly fromRevision: string;
}

/** Owns repository lifecycle policy that differs between native and QA modes. */
export interface GitSessionRepositoryPort<Workspace = unknown> {
  initialWorkspace(): Promise<Workspace | null>;
  restore(operation: AsyncOperation<void>): Promise<void>;
  persist(operation: AsyncOperation<void>): Promise<void>;
  refresh(operation: AsyncOperation<void>): Promise<void>;
  watch(operation: AsyncOperation<void>): Promise<void>;
  assertActionsAllowed(): void;
  closeResources(
    unwatch: AsyncOperation<void>,
    closeTerminals: AsyncOperation<void>,
  ): Promise<void>;
}

/** Owns request and read-model behavior without leaking the selected adapter. */
export interface GitSessionQueryPort {
  executeRequest(
    requestKind: string,
    execute: AsyncOperation<string>,
  ): Promise<string>;
  commitFiles<T>(
    live: AsyncOperation<T>,
    fixture: AsyncOperation<T>,
  ): Promise<T>;
  diff(
    live: AsyncOperation<string>,
    fixture: AsyncOperation<string>,
  ): Promise<string>;
  tree<T>(live: AsyncOperation<readonly T[]>): Promise<readonly T[]>;
  files(live: AsyncOperation<readonly string[]>): Promise<readonly string[]>;
  search<T>(
    query: string,
    live: AsyncOperation<readonly T[]>,
  ): Promise<readonly T[]>;
  blame<T>(live: AsyncOperation<readonly T[]>): Promise<readonly T[]>;
  readFile(
    source: FileSource,
    path: string,
    live: AsyncOperation<FileContent>,
    fixture: AsyncOperation<FileContent>,
  ): Promise<FileContent>;
  readFilePreview(
    path: string,
    live: AsyncOperation<FilePreview>,
  ): Promise<FilePreview>;
  submoduleDiff(
    path: string,
    live: AsyncOperation<SubmoduleDiff>,
  ): Promise<SubmoduleDiff>;
  openWorkingTreeFile(live: AsyncOperation<void>): Promise<void>;
}

/** Owns commands with adapter-specific mutation and recovery semantics. */
export interface GitSessionMutationPort {
  readonly enabled: boolean;
  execute(operation: AsyncOperation<void>): Promise<void>;
  nativeOnly<T>(message: string, live: AsyncOperation<T>): Promise<T>;
  createShelf<T>(live: AsyncOperation<T>): Promise<T | null>;
  applyShelf(live: AsyncOperation<void>): Promise<boolean>;
  recoveryEntries(
    live: AsyncOperation<readonly RecoveryEntry[]>,
  ): Promise<readonly RecoveryEntry[]>;
}

/** Owns history/log fallbacks, including native-only local history APIs. */
export interface GitSessionHistoryPort {
  loadLog(operation: AsyncOperation<void>): Promise<void>;
  fileHistory<T>(
    live: AsyncOperation<readonly T[]>,
    fixture: AsyncOperation<readonly T[]>,
  ): Promise<readonly T[]>;
  stashFiles<T>(
    live: AsyncOperation<readonly T[]>,
    fixture: AsyncOperation<readonly T[]>,
  ): Promise<readonly T[]>;
  stashPatch(
    live: AsyncOperation<string>,
    fixture: AsyncOperation<string>,
  ): Promise<string>;
  listLocalActivities(
    live: AsyncOperation<GitLocalHistoryActivitiesPage>,
  ): Promise<GitLocalHistoryActivitiesPage>;
  readLocalActivity(
    live: AsyncOperation<GitLocalHistoryActivityDetail>,
  ): Promise<GitLocalHistoryActivityDetail>;
  localDiff(
    live: AsyncOperation<string>,
    fixture: AsyncOperation<string>,
  ): Promise<string>;
  nativeOnly<T>(message: string, live: AsyncOperation<T>): Promise<T>;
  loadPushPreview(
    request: PushPreviewRequest,
    live: AsyncOperation<PushPreview>,
  ): Promise<PushPreview>;
  loadHistoryRewritePreview(
    request: HistoryRewritePreviewRequest,
    live: AsyncOperation<HistoryRewritePreview>,
  ): Promise<HistoryRewritePreview>;
}

export interface GitSessionBackend<Workspace = unknown> {
  readonly kind: "live" | "fixture";
  readonly fixtureMode: boolean;
  readonly terminal: TerminalAvailability;
  readonly repository: GitSessionRepositoryPort<Workspace>;
  readonly queries: GitSessionQueryPort;
  readonly mutations: GitSessionMutationPort;
  readonly history: GitSessionHistoryPort;
}
