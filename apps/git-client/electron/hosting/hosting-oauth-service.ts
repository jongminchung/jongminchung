import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  HostingBaseUrlSchema,
  type HostingOAuthPrompt,
  type HostingProviderKind,
} from "../../src/shared/contracts/hosting";
import { safeHostingErrorMessage } from "../../src/shared/contracts/hosting-redaction";
import { HostingFoundationError } from "./hosting-error";
import type {
  HostingHttpClient,
  HostingHttpRequest,
  HostingHttpResponse,
} from "./hosting-http";
import {
  NodeHostingOAuthLoopbackFactory,
  type HostingOAuthLoopbackFactory,
  type HostingOAuthLoopbackSession,
} from "./hosting-oauth-loopback";

const OAUTH_RESPONSE_LIMIT_BYTES = 64 * 1_024;
const OAUTH_SESSION_LIMIT = 32;
const DEFAULT_GITLAB_REDIRECT_URI = "http://127.0.0.1:53682/oauth/callback";
const OAUTH_CREDENTIAL_PREFIX = "hosting-oauth:v1:";
const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

const ClientIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .refine((value) => !/[\s\p{Cc}]/u.test(value), "client ID is invalid");
const OAuthTokenResponseSchema = z
  .object({
    access_token: z.string().min(1).max(16_384),
    token_type: z.string().min(1).max(64).optional(),
    expires_in: z.number().int().positive().max(31_536_000).optional(),
    refresh_token: z.string().min(1).max(16_384).optional(),
    refresh_token_expires_in: z
      .number()
      .int()
      .positive()
      .max(63_072_000)
      .optional(),
    scope: z.string().max(16_384).optional(),
    created_at: z.number().int().nonnegative().optional(),
  })
  .passthrough();
const OAuthErrorResponseSchema = z
  .object({
    error: z.string().min(1).max(256),
    error_description: z.string().max(2_048).optional(),
  })
  .passthrough();
const GitHubDeviceResponseSchema = z
  .object({
    device_code: z.string().min(1).max(16_384),
    user_code: z.string().min(1).max(256),
    verification_uri: z.url().max(2_048),
    expires_in: z.number().int().positive().max(3_600),
    interval: z.number().int().min(1).max(60),
  })
  .passthrough();
const HostingOAuthCredentialSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal("oauth"),
    provider: z.enum(["gitHub", "gitLab"]),
    baseUrl: HostingBaseUrlSchema,
    flow: z.enum(["device", "pkce"]),
    clientId: ClientIdSchema,
    accessToken: z.string().min(1).max(16_384),
    accessTokenExpiresAt: z.number().int().positive().nullable(),
    refreshToken: z.string().min(1).max(16_384).nullable(),
    refreshTokenExpiresAt: z.number().int().positive().nullable(),
    scope: z.string().max(16_384),
    redirectUri: z.string().max(2_048).nullable(),
  })
  .strict()
  .readonly();

export type HostingOAuthCredential = Readonly<
  z.infer<typeof HostingOAuthCredentialSchema>
>;

export type ResolvedHostingCredential =
  | Readonly<{ kind: "personalAccessToken"; accessToken: string }>
  | HostingOAuthCredential;

export interface HostingOAuthClientConfig {
  readonly gitHubClientId?: string;
  readonly gitLabClientId?: string;
  readonly gitLabRedirectUri?: string;
}

export interface HostingOAuthRuntime {
  now(): number;
  sleep(milliseconds: number, signal: AbortSignal): Promise<void>;
  readonly loopback: HostingOAuthLoopbackFactory;
}

export interface HostingOAuthServiceOptions {
  readonly clients?: HostingOAuthClientConfig;
  readonly runtime?: HostingOAuthRuntime;
  readonly requestTimeoutMs?: number;
}

export interface HostingOAuthGrant {
  readonly provider: HostingProviderKind;
  readonly baseUrl: string;
  readonly credential: HostingOAuthCredential;
}

interface OAuthHttpResult {
  readonly status: number;
  readonly statusText: string;
  readonly value: unknown;
}

interface OAuthSessionBase {
  readonly sessionId: string;
  readonly provider: HostingProviderKind;
  readonly baseUrl: string;
  readonly clientId: string;
  readonly expiresAt: number;
  readonly controller: AbortController;
  awaiting: boolean;
}

interface GitHubOAuthSession extends OAuthSessionBase {
  readonly kind: "device";
  readonly deviceCode: string;
  intervalSeconds: number;
}

