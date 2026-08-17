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
        ),
        inspectSnapshot: createQuery(
            "git",
            "inspectSnapshot",
            GitRepositoryRequestSchema,
            RepositorySnapshotSchema,
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
        ),
        readFile: createQuery(
            "git",
            "readFile",
            GitReadFileRequestSchema,
            FileContentSchema,
        ),
        readFilePreview: createQuery(
            "git",
            "readFilePreview",
            GitReadFileRequestSchema,
            FilePreviewSchema,
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
        ),
        unwatchRepository: createMutation(
            "git",
            "unwatchRepository",
            GitWatchRepositoryRequestSchema,
            VoidSchema,
        ),
    } as const;
}
