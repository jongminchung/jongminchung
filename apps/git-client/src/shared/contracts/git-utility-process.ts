import { z } from "zod";
import {
  GitCloneRepositoryRequestSchema,
  GitCreationEventSchema,
  GIT_EVENT_CHUNK_CHARACTERS,
  GitFailureCodeSchema,
  FileContentSchema,
  FilePreviewSchema,
  GitReadFileRequestSchema,
  GitWriteWorkingTreeFileRequestSchema,
  GitRepositoryServiceRequestSchema,
  GitRepositoryServiceResultSchema,
  GitInitializeRepositoryRequestSchema,
  GitExecutionRequestSchema,
  GitRequestEventSchema,
  GitRequestIdSchema,
  OpenRepositoryRequestSchema,
  RepositoryIdSchema,
  RepositoryChangedEventSchema,
  RepositoryRecordSchema,
  RepositorySnapshotSchema,
} from "./git-utility";

export const GIT_UTILITY_PROTOCOL_VERSION = 8;
export const GIT_UTILITY_HANDSHAKE_TIMEOUT_MS = 10_000;
export const GIT_UTILITY_EVENT_CHUNK_CHARACTERS = GIT_EVENT_CHUNK_CHARACTERS;
export const GIT_UTILITY_STORAGE_ROOT_ARGUMENT = "--git-client-storage-root";

export const GitUtilityStorageRootSchema = z
  .string()
  .min(1)
  .max(16_384)
  .refine(
    (value) =>
      !value.includes("\0") &&
      (value.startsWith("/") ||
        /^[A-Za-z]:[\\/]/u.test(value) ||
        /^\\\\[^\\/]+[\\/][^\\/]+/u.test(value)),
    "Git utility storage root must be absolute",
  );

export const UtilityCorrelationIdSchema = z.uuid();
export type UtilityCorrelationId = z.infer<typeof UtilityCorrelationIdSchema>;

const CorrelatedMessageSchema = {
  correlationId: UtilityCorrelationIdSchema,
} as const;

export const UtilityHandshakeRequestSchema = z.object({
  kind: z.literal("handshake"),
  ...CorrelatedMessageSchema,
  protocolVersion: z.number().int().nonnegative(),
  instanceId: z.uuid(),
});

export const UtilityOpenRepositoryMessageSchema = z.object({
  kind: z.literal("openRepository"),
  ...CorrelatedMessageSchema,
  request: OpenRepositoryRequestSchema,
});

export const UtilityInitializeRepositoryMessageSchema = z.object({
  kind: z.literal("initializeRepository"),
  ...CorrelatedMessageSchema,
  request: GitInitializeRepositoryRequestSchema,
});

export const UtilityCloneRepositoryMessageSchema = z.object({
  kind: z.literal("cloneRepository"),
  ...CorrelatedMessageSchema,
  request: GitCloneRepositoryRequestSchema,
});

export const UtilityCloseRepositoryMessageSchema = z.object({
  kind: z.literal("closeRepository"),
  ...CorrelatedMessageSchema,
  repositoryId: RepositoryIdSchema,
});

export const UtilityInspectSnapshotMessageSchema = z
  .object({
    kind: z.literal("inspectSnapshot"),
    ...CorrelatedMessageSchema,
    repositoryId: RepositoryIdSchema,
  })
  .strict();

export const UtilityRepositoryServiceMessageSchema = z
  .object({
    kind: z.literal("repositoryService"),
    ...CorrelatedMessageSchema,
    request: GitRepositoryServiceRequestSchema,
  })
  .strict();

export const UtilityQueryMessageSchema = z
  .object({
    kind: z.literal("query"),
    ...CorrelatedMessageSchema,
    request: GitExecutionRequestSchema,
  })
  .strict();

export const UtilityReadFileMessageSchema = z.object({
  kind: z.literal("readFile"),
  ...CorrelatedMessageSchema,
  request: GitReadFileRequestSchema,
});

export const UtilityReadFilePreviewMessageSchema = z.object({
  kind: z.literal("readFilePreview"),
  ...CorrelatedMessageSchema,
  request: GitReadFileRequestSchema,
});

