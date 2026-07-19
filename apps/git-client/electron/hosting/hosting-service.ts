import { v5 as uuidV5 } from "uuid";
import { z } from "zod";
import {
  HostingAccountIdSchema,
  HostingAccountSchema,
  HostingAccountsSchema,
  HostingRequestSchema,
  HostingResponseSchema,
  SaveHostingAccountSchema,
  type HostingAccount,
  type HostingProviderKind,
  type HostingRequest,
  type HostingResponse,
} from "./hosting-contract";
import { HostingFoundationError } from "./hosting-error";
import type {
  HostingHttpClient,
  HostingHttpMethod,
  HostingHttpRequest,
  HostingHttpResponse,
} from "./hosting-http";
import { parseHostingResponse, prepareHostingRequest } from "./hosting-provider";
import { safeHostingErrorMessage } from "./hosting-redaction";

export const HOSTING_REQUEST_TIMEOUT_MS = 120_000;
export const HOSTING_RESPONSE_LIMIT_BYTES = 8 * 1_024 * 1_024;

export interface HostingCredentialStore {
  get(accountId: string): Promise<string | null>;
  set(accountId: string, token: string): Promise<void>;
  delete(accountId: string): Promise<void>;
}

export interface HostingFoundationPolicy {
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
}

interface RequestAccount {
  readonly provider: HostingProviderKind;
  readonly baseUrl: string;
}

const HostingFoundationPolicySchema = z
  .object({
    timeoutMs: z.number().int().min(1).max(600_000),
    maxResponseBytes: z
      .number()
      .int()
      .min(1)
      .max(64 * 1_024 * 1_024),
  })
  .strict()
  .readonly();

const DEFAULT_POLICY: HostingFoundationPolicy = Object.freeze({
  timeoutMs: HOSTING_REQUEST_TIMEOUT_MS,
  maxResponseBytes: HOSTING_RESPONSE_LIMIT_BYTES,
});

function invalidInput(error: unknown): HostingFoundationError {
  const message = error instanceof Error ? error.message : String(error);
  return new HostingFoundationError("invalidInput", safeHostingErrorMessage(message));
}

function requiredString(value: unknown, key: string): string {
  if (typeof value !== "object" || value === null) {
    throw new HostingFoundationError("invalidResponse", `Hosting response is missing ${key}`);
  }
  const result = Reflect.get(value, key);
  if (typeof result !== "string") {
    throw new HostingFoundationError("invalidResponse", `Hosting response is missing ${key}`);
  }
  return result;
}

function providerKey(provider: HostingProviderKind): "github" | "gitlab" {
  return provider === "gitHub" ? "github" : "gitlab";
}

function apiRoot(account: RequestAccount): string {
  if (account.provider === "gitHub") {
    return account.baseUrl === "https://github.com"
      ? "https://api.github.com"
      : `${account.baseUrl}/api/v3`;
  }
  return `${account.baseUrl}/api/v4`;
}

function requestUrl(account: RequestAccount, path: string): string {
  if (path === "graphql") {
    if (account.provider === "gitHub") {
      return account.baseUrl === "https://github.com"
        ? "https://api.github.com/graphql"
        : `${account.baseUrl}/api/graphql`;
    }
    return `${account.baseUrl}/api/graphql`;
  }
  return `${apiRoot(account)}/${path.replace(/^\/+/, "")}`;
}

