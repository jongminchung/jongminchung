import type { z } from "zod";
import type { mutation, query } from "../desktop-trpc";
import {
    TerminalCloseRepositoryRequestSchema,
    TerminalCloseRequestSchema,
    TerminalCreateRequestSchema,
    TerminalCreateResultSchema,
    TerminalLaunchTargetsSchema,
    TerminalListLaunchTargetsRequestSchema,
    TerminalResizeRequestSchema,
    TerminalWriteRequestSchema,
} from "../terminal";

const TRUSTED_AUTHORIZATION = { kind: "trusted" } as const;

/** Terminal owns its wire contracts and capability policy in one module. */
export function createTerminalProcedures(
    createMutation: typeof mutation,
    createQuery: typeof query,
    voidSchema: z.ZodVoid,
) {
    return {
        create: createMutation(
            "terminal",
            "create",
            TerminalCreateRequestSchema,
            TerminalCreateResultSchema,
            { kind: "repositoryCapability", capability: "terminal" },
        ),
        listLaunchTargets: createQuery(
            "terminal",
            "listLaunchTargets",
            TerminalListLaunchTargetsRequestSchema,
            TerminalLaunchTargetsSchema,
            { kind: "activeCapability", capability: "terminal" },
        ),
        write: createMutation(
            "terminal",
            "write",
            TerminalWriteRequestSchema,
            voidSchema,
            TRUSTED_AUTHORIZATION,
        ),
        resize: createMutation(
            "terminal",
            "resize",
            TerminalResizeRequestSchema,
            voidSchema,
            TRUSTED_AUTHORIZATION,
        ),
        close: createMutation(
            "terminal",
            "close",
            TerminalCloseRequestSchema,
            voidSchema,
            TRUSTED_AUTHORIZATION,
        ),
        closeRepository: createMutation(
            "terminal",
            "closeRepository",
            TerminalCloseRepositoryRequestSchema,
            voidSchema,
            TRUSTED_AUTHORIZATION,
        ),
    } as const;
}
