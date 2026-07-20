import {
  HostingAccountIdSchema,
  HostingAccountSchema,
  HostingAccountsSchema,
  HostingRequestSchema,
  HostingResponseKindByRequest,
  HostingResponseSchema,
  SaveHostingAccountSchema,
} from "../../electron/hosting/hosting-contract";
import { safeHostingErrorMessage } from "../../electron/hosting/hosting-redaction";
import type {
  HostingAccount,
  HostingProviderKind,
  HostingRequest,
  HostingResponse,
} from "../shared/contracts/model";
import type { HostingBridge } from "./HostingBridge";

export interface ElectronHostingApi {
  saveAccount(
    provider: HostingProviderKind,
    baseUrl: string,
    token: string,
  ): Promise<HostingAccount>;
  restoreAccounts(accounts: readonly HostingAccount[]): Promise<void>;
  deleteAccount(accountId: string): Promise<void>;
  execute(accountId: string, request: HostingRequest): Promise<unknown>;
}

export type ElectronHostingBridgeOperation =
  | "saveAccount"
  | "restoreAccounts"
  | "deleteAccount"
  | "execute";

export class ElectronHostingBridgeError extends Error {
  readonly operation: ElectronHostingBridgeOperation;

  private constructor(operation: ElectronHostingBridgeOperation, message: string) {
    super(message);
    this.name = "ElectronHostingBridgeError";
    this.operation = operation;
  }

  static from(
    operation: ElectronHostingBridgeOperation,
    error: unknown,
    secrets: readonly string[] = [],
  ): ElectronHostingBridgeError {
    if (error instanceof ElectronHostingBridgeError) return error;
    const detail = error instanceof Error ? error.message : String(error);
    return new ElectronHostingBridgeError(
      operation,
      `Electron hosting ${operation} failed: ${safeHostingErrorMessage(detail, secrets)}`,
    );
  }
}

function accountFromBoundary(raw: unknown): HostingAccount {
  const result = HostingAccountSchema.safeParse(raw);
  if (!result.success) throw new Error("Electron hosting account response is invalid");
  return { ...result.data };
}

function responseFromBoundary(requestKind: HostingRequest["kind"], raw: unknown): HostingResponse {
  const result = HostingResponseSchema.safeParse(raw);
  if (!result.success) throw new Error("Electron hosting response is invalid");
  const expectedKind = HostingResponseKindByRequest[requestKind];
  if (result.data.kind !== expectedKind) {
    throw new Error(
      `Electron hosting response kind ${result.data.kind} did not match ${requestKind}`,
    );
  }
  switch (result.data.kind) {
    case "changeRequests":
      return { ...result.data, items: result.data.items.map((item) => ({ ...item })) };
    case "changeRequest":
      return { ...result.data, item: { ...result.data.item } };
    case "files":
      return { ...result.data, items: result.data.items.map((item) => ({ ...item })) };
    case "timeline":
      return { ...result.data, items: result.data.items.map((item) => ({ ...item })) };
    case "viewedFiles":
      return { ...result.data, paths: [...result.data.paths] };
    case "namespaces":
      return { ...result.data, items: result.data.items.map((item) => ({ ...item })) };
    case "shareRepositories":
      return { ...result.data, names: [...result.data.names] };
    case "completed":
    case "repositoryAvailability":
    case "repository":
      return { ...result.data };
  }
}

export class ElectronHostingBridge implements HostingBridge {
  readonly #api: ElectronHostingApi;

  private constructor(api: ElectronHostingApi) {
    this.#api = api;
  }

  static of(api: ElectronHostingApi): ElectronHostingBridge {
    return new ElectronHostingBridge(api);
  }

  async saveAccount(
    provider: HostingProviderKind,
    baseUrl: string,
    token: string,
  ): Promise<HostingAccount> {
    const secrets = typeof token === "string" && token.length <= 16_384 ? [token] : [];
    try {
      const input = SaveHostingAccountSchema.parse({
        provider,
        baseUrl,
        token,
      });
      const raw: unknown = await this.#api.saveAccount(input.provider, input.baseUrl, input.token);
      const account = accountFromBoundary(raw);
      if (account.provider !== input.provider || account.baseUrl !== input.baseUrl) {
        throw new Error("Electron hosting account identity did not match its request");
      }
      return account;
    } catch (error) {
      throw ElectronHostingBridgeError.from("saveAccount", error, secrets);
    }
  }

  async restoreAccounts(accounts: readonly HostingAccount[]): Promise<void> {
    try {
      const validated = HostingAccountsSchema.parse(accounts).map((account) => ({ ...account }));
      await this.#api.restoreAccounts(validated);
    } catch (error) {
      throw ElectronHostingBridgeError.from("restoreAccounts", error);
    }
  }

  async deleteAccount(accountId: string): Promise<void> {
    try {
      const validatedAccountId = HostingAccountIdSchema.parse(accountId);
      await this.#api.deleteAccount(validatedAccountId);
    } catch (error) {
      throw ElectronHostingBridgeError.from("deleteAccount", error);
    }
  }

  async execute(accountId: string, request: HostingRequest): Promise<HostingResponse> {
    try {
      const validatedAccountId = HostingAccountIdSchema.parse(accountId);
      const validatedRequest = HostingRequestSchema.parse(request);
      const requestKind = validatedRequest.kind;
      const raw: unknown = await this.#api.execute(validatedAccountId, validatedRequest);
      return responseFromBoundary(requestKind, raw);
    } catch (error) {
      throw ElectronHostingBridgeError.from("execute", error);
    }
  }
}