interface GitLabOAuthSession extends OAuthSessionBase {
  readonly kind: "browser";
  readonly redirectUri: string;
  readonly codeVerifier: string;
  readonly loopback: HostingOAuthLoopbackSession;
}

type OAuthSession = GitHubOAuthSession | GitLabOAuthSession;

function defaultSleep(
  milliseconds: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("OAuth was cancelled"));
      return;
    }
    const finish = (): void => {
      signal.removeEventListener("abort", abort);
      resolve();
    };
    const handle = setTimeout(finish, milliseconds);
    handle.unref();
    const abort = (): void => {
      clearTimeout(handle);
      signal.removeEventListener("abort", abort);
      reject(new Error("OAuth was cancelled"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

const DEFAULT_RUNTIME: HostingOAuthRuntime = Object.freeze({
  now: () => Date.now(),
  sleep: defaultSleep,
  loopback: new NodeHostingOAuthLoopbackFactory(),
});

function formBody(values: Readonly<Record<string, string>>): string {
  return new URLSearchParams(values).toString();
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function oauthError(message: string): HostingFoundationError {
  return new HostingFoundationError("credential", message);
}

function validExternalHttpsUrl(value: string, origin: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.origin !== origin ||
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    throw oauthError("OAuth provider returned an invalid authorization URL");
  }
  return url.toString();
}

function accessTokenExpiresAt(
  value: z.infer<typeof OAuthTokenResponseSchema>,
  now: number,
): number | null {
  if (value.expires_in === undefined) return null;
  const createdAt =
    value.created_at === undefined ? now : value.created_at * 1_000;
  return createdAt + value.expires_in * 1_000;
}

function credentialFromToken(
  provider: HostingProviderKind,
  baseUrl: string,
  flow: "device" | "pkce",
  clientId: string,
  token: z.infer<typeof OAuthTokenResponseSchema>,
  now: number,
  redirectUri: string | null,
  previous?: HostingOAuthCredential,
): HostingOAuthCredential {
  if (
    token.token_type !== undefined &&
    token.token_type.toLowerCase() !== "bearer"
  ) {
    throw oauthError("OAuth provider returned an unsupported token type");
  }
  const refreshToken = token.refresh_token ?? previous?.refreshToken ?? null;
  const refreshTokenExpiresAt =
    token.refresh_token_expires_in === undefined
      ? token.refresh_token === undefined
        ? (previous?.refreshTokenExpiresAt ?? null)
        : null
      : now + token.refresh_token_expires_in * 1_000;
  return HostingOAuthCredentialSchema.parse({
    version: 1,
    kind: "oauth",
    provider,
    baseUrl,
    flow,
    clientId,
    accessToken: token.access_token,
    accessTokenExpiresAt: accessTokenExpiresAt(token, now),
    refreshToken,
    refreshTokenExpiresAt,
    scope: token.scope ?? previous?.scope ?? "",
    redirectUri,
  });
}

export function encodeHostingOAuthCredential(
  credential: HostingOAuthCredential,
): string {
  return `${OAUTH_CREDENTIAL_PREFIX}${JSON.stringify(
    HostingOAuthCredentialSchema.parse(credential),
  )}`;
}

export function decodeHostingCredential(
  raw: string,
): ResolvedHostingCredential {
  if (!raw.startsWith(OAUTH_CREDENTIAL_PREFIX)) {
    return Object.freeze({
      kind: "personalAccessToken" as const,
      accessToken: raw,
    });
  }
  try {
    return HostingOAuthCredentialSchema.parse(
      JSON.parse(raw.slice(OAUTH_CREDENTIAL_PREFIX.length)),
    );
  } catch {
    throw oauthError("Stored OAuth credential is invalid. Sign in again");
  }
}

export class HostingOAuthService {
  readonly #http: HostingHttpClient;
  readonly #clients: HostingOAuthClientConfig;
  readonly #runtime: HostingOAuthRuntime;
  readonly #requestTimeoutMs: number;
  readonly #sessions = new Map<string, OAuthSession>();

  private constructor(
    http: HostingHttpClient,
    options: HostingOAuthServiceOptions,
  ) {
    this.#http = http;
    this.#clients = options.clients ?? {};
    this.#runtime = options.runtime ?? DEFAULT_RUNTIME;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 120_000;
  }

  static of(
    http: HostingHttpClient,
    options: HostingOAuthServiceOptions = {},
  ): HostingOAuthService {
    return new HostingOAuthService(http, options);
  }

  async begin(
    provider: HostingProviderKind,
    baseUrl: string,
    requestedClientId: string,
  ): Promise<HostingOAuthPrompt> {
    await this.#discardExpiredSessions();
    if (this.#sessions.size >= OAUTH_SESSION_LIMIT) {
      throw oauthError("Too many OAuth sign-in sessions are active");
    }
    const clientId = this.#clientId(provider, baseUrl, requestedClientId);
    return provider === "gitHub"
      ? this.#beginGitHub(baseUrl, clientId)
      : this.#beginGitLab(baseUrl, clientId);
  }

  async complete(sessionId: string): Promise<HostingOAuthGrant> {
    const session = this.#sessions.get(sessionId);
    if (session === undefined)
      throw oauthError("OAuth sign-in session is unavailable or expired");
    if (session.awaiting)
      throw oauthError("OAuth sign-in session is already being completed");
    session.awaiting = true;
    try {
      if (this.#runtime.now() >= session.expiresAt)
        throw oauthError("OAuth sign-in expired. Start again");
      return session.kind === "device"
        ? await this.#completeGitHub(session)
        : await this.#completeGitLab(session);
    } catch (error) {
      if (error instanceof HostingFoundationError) throw error;
      const message = session.controller.signal.aborted
        ? "OAuth sign-in was cancelled"
        : safeHostingErrorMessage(errorText(error));
      throw oauthError(message);
    } finally {
      this.#sessions.delete(sessionId);
      session.controller.abort();
      if (session.kind === "browser")
        await session.loopback.close().catch(() => {});
    }
  }

  async cancel(sessionId: string): Promise<void> {
    const session = this.#sessions.get(sessionId);
    if (session === undefined) return;
    this.#sessions.delete(sessionId);
    session.controller.abort();
    if (session.kind === "browser")
      await session.loopback.close().catch(() => {});
  }

  shouldRefresh(credential: HostingOAuthCredential): boolean {
    return (
      credential.accessTokenExpiresAt !== null &&
      credential.accessTokenExpiresAt <= this.#runtime.now() + 60_000
    );
  }

  async refresh(
    credential: HostingOAuthCredential,
    baseUrl: string,
  ): Promise<HostingOAuthCredential> {
    if (credential.refreshToken === null) {
      throw oauthError("OAuth session expired. Sign in again");
    }
    if (
      credential.refreshTokenExpiresAt !== null &&
      credential.refreshTokenExpiresAt <= this.#runtime.now()
    ) {
      throw oauthError("OAuth refresh token expired. Sign in again");
    }
    const values: Record<string, string> = {
      client_id: credential.clientId,
      grant_type: "refresh_token",
      refresh_token: credential.refreshToken,
    };
    if (credential.redirectUri !== null)
      values.redirect_uri = credential.redirectUri;
    if (credential.baseUrl !== baseUrl) {
      throw oauthError(
        "Stored OAuth credential does not match the hosting server",
      );
    }
    const result = await this.#sendForm(
      this.#tokenUrl(credential.provider, baseUrl),
      values,
      [credential.accessToken, credential.refreshToken],
    );
    const token = this.#requiredToken(result, [credential.refreshToken]);
    return credentialFromToken(
      credential.provider,
      credential.baseUrl,
      credential.flow,
      credential.clientId,
      token,
      this.#runtime.now(),
      credential.redirectUri,
      credential,
    );
  }

  async #beginGitHub(
    baseUrl: string,
    clientId: string,
  ): Promise<HostingOAuthPrompt> {
    if (baseUrl !== "https://github.com") {
      throw oauthError(
        "GitHub App browser sign-in currently supports GitHub.com only. Use a personal access token for this server",
      );
    }
    const result = await this.#sendForm(
      "https://github.com/login/device/code",
      { client_id: clientId },
      [],
    );
    if (result.status < 200 || result.status >= 300)
      this.#throwProviderError(result, []);
    const parsed = GitHubDeviceResponseSchema.safeParse(result.value);
    if (!parsed.success)
      throw oauthError("GitHub returned an invalid device authorization");
    const authorizationUrl = validExternalHttpsUrl(
      parsed.data.verification_uri,
      "https://github.com",
    );
    const sessionId = randomUUID();
    const expiresAt = this.#runtime.now() + parsed.data.expires_in * 1_000;
    this.#sessions.set(sessionId, {
      kind: "device",
      sessionId,
      provider: "gitHub",
      baseUrl,
      clientId,
      expiresAt,
      controller: new AbortController(),
      awaiting: false,
      deviceCode: parsed.data.device_code,
      intervalSeconds: parsed.data.interval,
    });
    return Object.freeze({
      kind: "device",
      sessionId,
      provider: "gitHub",
      baseUrl,
      authorizationUrl,
      userCode: parsed.data.user_code,
      expiresAt,
    });
  }

  async #beginGitLab(
    baseUrl: string,
    clientId: string,
  ): Promise<HostingOAuthPrompt> {
    const redirectUri =
      this.#clients.gitLabRedirectUri?.trim() || DEFAULT_GITLAB_REDIRECT_URI;
    const state = randomBytes(32).toString("hex");
    const codeVerifier = randomBytes(64).toString("base64url");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    let loopback: HostingOAuthLoopbackSession;
    try {
      loopback = await this.#runtime.loopback.open(redirectUri, state);
    } catch (error) {
      throw oauthError(
        `GitLab OAuth callback could not start: ${safeHostingErrorMessage(errorText(error))}`,
      );
    }
    const authorization = new URL("/oauth/authorize", baseUrl);
    authorization.searchParams.set("client_id", clientId);
    authorization.searchParams.set("redirect_uri", redirectUri);
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("state", state);
    authorization.searchParams.set("scope", "api");
    authorization.searchParams.set("code_challenge", codeChallenge);
    authorization.searchParams.set("code_challenge_method", "S256");
    const sessionId = randomUUID();
    const expiresAt = this.#runtime.now() + 5 * 60_000;
    this.#sessions.set(sessionId, {
      kind: "browser",
      sessionId,
      provider: "gitLab",
      baseUrl,
      clientId,
      expiresAt,
      controller: new AbortController(),
      awaiting: false,
      redirectUri,
      codeVerifier,
      loopback,
    });
    return Object.freeze({
      kind: "browser",
      sessionId,
      provider: "gitLab",
      baseUrl,
      authorizationUrl: authorization.toString(),
      expiresAt,
    });
  }

  async #completeGitHub(
    session: GitHubOAuthSession,
  ): Promise<HostingOAuthGrant> {
    while (this.#runtime.now() < session.expiresAt) {
      await this.#runtime.sleep(
        session.intervalSeconds * 1_000,
        session.controller.signal,
      );
      const result = await this.#sendForm(
        "https://github.com/login/oauth/access_token",
        {
          client_id: session.clientId,
          device_code: session.deviceCode,
          grant_type: DEVICE_GRANT_TYPE,
        },
        [session.deviceCode],
        session.controller.signal,
      );
      const token = OAuthTokenResponseSchema.safeParse(result.value);
      if (result.status >= 200 && result.status < 300 && token.success) {
        return Object.freeze({
          provider: "gitHub",
          baseUrl: session.baseUrl,
          credential: credentialFromToken(
            "gitHub",
            session.baseUrl,
            "device",
            session.clientId,
            token.data,
            this.#runtime.now(),
            null,
          ),
        });
      }
      const providerError = OAuthErrorResponseSchema.safeParse(result.value);
      if (!providerError.success)
        this.#throwProviderError(result, [session.deviceCode]);
      if (providerError.data.error === "authorization_pending") continue;
      if (providerError.data.error === "slow_down") {
        session.intervalSeconds = Math.min(session.intervalSeconds + 5, 60);
        continue;
      }
      if (providerError.data.error === "access_denied")
        throw oauthError("GitHub sign-in was denied");
      if (providerError.data.error === "expired_token")
        throw oauthError("GitHub device code expired. Start again");
      this.#throwProviderError(result, [session.deviceCode]);
    }
    throw oauthError("GitHub device code expired. Start again");
  }

  async #completeGitLab(
    session: GitLabOAuthSession,
  ): Promise<HostingOAuthGrant> {
    const callback = await Promise.race([
      session.loopback.wait(session.controller.signal),
      this.#runtime
        .sleep(
          Math.max(1, session.expiresAt - this.#runtime.now()),
          session.controller.signal,
        )
        .then(() => {
          throw oauthError("GitLab sign-in expired. Start again");
        }),
    ]);
    if (callback.code === undefined) {
      throw oauthError(
        callback.error === "access_denied"
          ? "GitLab sign-in was denied"
          : "GitLab OAuth callback validation failed",
      );
    }
    const result = await this.#sendForm(
      this.#tokenUrl("gitLab", session.baseUrl),
      {
        client_id: session.clientId,
        code: callback.code,
        code_verifier: session.codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: session.redirectUri,
      },
      [callback.code, session.codeVerifier],
      session.controller.signal,
    );
    const token = this.#requiredToken(result, [
      callback.code,
      session.codeVerifier,
    ]);
    return Object.freeze({
      provider: "gitLab",
      baseUrl: session.baseUrl,
      credential: credentialFromToken(
        "gitLab",
        session.baseUrl,
        "pkce",
        session.clientId,
        token,
        this.#runtime.now(),
        session.redirectUri,
      ),
    });
  }

  #clientId(
    provider: HostingProviderKind,
    baseUrl: string,
    requested: string,
  ): string {
    const candidate =
      requested.trim() ||
      (provider === "gitHub"
        ? baseUrl === "https://github.com"
          ? this.#clients.gitHubClientId
          : undefined
        : baseUrl === "https://gitlab.com"
          ? this.#clients.gitLabClientId
          : undefined) ||
      "";
    const result = ClientIdSchema.safeParse(candidate);
    if (!result.success) {
      throw oauthError(
        provider === "gitHub"
          ? "A GitHub App client ID is required"
          : "A non-confidential GitLab OAuth application ID is required for this server",
      );
    }
    return result.data;
  }

  #tokenUrl(provider: HostingProviderKind, baseUrl: string): string {
    return provider === "gitHub"
      ? "https://github.com/login/oauth/access_token"
      : new URL("/oauth/token", baseUrl).toString();
  }

  #requiredToken(
    result: OAuthHttpResult,
    secrets: readonly string[],
  ): z.infer<typeof OAuthTokenResponseSchema> {
    const parsed = OAuthTokenResponseSchema.safeParse(result.value);
    if (result.status >= 200 && result.status < 300 && parsed.success)
      return parsed.data;
    this.#throwProviderError(result, secrets);
  }

  #throwProviderError(
    result: OAuthHttpResult,
    secrets: readonly string[],
  ): never {
    const providerError = OAuthErrorResponseSchema.safeParse(result.value);
    const status = `${result.status}${result.statusText ? ` ${result.statusText}` : ""}`;
    const detail = providerError.success
      ? `${providerError.data.error}${providerError.data.error_description ? `: ${providerError.data.error_description}` : ""}`
      : "invalid OAuth response";
    throw oauthError(
      safeHostingErrorMessage(`OAuth HTTP ${status}: ${detail}`, secrets),
    );
  }

  async #sendForm(
    url: string,
    values: Readonly<Record<string, string>>,
    secrets: readonly string[],
    parentSignal?: AbortSignal,
  ): Promise<OAuthHttpResult> {
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    parentSignal?.addEventListener("abort", abort, { once: true });
    if (parentSignal?.aborted) controller.abort();
    const timeout = setTimeout(
      () => controller.abort(),
      this.#requestTimeoutMs,
    );
    timeout.unref();
    const request: HostingHttpRequest = Object.freeze({
      method: "POST",
      url,
      headers: Object.freeze({
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "git-client/0.1",
      }),
      body: formBody(values),
      signal: controller.signal,
      maxResponseBytes: OAUTH_RESPONSE_LIMIT_BYTES,
    });
    let response: HostingHttpResponse;
    try {
      response = await this.#http.send(request);
    } catch (error) {
      const detail = controller.signal.aborted
        ? parentSignal?.aborted
          ? "OAuth sign-in was cancelled"
          : "OAuth request timed out"
        : safeHostingErrorMessage(errorText(error), secrets);
      throw oauthError(detail);
    } finally {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", abort);
    }
    const text = new TextDecoder().decode(response.body);
    let value: unknown = {};
    if (text.trim().length > 0) {
      try {
        value = JSON.parse(text);
      } catch {
        throw oauthError("OAuth provider response is not valid JSON");
      }
    }
    return Object.freeze({
      status: response.status,
      statusText: response.statusText,
      value,
    });
  }

  async #discardExpiredSessions(): Promise<void> {
    const expired = [...this.#sessions.values()].filter(
      (session) => session.expiresAt <= this.#runtime.now(),
    );
    await Promise.all(expired.map((session) => this.cancel(session.sessionId)));
  }
}
