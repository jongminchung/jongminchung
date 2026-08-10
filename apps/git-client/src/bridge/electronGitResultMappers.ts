import type {
  GitRequestEvent,
  GitPatchExportResult as ElectronPatchExportResult,
  GitShelfEntry as ElectronShelfEntry,
  GitChangelist as ElectronChangelist,
  GitChangelistCommitResult as ElectronChangelistCommitResult,
  GitRecoveryEntry as ElectronRecoveryEntry,
  GitRecoveryRestoreResult as ElectronRecoveryRestoreResult,
  GitConflictFile as ElectronConflictFile,
  GitConflictContent as ElectronConflictContent,
  GitSubmoduleDiff as ElectronSubmoduleDiff,
  GitMultiRootOutcome as ElectronMultiRootOutcome,
  GitMultiRootResult as ElectronMultiRootResult,
} from "../shared/contracts/git-utility";
import type {
  Changelist,
  ChangelistCommitResult,
  ConflictContent,
  ConflictFile,
  GitEvent,
  GitOperation,
  MultiRootOutcome,
  MultiRootResult,
  PatchExportResult,
  RecoveryEntry,
  RecoveryRestoreResult,
  ShelfEntry,
  SubmoduleDiff,
} from "../shared/contracts/model";

export function asGeneratedEvent(event: GitRequestEvent): GitEvent {
  switch (event.kind) {
    case "started":
    case "output":
    case "completed":
      return event;
    case "failed":
      return {
        kind: "failed",
        requestId: event.requestId,
        message: event.message,
        exitCode: event.exitCode,
        durationMs: event.durationMs,
      };
    case "cancelled":
      return {
        kind: "cancelled",
        requestId: event.requestId,
        durationMs: event.durationMs,
      };
  }
}

export function asPatchExportResult(result: ElectronPatchExportResult): PatchExportResult {
  return { ...result };
}

export function asShelfEntry(entry: ElectronShelfEntry): ShelfEntry {
  return {
    ...entry,
    files: entry.files.map((file) => ({ ...file })),
  };
}

export function asChangelist(changelist: ElectronChangelist): Changelist {
  return { ...changelist, paths: [...changelist.paths] };
}

export function asChangelistCommitResult(
  result: ElectronChangelistCommitResult,
): ChangelistCommitResult {
  return { ...result };
}

export function asRecoveryEntry(entry: ElectronRecoveryEntry): RecoveryEntry {
  return {
    ...entry,
    refs: entry.refs.map((reference) => ({ ...reference })),
  };
}

export function asRecoveryRestoreResult(
  result: ElectronRecoveryRestoreResult,
): RecoveryRestoreResult {
  return { ...result, restoredRefs: [...result.restoredRefs] };
}

export function asConflictFile(file: ElectronConflictFile): ConflictFile {
  return { ...file };
}

export function asConflictContent(content: ElectronConflictContent): ConflictContent {
  return { ...content };
}

export function asSubmoduleDiff(diff: ElectronSubmoduleDiff): SubmoduleDiff {
  return { ...diff };
}

export function asMultiRootOutcome(outcome: ElectronMultiRootOutcome): MultiRootOutcome {
  return { ...outcome };
}

export function asRollbackOperation(
  operation: ElectronMultiRootResult["rollbackPlan"][number]["operations"][number],
): GitOperation {
  if (operation.kind === "checkout") return { ...operation };
  return { ...operation };
}

export function asMultiRootResult(result: ElectronMultiRootResult): MultiRootResult {
  return {
    outcomes: result.outcomes.map(asMultiRootOutcome),
    rollbackPlan: result.rollbackPlan.map((step) => ({
      ...step,
      operations: step.operations.map(asRollbackOperation),
    })),
  };
}
