import { z } from "zod";
import { RepositoryIdSchema } from "./git-utility";

export const TERMINAL_OUTPUT_CHUNK_BYTES = 32 * 1024;
export const TERMINAL_INPUT_LIMIT_CHARACTERS = 64 * 1024;

export const TerminalIdSchema = z.uuid();
export type TerminalId = z.infer<typeof TerminalIdSchema>;

export const TerminalRequestIdSchema = z.uuid();
export type TerminalRequestId = z.infer<typeof TerminalRequestIdSchema>;

export const TerminalColumnsSchema = z.number().int().min(2).max(1_000);
export const TerminalRowsSchema = z.number().int().min(1).max(500);

export const TerminalShellIdSchema = z.enum([
    "zsh",
    "bash",
    "sh",
    "fish",
    "ksh",
    "csh",
    "tcsh",
]);
export type TerminalShellId = z.infer<typeof TerminalShellIdSchema>;

export const TerminalAgentIdSchema = z.enum(["junie", "claude_code", "codex"]);
export type TerminalAgentId = z.infer<typeof TerminalAgentIdSchema>;

export const TerminalLaunchTargetSchema = z.discriminatedUnion("kind", [
    z
        .object({ kind: z.literal("default") })
        .strict()
        .readonly(),
    z
        .object({ kind: z.literal("shell"), id: TerminalShellIdSchema })
        .strict()
        .readonly(),
    z
        .object({ kind: z.literal("agent"), id: TerminalAgentIdSchema })
        .strict()
        .readonly(),
]);
export type TerminalLaunchTarget = Readonly<
    z.infer<typeof TerminalLaunchTargetSchema>
>;

export const DEFAULT_TERMINAL_LAUNCH_TARGET = Object.freeze({
    kind: "default",
} as const satisfies TerminalLaunchTarget);

export const TerminalShellDescriptorSchema = z
    .object({
        kind: z.literal("shell"),
        id: TerminalShellIdSchema,
        displayName: z.string().min(1).max(128),
    })
    .strict()
    .readonly();
export type TerminalShellDescriptor = Readonly<
    z.infer<typeof TerminalShellDescriptorSchema>
>;

export const TerminalAgentDescriptorSchema = z
    .object({
        kind: z.literal("agent"),
        id: TerminalAgentIdSchema,
        displayName: z.string().min(1).max(128),
    })
    .strict()
    .readonly();
export type TerminalAgentDescriptor = Readonly<
    z.infer<typeof TerminalAgentDescriptorSchema>
>;

function hasUniqueIds(values: readonly Readonly<{ id: string }>[]): boolean {
    return new Set(values.map(({ id }) => id)).size === values.length;
}

export const TerminalLaunchTargetsSchema = z
    .object({
        shells: z.array(TerminalShellDescriptorSchema).max(16).readonly(),
        agents: z.array(TerminalAgentDescriptorSchema).max(8).readonly(),
    })
    .strict()
    .readonly()
    .refine(({ shells }) => hasUniqueIds(shells), {
        message: "Terminal shell identifiers must be unique",
        path: ["shells"],
    })
    .refine(({ agents }) => hasUniqueIds(agents), {
        message: "Terminal agent identifiers must be unique",
        path: ["agents"],
    });
export type TerminalLaunchTargets = Readonly<
    z.infer<typeof TerminalLaunchTargetsSchema>
>;

export const TerminalListLaunchTargetsRequestSchema = z
    .object({})
    .strict()
    .readonly();

export const TerminalCreateRequestSchema = z
    .object({
        requestId: TerminalRequestIdSchema,
        repositoryId: RepositoryIdSchema,
        cols: TerminalColumnsSchema,
        rows: TerminalRowsSchema,
        target: TerminalLaunchTargetSchema.default(
            DEFAULT_TERMINAL_LAUNCH_TARGET,
        ),
    })
    .strict()
    .readonly();
export type TerminalCreateRequest = Readonly<
    z.infer<typeof TerminalCreateRequestSchema>
>;

export const TerminalCreateResultSchema = z
    .object({
        requestId: TerminalRequestIdSchema,
        terminalId: TerminalIdSchema,
    })
    .strict()
    .readonly();
export type TerminalCreateResult = Readonly<
    z.infer<typeof TerminalCreateResultSchema>
>;

export const TerminalWriteRequestSchema = z
    .object({
        terminalId: TerminalIdSchema,
        data: z.string().max(TERMINAL_INPUT_LIMIT_CHARACTERS),
    })
    .strict()
    .readonly();

export const TerminalResizeRequestSchema = z
    .object({
        terminalId: TerminalIdSchema,
        cols: TerminalColumnsSchema,
        rows: TerminalRowsSchema,
    })
    .strict()
    .readonly();

export const TerminalCloseRequestSchema = z
    .object({ terminalId: TerminalIdSchema })
    .strict()
    .readonly();

export const TerminalCloseRepositoryRequestSchema = z
    .object({ repositoryId: RepositoryIdSchema })
    .strict()
    .readonly();

const TerminalEventIdentitySchema = {
    requestId: TerminalRequestIdSchema,
    terminalId: TerminalIdSchema,
} as const;

export const TerminalOutputEventSchema = z
    .object({
        ...TerminalEventIdentitySchema,
        kind: z.literal("output"),
        sequence: z.number().int().nonnegative(),
        data: z
            .array(z.number().int().min(0).max(255))
            .max(TERMINAL_OUTPUT_CHUNK_BYTES),
    })
    .strict()
    .readonly();

export const TerminalExitedEventSchema = z
    .object({
        ...TerminalEventIdentitySchema,
        kind: z.literal("exited"),
        exitCode: z.number().int().nonnegative(),
        signal: z.string().min(1).max(128).nullable(),
    })
    .strict()
    .readonly();

export const TerminalFailedEventSchema = z
    .object({
        ...TerminalEventIdentitySchema,
        kind: z.literal("failed"),
        message: z.string().min(1).max(4_096),
    })
    .strict()
    .readonly();

export const TerminalEventEnvelopeSchema = z
    .discriminatedUnion("kind", [
        TerminalOutputEventSchema,
        TerminalExitedEventSchema,
        TerminalFailedEventSchema,
    ])
    .readonly();
export type TerminalEventEnvelope = Readonly<
    z.infer<typeof TerminalEventEnvelopeSchema>
>;

export type TerminalClientEvent =
    | Readonly<{ kind: "output"; sequence: number; data: number[] }>
    | Readonly<{ kind: "exited"; exitCode: number; signal: string | null }>
    | Readonly<{ kind: "failed"; message: string }>;

export type TerminalEventListener = (event: TerminalClientEvent) => void;
