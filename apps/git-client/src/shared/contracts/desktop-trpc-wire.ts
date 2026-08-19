import { z } from "zod";

export const DESKTOP_TRPC_PROTOCOL_VERSION = 1 as const;

export const DESKTOP_TRPC_CHANNELS = {
    platform: "git-client:rpc:platform",
    git: "git-client:rpc:git",
    terminal: "git-client:rpc:terminal",
    hosting: "git-client:rpc:hosting",
    localHistory: "git-client:rpc:local-history",
} as const;

export type DesktopTrpcDomain = keyof typeof DESKTOP_TRPC_CHANNELS;
export type MainDesktopTrpcDomain = Exclude<DesktopTrpcDomain, "localHistory">;
export type DesktopTrpcOperationType = "query" | "mutation";
export type DesktopTrpcCapability =
    | "gitMutation"
    | "terminal"
    | "hosting"
    | "externalExecution";
export type DesktopTrpcAuthorization =
    | { readonly kind: "trusted" }
    | {
          readonly kind: "activeCapability";
          readonly capability: DesktopTrpcCapability;
      }
    | {
          readonly kind: "repositoryCapability";
          readonly capability: DesktopTrpcCapability;
      };

export const DesktopTrpcRequestSchema = z
    .object({
        version: z.literal(DESKTOP_TRPC_PROTOCOL_VERSION),
        type: z.enum(["query", "mutation"]),
        path: z.string().min(3).max(256),
        input: z.unknown(),
    })
    .strict()
    .readonly();

const DesktopTrpcErrorSchema = z
    .object({
        code: z.string().min(1).max(64),
        message: z.string().min(1).max(16_384),
        field: z.string().min(1).max(128).nullable().default(null),
    })
    .strict()
    .readonly();

export const DesktopTrpcResponseSchema = z.discriminatedUnion("ok", [
    z
        .object({ ok: z.literal(true), data: z.unknown() })
        .strict()
        .readonly(),
    z
        .object({ ok: z.literal(false), error: DesktopTrpcErrorSchema })
        .strict()
        .readonly(),
]);

export type DesktopTrpcResponse = z.infer<typeof DesktopTrpcResponseSchema>;
