import { describe, expect, it } from "vitest";
import type { HostingOAuthPrompt } from "../../src/shared/contracts/hosting";
import type {
  HostingHttpClient,
  HostingHttpRequest,
  HostingHttpResponse,
} from "./hosting-http";
import type {
  HostingOAuthLoopbackFactory,
  HostingOAuthLoopbackResult,
  HostingOAuthLoopbackSession,
} from "./hosting-oauth-loopback";
import {
  encodeHostingOAuthCredential,
  HostingOAuthService,
  type HostingOAuthCredential,
  type HostingOAuthRuntime,
} from "./hosting-oauth-service";
import {
  ElectronHostingFoundation,
  type HostingCredentialStore,
} from "./hosting-service";

function jsonResponse(
  value: unknown,
  status = 200,
  statusText = "OK",
): HostingHttpResponse {
  return Object.freeze({
    status,
    statusText,
    body: new TextEncoder().encode(JSON.stringify(value)),
  });
}

class QueueHttpClient implements HostingHttpClient {
  readonly requests: HostingHttpRequest[] = [];
  readonly #responses: (HostingHttpResponse | Error)[] = [];

  enqueue(response: HostingHttpResponse | Error): void {
    this.#responses.push(response);
  }

  async send(request: HostingHttpRequest): Promise<HostingHttpResponse> {
    this.requests.push(request);
    const response = this.#responses.shift();
    if (response === undefined) throw new Error("Missing OAuth fixture");
    if (response instanceof Error) throw response;
    return response;
  }
}

class FixtureLoopbackFactory implements HostingOAuthLoopbackFactory {
  readonly opened: { redirectUri: string; state: string }[] = [];
  result: HostingOAuthLoopbackResult = { code: "gitlab-code" };

  async open(
    redirectUri: string,
    expectedState: string,
  ): Promise<HostingOAuthLoopbackSession> {
    this.opened.push({ redirectUri, state: expectedState });
    return {
      wait: async (signal) => {
        if (signal.aborted) throw new Error("cancelled");
        return this.result;
      },
      close: async () => undefined,
    };
  }
}

function fixtureRuntime(loopback = new FixtureLoopbackFactory()): {
  readonly runtime: HostingOAuthRuntime;
  readonly loopback: FixtureLoopbackFactory;
  readonly now: () => number;
} {
  let now = 1_800_000_000_000;
  return {
    runtime: {
      now: () => now,
      sleep: async (milliseconds, signal) => {
        if (signal.aborted) throw new Error("cancelled");
        now += milliseconds;
      },
      loopback,
    },
    loopback,
    now: () => now,
  };
}

function promptKind<TKind extends HostingOAuthPrompt["kind"]>(
  prompt: HostingOAuthPrompt,
  kind: TKind,
): Extract<HostingOAuthPrompt, { kind: TKind }> {
  expect(prompt.kind).toBe(kind);
  return prompt as Extract<HostingOAuthPrompt, { kind: TKind }>;
}

