import type { DesktopApi } from "../../src/shared/contracts/desktop-api";
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
} from "../hosting/hosting-contract";
import { invokeDesktopRpc } from "./rpc-client";

export function createHostingApi(): DesktopApi["hosting"] {
  return {
    async saveAccount(provider, baseUrl, token) {
      const request = HostingSaveAccountRequestSchema.parse({
        provider,
        baseUrl,
        token,
      });
      const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.hostingSaveAccount, request);
      const account = HostingAccountSchema.parse(raw);
      if (account.provider !== request.provider || account.baseUrl !== request.baseUrl) {
        throw new Error("Hosting account response did not match its request");
      }
      return account;
    },
    async restoreAccounts(accounts): Promise<void> {
      const request = HostingRestoreAccountsRequestSchema.parse({
        accounts,
      });
      await invokeDesktopRpc(RPC_PROCEDURES.hostingRestoreAccounts, request);
    },
    async deleteAccount(accountId): Promise<void> {
      const request = HostingDeleteAccountRequestSchema.parse({
        accountId,
      });
      await invokeDesktopRpc(RPC_PROCEDURES.hostingDeleteAccount, request);
    },
    async execute(accountId, untrustedRequest) {
      const request = HostingExecuteRequestSchema.parse({
        accountId,
        request: untrustedRequest,
      });
      const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.hostingExecute, request);
      const response = HostingResponseSchema.parse(raw);
      if (response.kind !== HostingResponseKindByRequest[request.request.kind]) {
        throw new Error("Hosting response did not match its request");
      }
      return response;
    },
  };
}