function authorizationHeaders(
  provider: HostingProviderKind,
  token: string,
): Readonly<Record<string, string>> {
  return Object.freeze({
    Accept: "application/json",
    "User-Agent": "git-client/0.1",
    ...(provider === "gitHub" ? { Authorization: `Bearer ${token}` } : { "PRIVATE-TOKEN": token }),
  });
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class ElectronHostingFoundation {
  readonly #http: HostingHttpClient;
  readonly #credentials: HostingCredentialStore;
  readonly #policy: HostingFoundationPolicy;
  readonly #accounts = new Map<string, HostingAccount>();

  private constructor(
    http: HostingHttpClient,
    credentials: HostingCredentialStore,
    policy: HostingFoundationPolicy,
  ) {
    this.#http = http;
    this.#credentials = credentials;
    this.#policy = policy;
  }

  static of(
    http: HostingHttpClient,
    credentials: HostingCredentialStore,
    policy: HostingFoundationPolicy = DEFAULT_POLICY,
  ): ElectronHostingFoundation {
    let validatedPolicy: HostingFoundationPolicy;
    try {
      validatedPolicy = HostingFoundationPolicySchema.parse(policy);
    } catch (error) {
      throw invalidInput(error);
    }
    return new ElectronHostingFoundation(http, credentials, validatedPolicy);
  }

  async saveAccount(provider: unknown, baseUrl: unknown, token: unknown): Promise<HostingAccount> {
    let input: z.infer<typeof SaveHostingAccountSchema>;
    try {
      input = SaveHostingAccountSchema.parse({ provider, baseUrl, token });
    } catch (error) {
      throw invalidInput(error);
    }
    const profile = await this.#send(
      { provider: input.provider, baseUrl: input.baseUrl },
      input.token,
      "GET",
      "user",
      null,
    );
    const login = requiredString(profile, input.provider === "gitHub" ? "login" : "username");
    if (login.trim().length === 0) {
      throw new HostingFoundationError("invalidResponse", "Hosting profile login is empty");
    }
    const id = uuidV5(`${providerKey(input.provider)}:${input.baseUrl}:${login}`, uuidV5.URL);
    let account: HostingAccount;
    try {
      account = HostingAccountSchema.parse({
        id,
        provider: input.provider,
        baseUrl: input.baseUrl,
        login,
      });
    } catch {
      throw new HostingFoundationError("invalidResponse", "Hosting profile is invalid");
    }
    try {
      await this.#credentials.set(account.id, input.token);
    } catch (error) {
      throw new HostingFoundationError(
        "credential",
        safeHostingErrorMessage(errorText(error), [input.token]),
      );
    }
    this.#accounts.set(account.id, account);
    return account;
  }

  restoreAccounts(accounts: unknown): void {
    let validatedAccounts: readonly HostingAccount[];
    try {
      validatedAccounts = HostingAccountsSchema.parse(accounts);
    } catch (error) {
      throw invalidInput(error);
    }
    const restored = new Map<string, HostingAccount>();
    for (const account of validatedAccounts) restored.set(account.id, account);
    this.#accounts.clear();
    for (const [id, account] of restored) this.#accounts.set(id, account);
  }

  async deleteAccount(accountId: unknown): Promise<void> {
    let id: string;
    try {
      id = HostingAccountIdSchema.parse(accountId);
    } catch (error) {
      throw invalidInput(error);
    }
    this.#accounts.delete(id);
    try {
      await this.#credentials.delete(id);
    } catch (error) {
      throw new HostingFoundationError("credential", safeHostingErrorMessage(errorText(error)));
    }
  }

  async execute(accountId: unknown, request: unknown): Promise<HostingResponse> {
    let id: string;
    let validatedRequest: HostingRequest;
    try {
      id = HostingAccountIdSchema.parse(accountId);
      validatedRequest = HostingRequestSchema.parse(request);
    } catch (error) {
      throw invalidInput(error);
    }
    const account = this.#accounts.get(id);
    if (account === undefined) {
      throw new HostingFoundationError("accountNotFound", "Hosting account is not registered");
    }
    let token: string | null;
    try {
      token = await this.#credentials.get(id);
    } catch (error) {
      throw new HostingFoundationError("credential", safeHostingErrorMessage(errorText(error)));
    }
    if (token === null || token.trim().length === 0) {
      throw new HostingFoundationError("credential", "Hosting credential is unavailable");
    }
    const response = await this.#executeRequest(account, token, validatedRequest);
    try {
      return HostingResponseSchema.parse(response);
    } catch {
      throw new HostingFoundationError("invalidResponse", "Hosting response is invalid");
    }
  }

  async #executeRequest(
    account: HostingAccount,
    token: string,
    request: HostingRequest,
  ): Promise<HostingResponse> {
    if (request.kind === "listShareRepositories" && account.provider === "gitHub") {
      const profile = await this.#send(account, token, "GET", "user", null);
      const repositories: unknown[] = [];
      for (let page = 1; page <= 100; page += 1) {
        const value = await this.#send(
          account,
          token,
          "GET",
          `user/repos?type=owner&per_page=100&page=${page}`,
          null,
        );
        if (!Array.isArray(value) || value.length > 100) {
          throw new HostingFoundationError(
            "invalidResponse",
            "GitHub owned repositories response is invalid",
          );
        }
        repositories.push(...value);
        if (value.length < 100) break;
        if (page === 100) {
          throw new HostingFoundationError(
            "responseTooLarge",
            "GitHub owned repository list exceeds 10,000 entries",
          );
        }
      }
      return parseHostingResponse(account.provider, request, {
        profile,
        repositories,
      });
    }
    const prepared = prepareHostingRequest(account.provider, request);
    const value = await this.#send(
      account,
      token,
      prepared.method,
      prepared.path,
      prepared.payload,
    );
    return parseHostingResponse(account.provider, request, value);
  }

  async #send(
    account: RequestAccount,
    token: string,
    method: HostingHttpMethod,
    path: string,
    payload: unknown,
  ): Promise<unknown> {
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_resolve, reject) => {
      const handle = setTimeout(() => {
        reject(new HostingFoundationError("timeout", "Hosting request timed out"));
        controller.abort();
      }, this.#policy.timeoutMs);
      handle.unref();
      timeoutHandle = handle;
    });
    const headers = {
      ...authorizationHeaders(account.provider, token),
      ...(payload === null ? {} : { "Content-Type": "application/json" }),
    };
    const request: HostingHttpRequest = Object.freeze({
      method,
      url: requestUrl(account, path),
      headers: Object.freeze(headers),
      body: payload === null ? null : JSON.stringify(payload),
      signal: controller.signal,
      maxResponseBytes: this.#policy.maxResponseBytes,
    });

    let response: HostingHttpResponse;
    try {
      response = await Promise.race([this.#http.send(request), timeout]);
    } catch (error) {
      if (error instanceof HostingFoundationError) {
        throw new HostingFoundationError(
          error.code,
          safeHostingErrorMessage(error.message, [token]),
        );
      }
      throw new HostingFoundationError(
        "offline",
        safeHostingErrorMessage(errorText(error), [token]),
      );
    } finally {
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    }

    if (response.body.byteLength > this.#policy.maxResponseBytes) {
      throw new HostingFoundationError(
        "responseTooLarge",
        `Hosting response exceeds the ${this.#policy.maxResponseBytes} byte limit`,
      );
    }
    const text = new TextDecoder().decode(response.body);
    if (response.status >= 300 && response.status < 400) {
      throw new HostingFoundationError("redirect", "Hosting redirects are disabled");
    }
    if (response.status < 200 || response.status >= 300) {
      const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
      const detail = safeHostingErrorMessage(Array.from(text).slice(0, 500).join(""), [token]);
      throw new HostingFoundationError("http", `HTTP ${status}: ${detail}`);
    }
    if (text.trim().length === 0) return {};
    try {
      const parsed: unknown = JSON.parse(text);
      return parsed;
    } catch {
      throw new HostingFoundationError("invalidResponse", "Hosting response is not valid JSON");
    }
  }
}
