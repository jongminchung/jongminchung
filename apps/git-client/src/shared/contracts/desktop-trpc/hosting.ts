import type { z } from "zod";
import type { mutation } from "../desktop-trpc";
import {
  HostingAccountSchema,
  HostingOAuthPromptSchema,
  HostingResponseSchema,
} from "../hosting";
import {
  HostingAwaitOAuthRequestSchema,
  HostingBeginOAuthRequestSchema,
  HostingCancelOAuthRequestSchema,
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
    beginOAuth: createMutation(
      "hosting",
      "beginOAuth",
      HostingBeginOAuthRequestSchema,
      HostingOAuthPromptSchema,
      { kind: "activeCapability", capability: "hosting" },
    ),
    awaitOAuth: createMutation(
      "hosting",
      "awaitOAuth",
      HostingAwaitOAuthRequestSchema,
      HostingAccountSchema,
      { kind: "activeCapability", capability: "hosting" },
    ),
    cancelOAuth: createMutation(
      "hosting",
      "cancelOAuth",
      HostingCancelOAuthRequestSchema,
      voidSchema,
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
