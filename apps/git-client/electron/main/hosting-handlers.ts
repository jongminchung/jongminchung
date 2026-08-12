import type { BrowserWindow } from "electron";
import { RPC_PROCEDURES } from "../../src/shared/contracts/desktop-rpc";
import {
  HostingDeleteAccountRequestSchema,
  HostingExecuteRequestSchema,
  HostingRestoreAccountsRequestSchema,
  HostingSaveAccountRequestSchema,
} from "../../src/shared/contracts/ipc";
import {
  HostingAccountSchema,
  HostingResponseKindByRequest,
  HostingResponseSchema,
  type ElectronHostingFoundation,
} from "../hosting";
import { safeHostingErrorMessage } from "../hosting/hosting-redaction";
import type { DesktopRpcRouter } from "./desktop-rpc-router";
import { assertTrustedSender } from "./ipc-security";

interface HostingHandlerDependencies {
  readonly router: DesktopRpcRouter;
  readonly window: BrowserWindow;
  readonly hosting: ElectronHostingFoundation;
  readonly assertActiveCapability: (capability: "hosting") => void;
}

function hostingToken(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const token = Reflect.get(raw, "token");
  return typeof token === "string" && token.length <= 16_384 ? token : null;
}

function hostingIpcError(error: unknown, secrets: readonly string[] = []): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(safeHostingErrorMessage(message, secrets));
}

export function registerHostingHandlers({
  router,
  window,
  hosting,
  assertActiveCapability,
}: HostingHandlerDependencies): void {
  router.handle(RPC_PROCEDURES.hostingSaveAccount, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    assertActiveCapability("hosting");
    const token = hostingToken(raw);
    try {
      const request = HostingSaveAccountRequestSchema.parse(raw);
      return HostingAccountSchema.parse(
        await hosting.saveAccount(request.provider, request.baseUrl, request.token),
      );
    } catch (error) {
      throw hostingIpcError(error, token === null ? [] : [token]);
    }
  });
  router.handle(RPC_PROCEDURES.hostingRestoreAccounts, (event, raw: unknown): void => {
    assertTrustedSender(event, window);
    assertActiveCapability("hosting");
    try {
      const request = HostingRestoreAccountsRequestSchema.parse(raw);
      hosting.restoreAccounts(request.accounts);
    } catch (error) {
      throw hostingIpcError(error);
    }
  });
  router.handle(RPC_PROCEDURES.hostingDeleteAccount, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    assertActiveCapability("hosting");
    try {
      const request = HostingDeleteAccountRequestSchema.parse(raw);
      await hosting.deleteAccount(request.accountId);
    } catch (error) {
      throw hostingIpcError(error);
    }
  });
  router.handle(RPC_PROCEDURES.hostingExecute, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    assertActiveCapability("hosting");
    try {
      const request = HostingExecuteRequestSchema.parse(raw);
      const response = HostingResponseSchema.parse(
        await hosting.execute(request.accountId, request.request),
      );
      if (response.kind !== HostingResponseKindByRequest[request.request.kind]) {
        throw new Error("Hosting response did not match its request");
      }
      return response;
    } catch (error) {
      throw hostingIpcError(error);
    }
  });
}
