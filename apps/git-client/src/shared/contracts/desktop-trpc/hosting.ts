import type { z } from "zod";
import type { mutation } from "../desktop-trpc";
import { HostingAccountSchema, HostingResponseSchema } from "../hosting";
import {
    HostingDeleteAccountRequestSchema,
    HostingExecuteRequestSchema,
    HostingRestoreAccountsRequestSchema,
    HostingSaveAccountRequestSchema,
} from "../ipc";

/** Hosting owns its wire contracts and active-session capability policy. */
export function createHostingProcedures(
    createMutation: typeof mutation,
    voidSchema: z.ZodVoid,
) {
    return {
        saveAccount: createMutation(
            "hosting",
            "saveAccount",
            HostingSaveAccountRequestSchema,
            HostingAccountSchema,
            { kind: "activeCapability", capability: "hosting" },
        ),
        restoreAccounts: createMutation(
            "hosting",
            "restoreAccounts",
            HostingRestoreAccountsRequestSchema,
            voidSchema,
            { kind: "activeCapability", capability: "hosting" },
        ),
        deleteAccount: createMutation(
            "hosting",
            "deleteAccount",
            HostingDeleteAccountRequestSchema,
            voidSchema,
            { kind: "activeCapability", capability: "hosting" },
        ),
        execute: createMutation(
            "hosting",
            "execute",
            HostingExecuteRequestSchema,
            HostingResponseSchema,
            { kind: "activeCapability", capability: "hosting" },
        ),
    } as const;
}
