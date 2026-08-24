import { z } from "zod";
import type { mutation, query } from "../desktop-trpc";
import {
  FileContentSchema,
  FilePreviewSchema,
  GitCloneRepositoryRequestSchema,
  GitCreationCancelledEventSchema,
  GitCreationCompletedEventSchema,
  GitCreationFailedEventSchema,
  GitExecutionRequestSchema,
  GitInitializeRepositoryRequestSchema,
  GitReadFileRequestSchema,
  GitRepositoryServiceRequestSchema,
  GitRepositoryServiceResultSchema,
  GitWatchRepositoryRequestSchema,
  GitWorkingTreeFileRequestSchema,
  GitWriteWorkingTreeFileRequestSchema,
  OpenRepositoryRequestSchema,
  RepositoryRecordSchema,
  RepositorySnapshotSchema,
} from "../git-utility";
import {
  GitCancelQueryRequestSchema,
  GitCloseRepositoryRequestSchema,
  GitRepositoryRequestSchema,
  GitTerminalResultSchema,
} from "../ipc";

const VoidSchema = z.void();
const BooleanSchema = z.boolean();
const TRUSTED_AUTHORIZATION = { kind: "trusted" } as const;
const GitCreationTerminalResultSchema = z.discriminatedUnion("kind", [
  GitCreationCompletedEventSchema,
  GitCreationFailedEventSchema,
  GitCreationCancelledEventSchema,
]);

/** Git owns all repository wire contracts and their capability policy. */
export function createGitProcedures(
  createMutation: typeof mutation,
  createQuery: typeof query,
) {
  return {
    openRepository: createMutation(
      "git",
      "openRepository",
      OpenRepositoryRequestSchema,
      RepositoryRecordSchema,
      TRUSTED_AUTHORIZATION,
    ),
    initializeRepository: createMutation(
      "git",
      "initializeRepository",
      GitInitializeRepositoryRequestSchema,
      GitCreationTerminalResultSchema,
      { kind: "activeCapability", capability: "gitMutation" },
    ),
    cloneRepository: createMutation(
      "git",
      "cloneRepository",
      GitCloneRepositoryRequestSchema,
      GitCreationTerminalResultSchema,
      { kind: "activeCapability", capability: "gitMutation" },
    ),
    closeRepository: createMutation(
      "git",
      "closeRepository",
      GitCloseRepositoryRequestSchema,
      BooleanSchema,
      TRUSTED_AUTHORIZATION,
    ),
    inspectSnapshot: createQuery(
      "git",
      "inspectSnapshot",
      GitRepositoryRequestSchema,
      RepositorySnapshotSchema,
      TRUSTED_AUTHORIZATION,
    ),
    repositoryService: createMutation(
      "git",
      "repositoryService",
      GitRepositoryServiceRequestSchema,
      GitRepositoryServiceResultSchema,
      { kind: "repositoryCapability", capability: "gitMutation" },
    ),
    query: createMutation(
      "git",
      "query",
      GitExecutionRequestSchema,
      GitTerminalResultSchema,
      { kind: "repositoryCapability", capability: "gitMutation" },
    ),
    cancelQuery: createMutation(
      "git",
      "cancelQuery",
      GitCancelQueryRequestSchema,
      BooleanSchema,
      TRUSTED_AUTHORIZATION,
    ),
    readFile: createQuery(
      "git",
      "readFile",
      GitReadFileRequestSchema,
      FileContentSchema,
      TRUSTED_AUTHORIZATION,
    ),
    readFilePreview: createQuery(
      "git",
      "readFilePreview",
      GitReadFileRequestSchema,
      FilePreviewSchema,
      TRUSTED_AUTHORIZATION,
    ),
    writeWorkingTreeFile: createMutation(
      "git",
      "writeWorkingTreeFile",
      GitWriteWorkingTreeFileRequestSchema,
      VoidSchema,
      { kind: "repositoryCapability", capability: "gitMutation" },
    ),
    openWorkingTreeFile: createMutation(
      "git",
      "openWorkingTreeFile",
      GitWorkingTreeFileRequestSchema,
      VoidSchema,
      { kind: "repositoryCapability", capability: "externalExecution" },
    ),
    watchRepository: createMutation(
      "git",
      "watchRepository",
      GitWatchRepositoryRequestSchema,
      VoidSchema,
      TRUSTED_AUTHORIZATION,
    ),
    unwatchRepository: createMutation(
      "git",
      "unwatchRepository",
      GitWatchRepositoryRequestSchema,
      VoidSchema,
      TRUSTED_AUTHORIZATION,
    ),
  } as const;
}