describe("Hosting OAuth provider flow", () => {
  it("[성공] GitHub App device flow의 code, polling, token 경계를 유지함", async () => {
    const http = new QueueHttpClient();
    const fixture = fixtureRuntime();
    const service = HostingOAuthService.of(http, {
      clients: { gitHubClientId: "github-client-id" },
      runtime: fixture.runtime,
    });
    http.enqueue(
      jsonResponse({
        device_code: "device-secret",
        user_code: "ABCD-EFGH",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 5,
      }),
    );

    const prompt = promptKind(
      await service.begin("gitHub", "https://github.com", ""),
      "device",
    );
    expect(prompt.userCode).toBe("ABCD-EFGH");
    expect(JSON.stringify(prompt)).not.toContain("device-secret");
    expect(http.requests[0]?.url).toBe("https://github.com/login/device/code");
    expect(http.requests[0]?.body).toBe("client_id=github-client-id");

    http.enqueue(jsonResponse({ error: "authorization_pending" }));
    http.enqueue(
      jsonResponse({
        access_token: "github-access",
        expires_in: 28_800,
        refresh_token: "github-refresh",
        refresh_token_expires_in: 15_897_600,
        token_type: "bearer",
        scope: "",
      }),
    );
    const grant = await service.complete(prompt.sessionId);

    expect(grant.credential).toMatchObject({
      provider: "gitHub",
      flow: "device",
      accessToken: "github-access",
      refreshToken: "github-refresh",
    });
    expect(http.requests.slice(1)).toHaveLength(2);
    expect(http.requests[1]?.body).toContain(
      "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code",
    );
  });

  it("[성공] GitLab public app PKCE와 secretless refresh rotation을 수행함", async () => {
    const http = new QueueHttpClient();
    const fixture = fixtureRuntime();
    const service = HostingOAuthService.of(http, {
      clients: {
        gitLabClientId: "gitlab-client-id",
        gitLabRedirectUri: "http://127.0.0.1:53682/oauth/callback",
      },
      runtime: fixture.runtime,
    });

    const prompt = promptKind(
      await service.begin("gitLab", "https://gitlab.com", ""),
      "browser",
    );
    const authorization = new URL(prompt.authorizationUrl);
    expect(authorization.origin).toBe("https://gitlab.com");
    expect(authorization.searchParams.get("scope")).toBe("api");
    expect(authorization.searchParams.get("code_challenge_method")).toBe(
      "S256",
    );
    expect(authorization.searchParams.get("state")).toBe(
      fixture.loopback.opened[0]?.state,
    );
    expect(prompt).not.toHaveProperty("userCode");

    http.enqueue(
      jsonResponse({
        access_token: "gitlab-access",
        expires_in: 7_200,
        refresh_token: "gitlab-refresh",
        token_type: "Bearer",
        scope: "api",
        created_at: Math.floor(fixture.now() / 1_000),
      }),
    );
    const grant = await service.complete(prompt.sessionId);
    const exchangeBody = http.requests[0]?.body ?? "";
    expect(http.requests[0]?.url).toBe("https://gitlab.com/oauth/token");
    expect(exchangeBody).toContain("code_verifier=");
    expect(exchangeBody).not.toContain("client_secret");

    http.enqueue(
      jsonResponse({
        access_token: "gitlab-access-2",
        expires_in: 7_200,
        refresh_token: "gitlab-refresh-2",
        token_type: "Bearer",
        scope: "api",
      }),
    );
    const refreshed = await service.refresh(
      {
        ...grant.credential,
        accessTokenExpiresAt: fixture.now(),
      },
      "https://gitlab.com",
    );
    expect(refreshed).toMatchObject({
      accessToken: "gitlab-access-2",
      refreshToken: "gitlab-refresh-2",
    });
    expect(http.requests[1]?.body).toContain("grant_type=refresh_token");
    expect(http.requests[1]?.body).not.toContain("client_secret");
  });

  it("[실패] provider 오류에서 refresh token을 redaction함", async () => {
    const http = new QueueHttpClient();
    const fixture = fixtureRuntime();
    const service = HostingOAuthService.of(http, {
      runtime: fixture.runtime,
    });
    const credential: HostingOAuthCredential = {
      version: 1,
      kind: "oauth",
      provider: "gitLab",
      baseUrl: "https://gitlab.com",
      flow: "pkce",
      clientId: "gitlab-client-id",
      accessToken: "access-secret",
      accessTokenExpiresAt: fixture.now(),
      refreshToken: "refresh-secret",
      refreshTokenExpiresAt: fixture.now() + 60_000,
      scope: "api",
      redirectUri: "http://127.0.0.1:53682/oauth/callback",
    };
    http.enqueue(new Error("rejected refresh-secret"));

    await expect(
      service.refresh(credential, "https://gitlab.com"),
    ).rejects.toThrow("rejected [redacted]");
  });
});

class MemoryCredentialStore implements HostingCredentialStore {
  readonly values = new Map<string, string>();

  async get(accountId: string): Promise<string | null> {
    return this.values.get(accountId) ?? null;
  }

