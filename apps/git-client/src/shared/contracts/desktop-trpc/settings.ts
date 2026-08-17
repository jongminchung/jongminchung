import { z } from "zod";
import type { mutation, query } from "../desktop-trpc";
import {
    JsonValueSchema,
    SettingsDeleteRequestSchema,
    SettingsGetRequestSchema,
    SettingsSetRequestSchema,
} from "../ipc";

const VoidSchema = z.void();
const BooleanSchema = z.boolean();

/** Persistence is a platform concern with one explicit RPC surface. */
export function createSettingsProcedures(
    createMutation: typeof mutation,
    createQuery: typeof query,
) {
    return {
        settingsGet: createQuery(
            "platform",
            "settingsGet",
            SettingsGetRequestSchema,
            JsonValueSchema.nullable(),
        ),
        settingsSet: createMutation(
            "platform",
            "settingsSet",
            SettingsSetRequestSchema,
            VoidSchema,
        ),
        settingsDelete: createMutation(
            "platform",
            "settingsDelete",
            SettingsDeleteRequestSchema,
            VoidSchema,
        ),
        settingsExport: createMutation(
            "platform",
            "settingsExport",
            VoidSchema,
            BooleanSchema,
        ),
        settingsImport: createMutation(
            "platform",
            "settingsImport",
            VoidSchema,
            BooleanSchema,
        ),
    } as const;
}
