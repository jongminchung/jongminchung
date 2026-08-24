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
const TRUSTED_AUTHORIZATION = { kind: "trusted" } as const;

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
      TRUSTED_AUTHORIZATION,
    ),
    settingsSet: createMutation(
      "platform",
      "settingsSet",
      SettingsSetRequestSchema,
      VoidSchema,
      TRUSTED_AUTHORIZATION,
    ),
    settingsDelete: createMutation(
      "platform",
      "settingsDelete",
      SettingsDeleteRequestSchema,
      VoidSchema,
      TRUSTED_AUTHORIZATION,
    ),
    settingsExport: createMutation(
      "platform",
      "settingsExport",
      VoidSchema,
      BooleanSchema,
      TRUSTED_AUTHORIZATION,
    ),
    settingsImport: createMutation(
      "platform",
      "settingsImport",
      VoidSchema,
      BooleanSchema,
      TRUSTED_AUTHORIZATION,
    ),
  } as const;
}