  async set(accountId: string, token: string): Promise<void> {
    this.values.set(accountId, token);
  }

  async delete(accountId: string): Promise<void> {
    this.values.delete(accountId);
  }
}

describe("Hosting OAuth credential execution", () => {
  it("[경계] 병렬 GitLab API 요청의 refresh를 한 번만 수행하고 Bearer를 사용함", async () => {
    const fixture = fixtureRuntime();
    const credentials = new MemoryCredentialStore();
    const requests: HostingHttpRequest[] = [];
    let refreshCount = 0;
    const http: HostingHttpClient = {
      async send(request) {
        requests.push(request);
        if (request.url === "https://gitlab.com/oauth/token") {
          refreshCount += 1;
          await Promise.resolve();
          return jsonResponse({
            access_token: "rotated-access",
            expires_in: 7_200,
            refresh_token: "rotated-refresh",
            scope: "api",
          });
        }
        return jsonResponse([]);
      },
    };
    const foundation = ElectronHostingFoundation.of(
      http,
      credentials,
      undefined,
      { runtime: fixture.runtime },
    );
    foundation.restoreAccounts([
      {
        id: "account-1",
        provider: "gitLab",
        baseUrl: "https://gitlab.com",
        login: "fox",
      },
    ]);
    credentials.values.set(
      "account-1",
      encodeHostingOAuthCredential({
        version: 1,
        kind: "oauth",
        provider: "gitLab",
        baseUrl: "https://gitlab.com",
        flow: "pkce",
        clientId: "gitlab-client-id",
        accessToken: "expired-access",
        accessTokenExpiresAt: fixture.now(),
        refreshToken: "refresh-token",
        refreshTokenExpiresAt: fixture.now() + 60_000,
        scope: "api",
        redirectUri: "http://127.0.0.1:53682/oauth/callback",
      }),
    );

    await Promise.all([
      foundation.execute("account-1", {
        kind: "list",
        project: "acme/project",
        page: 1,
      }),
      foundation.execute("account-1", {
        kind: "list",
        project: "acme/project",
        page: 1,
      }),
    ]);

    expect(refreshCount).toBe(1);
    const apiRequests = requests.filter((request) =>
      request.url.includes("/api/v4/"),
    );
    expect(apiRequests).toHaveLength(2);
    for (const request of apiRequests) {
      expect(request.headers.Authorization).toBe("Bearer rotated-access");
      expect(request.headers).not.toHaveProperty("PRIVATE-TOKEN");
    }
    expect(credentials.values.get("account-1")).not.toContain("expired-access");
  });

  it("[실패] account metadata의 다른 host로 OAuth token을 전송하지 않음", async () => {
    const fixture = fixtureRuntime();
    const credentials = new MemoryCredentialStore();
    let requests = 0;
    const foundation = ElectronHostingFoundation.of(
      {
        async send() {
          requests += 1;
          return jsonResponse([]);
        },
      },
      credentials,
      undefined,
      { runtime: fixture.runtime },
    );
    foundation.restoreAccounts([
      {
        id: "account-1",
        provider: "gitLab",
        baseUrl: "https://gitlab.example.com",
        login: "fox",
      },
    ]);
    credentials.values.set(
      "account-1",
      encodeHostingOAuthCredential({
        version: 1,
        kind: "oauth",
        provider: "gitLab",
        baseUrl: "https://gitlab.com",
        flow: "pkce",
        clientId: "gitlab-client-id",
        accessToken: "access-token",
        accessTokenExpiresAt: fixture.now() + 60_000,
        refreshToken: "refresh-token",
        refreshTokenExpiresAt: null,
        scope: "api",
        redirectUri: "http://127.0.0.1:53682/oauth/callback",
      }),
    );

    await expect(
      foundation.execute("account-1", {
        kind: "list",
        project: "acme/project",
        page: 1,
      }),
    ).rejects.toThrow("does not match the hosting account or server");
    expect(requests).toBe(0);
  });
});