export const UtilityWriteWorkingTreeFileMessageSchema = z.object({
  kind: z.literal("writeWorkingTreeFile"),
  ...CorrelatedMessageSchema,
  request: GitWriteWorkingTreeFileRequestSchema,
});

export const UtilityWatchRepositoryMessageSchema = z.object({
  kind: z.literal("watchRepository"),
  ...CorrelatedMessageSchema,
  repositoryId: RepositoryIdSchema,
});

export const UtilityUnwatchRepositoryMessageSchema = z.object({
  kind: z.literal("unwatchRepository"),
  ...CorrelatedMessageSchema,
  repositoryId: RepositoryIdSchema,
});

export const UtilityCancelMessageSchema = z
  .object({
    kind: z.literal("cancel"),
    ...CorrelatedMessageSchema,
    requestId: GitRequestIdSchema,
  })
  .strict();

export const UtilityDisposeMessageSchema = z.object({
  kind: z.literal("dispose"),
  ...CorrelatedMessageSchema,
});

export const MainToGitUtilityMessageSchema = z
  .discriminatedUnion("kind", [
    UtilityHandshakeRequestSchema,
    UtilityOpenRepositoryMessageSchema,
    UtilityInitializeRepositoryMessageSchema,
    UtilityCloneRepositoryMessageSchema,
    UtilityCloseRepositoryMessageSchema,
    UtilityInspectSnapshotMessageSchema,
    UtilityRepositoryServiceMessageSchema,
    UtilityQueryMessageSchema,
    UtilityReadFileMessageSchema,
    UtilityReadFilePreviewMessageSchema,
    UtilityWriteWorkingTreeFileMessageSchema,
    UtilityWatchRepositoryMessageSchema,
    UtilityUnwatchRepositoryMessageSchema,
    UtilityCancelMessageSchema,
    UtilityDisposeMessageSchema,
  ])
  .readonly();
export type MainToGitUtilityMessage = Readonly<z.infer<typeof MainToGitUtilityMessageSchema>>;

export const UtilityReadyMessageSchema = z.object({
  kind: z.literal("ready"),
  protocolVersion: z.literal(GIT_UTILITY_PROTOCOL_VERSION),
  instanceId: z.uuid(),
});

export const UtilityHandshakeAckMessageSchema = z.object({
  kind: z.literal("handshakeAck"),
  ...CorrelatedMessageSchema,
  protocolVersion: z.literal(GIT_UTILITY_PROTOCOL_VERSION),
  instanceId: z.uuid(),
});

export const UtilityOpenRepositoryResultSchema = z.object({
  kind: z.literal("openRepositoryResult"),
  ...CorrelatedMessageSchema,
  repository: RepositoryRecordSchema,
});

export const UtilityCloseRepositoryResultSchema = z.object({
  kind: z.literal("closeRepositoryResult"),
  ...CorrelatedMessageSchema,
  closed: z.boolean(),
});

export const UtilityInspectSnapshotResultSchema = z
  .object({
    kind: z.literal("inspectSnapshotResult"),
    ...CorrelatedMessageSchema,
    snapshot: RepositorySnapshotSchema,
  })
  .strict();

export const UtilityRepositoryServiceResultSchema = z
  .object({
    kind: z.literal("repositoryServiceResult"),
    ...CorrelatedMessageSchema,
    result: GitRepositoryServiceResultSchema,
  })
  .strict();

export const UtilityCancelResultSchema = z.object({
  kind: z.literal("cancelResult"),
  ...CorrelatedMessageSchema,
  cancelled: z.boolean(),
});

export const UtilityReadFileResultSchema = z.object({
  kind: z.literal("readFileResult"),
  ...CorrelatedMessageSchema,
  content: FileContentSchema,
});

export const UtilityReadFilePreviewResultSchema = z.object({
  kind: z.literal("readFilePreviewResult"),
  ...CorrelatedMessageSchema,
  preview: FilePreviewSchema,
});

export const UtilityWriteWorkingTreeFileResultSchema = z.object({
  kind: z.literal("writeWorkingTreeFileResult"),
  ...CorrelatedMessageSchema,
});

