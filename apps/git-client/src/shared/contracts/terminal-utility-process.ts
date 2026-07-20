import { z } from "zod";
import { RepositoryIdSchema } from "./git-utility";
import {
  DEFAULT_TERMINAL_LAUNCH_TARGET,
  TerminalCloseRepositoryRequestSchema,
  TerminalCloseRequestSchema,
  TerminalColumnsSchema,
  TerminalCreateResultSchema,
  TerminalEventEnvelopeSchema,
  TerminalLaunchTargetSchema,
  TerminalLaunchTargetsSchema,
  TerminalResizeRequestSchema,
  TerminalRowsSchema,
  TerminalWriteRequestSchema,
  TerminalRequestIdSchema,
} from "./terminal";

export const TERMINAL_UTILITY_PROTOCOL_VERSION = 1;
export const TERMINAL_UTILITY_HANDSHAKE_TIMEOUT_MS = 10_000;

export const TerminalUtilityCorrelationIdSchema = z.uuid();
export type TerminalUtilityCorrelationId = z.infer<typeof TerminalUtilityCorrelationIdSchema>;

export const TerminalUtilityCreateSpecSchema = z
  .object({
    requestId: TerminalRequestIdSchema,
    repositoryId: RepositoryIdSchema,
    cwd: z
      .string()
      .min(1)
      .max(16_384)
      .refine((value) => !value.includes("\0")),
    cols: TerminalColumnsSchema,
    rows: TerminalRowsSchema,
    target: TerminalLaunchTargetSchema.default(DEFAULT_TERMINAL_LAUNCH_TARGET),
  })
  .strict()
  .readonly();
export type TerminalUtilityCreateSpec = Readonly<z.infer<typeof TerminalUtilityCreateSpecSchema>>;

const CorrelatedMessageSchema = {
  correlationId: TerminalUtilityCorrelationIdSchema,
} as const;

export const MainToTerminalUtilityMessageSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("handshake"),
        ...CorrelatedMessageSchema,
        protocolVersion: z.number().int().nonnegative(),
        instanceId: z.uuid(),
      })
      .strict(),
    z
      .object({
        kind: z.literal("create"),
        ...CorrelatedMessageSchema,
        request: TerminalUtilityCreateSpecSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("listLaunchTargets"),
        ...CorrelatedMessageSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("write"),
        ...CorrelatedMessageSchema,
        request: TerminalWriteRequestSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("resize"),
        ...CorrelatedMessageSchema,
        request: TerminalResizeRequestSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("close"),
        ...CorrelatedMessageSchema,
        request: TerminalCloseRequestSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("closeRepository"),
        ...CorrelatedMessageSchema,
        request: TerminalCloseRepositoryRequestSchema,
      })
      .strict(),
    z.object({ kind: z.literal("dispose"), ...CorrelatedMessageSchema }).strict(),
  ])
  .readonly();
export type MainToTerminalUtilityMessage = Readonly<
  z.infer<typeof MainToTerminalUtilityMessageSchema>
>;

export const TerminalUtilityErrorCodeSchema = z.enum([
  "invalidMessage",
  "invalidRequest",
  "sessionNotFound",
  "spawnFailed",
  "internalError",
  "unsupportedProtocol",
]);
export type TerminalUtilityErrorCode = z.infer<typeof TerminalUtilityErrorCodeSchema>;

export const TerminalUtilityToMainMessageSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("ready"),
        protocolVersion: z.literal(TERMINAL_UTILITY_PROTOCOL_VERSION),
        instanceId: z.uuid(),
      })
      .strict(),
    z
      .object({
        kind: z.literal("handshakeAck"),
        ...CorrelatedMessageSchema,
        protocolVersion: z.literal(TERMINAL_UTILITY_PROTOCOL_VERSION),
        instanceId: z.uuid(),
      })
      .strict(),
    z
      .object({
        kind: z.literal("createResult"),
        ...CorrelatedMessageSchema,
        result: TerminalCreateResultSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("listLaunchTargetsResult"),
        ...CorrelatedMessageSchema,
        targets: TerminalLaunchTargetsSchema,
      })
      .strict(),
    z.object({ kind: z.literal("writeResult"), ...CorrelatedMessageSchema }).strict(),
    z.object({ kind: z.literal("resizeResult"), ...CorrelatedMessageSchema }).strict(),
    z.object({ kind: z.literal("closeResult"), ...CorrelatedMessageSchema }).strict(),
    z
      .object({
        kind: z.literal("closeRepositoryResult"),
        ...CorrelatedMessageSchema,
        closed: z.number().int().nonnegative(),
      })
      .strict(),
    z.object({ kind: z.literal("disposeResult"), ...CorrelatedMessageSchema }).strict(),
    z
      .object({
        kind: z.literal("terminalEvent"),
        event: TerminalEventEnvelopeSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("error"),
        correlationId: TerminalUtilityCorrelationIdSchema.nullable(),
        code: TerminalUtilityErrorCodeSchema,
        message: z.string().min(1).max(4_096),
      })
      .strict(),
  ])
  .readonly();
export type TerminalUtilityToMainMessage = Readonly<
  z.infer<typeof TerminalUtilityToMainMessageSchema>
>;
