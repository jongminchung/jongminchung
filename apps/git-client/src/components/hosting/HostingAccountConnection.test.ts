import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HostingAccountConnection } from "./HostingAccountConnection";

describe("HostingAccountConnection", () => {
  it("[성공] PAT 권한과 Git credential 경계를 연결 전에 안내함", () => {
    const markup = renderToStaticMarkup(
      createElement(HostingAccountConnection, {
        accountId: "",
        accounts: [],
        initialBaseUrl: "https://github.com",
        initialProvider: "gitHub",
        onConnect: vi.fn(),
        onOAuthCancel: vi.fn(),
        onOAuthConnect: vi.fn(),
        onRemove: vi.fn(),
      }),
    );
    expect(markup).toContain("fine-grained token");
    expect(markup).toContain("Git push credentials are managed separately");
    expect(markup).toContain("Sign in with GitHub");
    expect(markup).toContain("device flow enabled");
    expect(markup).toContain("Optional for cloud providers");
    expect(markup).toContain("Use a personal access token instead");
    expect(markup).toContain("cloud and self-hosted servers");
  });

  it("[성공] device code와 OAuth 취소 동작을 안내함", () => {
    const markup = renderToStaticMarkup(
      createElement(HostingAccountConnection, {
        accountId: "",
        accounts: [],
        busy: "Waiting for browser sign-in",
        initialBaseUrl: "https://github.com",
        initialProvider: "gitHub",
        oauthPrompt: {
          kind: "device",
          sessionId: "oauth-session",
          provider: "gitHub",
          baseUrl: "https://github.com",
          authorizationUrl: "https://github.com/login/device",
          userCode: "ABCD-EFGH",
          expiresAt: Date.UTC(2026, 7, 20, 1, 0),
        },
        onConnect: vi.fn(),
        onOAuthCancel: vi.fn(),
        onOAuthConnect: vi.fn(),
        onRemove: vi.fn(),
      }),
    );

    expect(markup).toContain("ABCD-EFGH");
    expect(markup).toContain("Cancel sign-in");
    expect(markup).toContain("Waiting…");
  });

  it("[경계] local account 제거가 provider authorization을 revoke하지 않음을 안내함", () => {
    const markup = renderToStaticMarkup(
      createElement(HostingAccountConnection, {
        accountId: "account-1",
        accounts: [
          {
            id: "account-1",
            provider: "gitLab",
            baseUrl: "https://gitlab.com",
            authentication: "oauth",
            login: "fox",
          },
        ],
        initialBaseUrl: "https://gitlab.com",
        initialProvider: "gitLab",
        onConnect: vi.fn(),
        onOAuthCancel: vi.fn(),
        onOAuthConnect: vi.fn(),
        onRemove: vi.fn(),
      }),
    );

    expect(markup).toContain("OAuth");
    expect(markup).toContain("Provider authorization is not revoked");
  });
});