export const UtilityWatchRepositoryResultSchema = z.object({
  kind: z.literal("watchRepositoryResult"),
  ...CorrelatedMessageSchema,
  repositoryId: RepositoryIdSchema,
});

export const UtilityUnwatchRepositoryResultSchema = z.object({
  kind: z.literal("unwatchRepositoryResult"),
  ...CorrelatedMessageSchema,
  repositoryId: RepositoryIdSchema,
});

export const UtilityRepositoryChangedMessageSchema = z.object({
  kind: z.literal("repositoryChanged"),
  event: RepositoryChangedEventSchema,
});

export const UtilityDisposeResultSchema = z.object({
  kind: z.literal("disposeResult"),
  ...CorrelatedMessageSchema,
});

export const UtilityQueryEventMessageSchema = z
  .object({
    kind: z.literal("queryEvent"),
    ...CorrelatedMessageSchema,
    event: GitRequestEventSchema,
  })
  .strict();

export const UtilityCreationEventMessageSchema = z.object({
  kind: z.literal("creationEvent"),
  ...CorrelatedMessageSchema,
  event: GitCreationEventSchema,
});

export const GitUtilityProtocolErrorCodeSchema = z.union([
  GitFailureCodeSchema,
  z.enum(["invalidMessage", "invalidRequest", "internalError", "unsupportedProtocol"]),
]);
export type GitUtilityProtocolErrorCode = z.infer<typeof GitUtilityProtocolErrorCodeSchema>;

export const UtilityErrorMessageSchema = z.object({
  kind: z.literal("error"),
  correlationId: UtilityCorrelationIdSchema.nullable(),
  code: GitUtilityProtocolErrorCodeSchema,
  message: z.string().min(1).max(4_096),
});

export const GitUtilityToMainMessageSchema = z
  .discriminatedUnion("kind", [
    UtilityReadyMessageSchema,
    UtilityHandshakeAckMessageSchema,
    UtilityOpenRepositoryResultSchema,
    UtilityCloseRepositoryResultSchema,
    UtilityInspectSnapshotResultSchema,
    UtilityRepositoryServiceResultSchema,
    UtilityCancelResultSchema,
    UtilityReadFileResultSchema,
    UtilityReadFilePreviewResultSchema,
    UtilityWriteWorkingTreeFileResultSchema,
    UtilityWatchRepositoryResultSchema,
    UtilityUnwatchRepositoryResultSchema,
    UtilityRepositoryChangedMessageSchema,
    UtilityDisposeResultSchema,
    UtilityQueryEventMessageSchema,
    UtilityCreationEventMessageSchema,
    UtilityErrorMessageSchema,
  ])
  .superRefine((message, context) => {
    if (
      (message.kind === "queryEvent" || message.kind === "creationEvent") &&
      message.event.kind === "output" &&
      message.event.data.length > GIT_UTILITY_EVENT_CHUNK_CHARACTERS
    ) {
      context.addIssue({
        code: "too_big",
        origin: "string",
        maximum: GIT_UTILITY_EVENT_CHUNK_CHARACTERS,
        inclusive: true,
        path: ["event", "data"],
        message: "Git utility output event exceeds the transport chunk limit",
      });
    }
  })
  .readonly();
export type GitUtilityToMainMessage = Readonly<z.infer<typeof GitUtilityToMainMessageSchema>>;

export type UtilityReadyMessage = Extract<GitUtilityToMainMessage, Readonly<{ kind: "ready" }>>;
export type UtilityHandshakeAckMessage = Extract<
  GitUtilityToMainMessage,
  Readonly<{ kind: "handshakeAck" }>
>;
export type UtilityOpenRepositoryResult = Extract<
  GitUtilityToMainMessage,
  Readonly<{ kind: "openRepositoryResult" }>
>;
export type UtilityCloseRepositoryResult = Extract<
  GitUtilityToMainMessage,
  Readonly<{ kind: "closeRepositoryResult" }>
>;
export type UtilityCancelResult = Extract<
  GitUtilityToMainMessage,
  Readonly<{ kind: "cancelResult" }>
>;
export type UtilityDisposeResult = Extract<
  GitUtilityToMainMessage,
  Readonly<{ kind: "disposeResult" }>
>;
