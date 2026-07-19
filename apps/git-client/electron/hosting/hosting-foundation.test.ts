import { describe, expect, it, vi } from "vitest";
import {
  HostingAccountSchema,
  HostingRequestSchema,
  normalizeHostingBaseUrl,
  type HostingProviderKind,
  type HostingRequest,
} from "./hosting-contract";
import { FetchHostingHttpClient, type HostingHttpRequest } from "./hosting-http";
import type { HostingHttpClient, HostingHttpResponse } from "./hosting-http";
import { ElectronHostingFoundation, type HostingCredentialStore } from "./hosting-service";

const HTTP_REQUEST: HostingHttpRequest = Object.freeze({
  method: "GET",
  url: "https://api.github.com/user",
  headers: Object.freeze({ Accept: "application/json" }),
  body: null,
  signal: new AbortController().signal,
  maxResponseBytes: 16,
});

function jsonResponse(value: unknown, status = 200, statusText = "OK"): HostingHttpResponse {
  return Object.freeze({
    status,
    statusText,
    body: new TextEncoder().encode(JSON.stringify(value)),
  });
}

class MockHostingHttpClient implements HostingHttpClient {
  readonly requests: HostingHttpRequest[] = [];
  readonly #responses: (HostingHttpResponse | Error)[] = [];

  enqueue(response: HostingHttpResponse | Error): void {
    this.#responses.push(response);
  }

  async send(request: HostingHttpRequest): Promise<HostingHttpResponse> {
    this.requests.push(request);
    const response = this.#responses.shift();
    if (response === undefined) throw new Error("Mock HTTP response is missing");
    if (response instanceof Error) throw response;
    return response;
  }
}

class MemoryHostingCredentialStore implements HostingCredentialStore {
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

function configuredFoundation(provider: HostingProviderKind): {
  readonly foundation: ElectronHostingFoundation;
  readonly http: MockHostingHttpClient;
  readonly credentials: MemoryHostingCredentialStore;
} {
  const http = new MockHostingHttpClient();
  const credentials = new MemoryHostingCredentialStore();
  const foundation = ElectronHostingFoundation.of(http, credentials);
  foundation.restoreAccounts([
    {
      id: "account-1",
      provider,
      baseUrl: provider === "gitHub" ? "https://github.com" : "https://gitlab.example.test/path",
      login: "fox",
    },
  ]);
  credentials.values.set("account-1", "provider-secret-token");
  return { foundation, http, credentials };
}

const GITHUB_CHANGE_REQUEST = Object.freeze({
  number: 7,
  title: "Ship",
  state: "open",
  user: { login: "octocat" },
  head: { ref: "feature" },
  base: { ref: "main" },
  html_url: "https://github.com/acme/repo/pull/7",
  node_id: "PR_kwDOExample",
  draft: false,
  updated_at: "2026-01-01T00:00:00Z",
});

const GITLAB_CHANGE_REQUEST = Object.freeze({
  iid: 7,
  title: "Draft: Ship",
  state: "opened",
  author: { username: "fox" },
  source_branch: "feature",
  target_branch: "main",
  web_url: "https://gitlab.example.test/acme/repo/-/merge_requests/7",
  updated_at: "2026-01-01T00:00:00Z",
});

interface RequestCase {
  readonly request: HostingRequest;
  readonly method: "GET" | "POST" | "PUT";
  readonly path: string;
  readonly payload: unknown;
  readonly response: unknown;
  readonly responseKind: string;
}

describe("Electron hosting contracts", () => {
  it("accepts only credential-free HTTPS origins without query or fragment", () => {
    expect(normalizeHostingBaseUrl(" https://gitlab.example.test/groups/repository ")).toBe(
      "https://gitlab.example.test",
    );

    for (const value of [
      "http://github.com",
      "https://user:password@github.com",
      "https://github.com?token=secret",
      "https://github.com#fragment",
    ]) {
      expect(() => normalizeHostingBaseUrl(value), value).toThrow();
    }

    expect(() =>
      HostingAccountSchema.parse({
        id: "account",
        provider: "gitHub",
        baseUrl: "https://github.com",
        login: "octocat",
        token: "must-not-cross-the-account-boundary",
      }),
    ).toThrow();
    expect(() =>
      HostingRequestSchema.parse({ kind: "get", project: "acme/repo", number: 1, extra: true }),
    ).toThrow();
  });
});

describe("Electron hosting HTTP policy", () => {
  it("does not follow redirects", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      Promise.resolve(
        new Response(null, {
          status: 302,
          headers: { Location: "https://credential-capture.invalid" },
        }),
      ),
    );
    const client = FetchHostingHttpClient.of(fetchImplementation);

    await expect(client.send(HTTP_REQUEST)).rejects.toMatchObject({ code: "redirect" });
    expect(fetchImplementation).toHaveBeenCalledWith(
      HTTP_REQUEST.url,
      expect.objectContaining({ redirect: "manual", credentials: "omit" }),
    );
  });

  it("stops reading responses at the configured byte limit", async () => {
    const client = FetchHostingHttpClient.of(
      vi.fn<typeof fetch>(async () => Promise.resolve(new Response("0123456789"))),
    );

    await expect(client.send({ ...HTTP_REQUEST, maxResponseBytes: 4 })).rejects.toMatchObject({
      code: "responseTooLarge",
    });
  });
});

describe("Electron hosting foundation", () => {
  it("authenticates and saves a GitHub account without exposing its token", async () => {
    const http = new MockHostingHttpClient();
    const credentials = new MemoryHostingCredentialStore();
    http.enqueue(jsonResponse({ login: "octocat" }));
    const foundation = ElectronHostingFoundation.of(http, credentials);

    const account = await foundation.saveAccount(
      "gitHub",
      "https://github.com",
      "super-secret-token",
    );

    expect(account).toEqual({
      id: "ded48b53-a099-5746-9d23-7ae0cc3baa42",
      provider: "gitHub",
      baseUrl: "https://github.com",
      login: "octocat",
    });
    expect(http.requests).toHaveLength(1);
    expect(http.requests[0]).toMatchObject({
      method: "GET",
      url: "https://api.github.com/user",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer super-secret-token",
        "User-Agent": "git-client/0.1",
      },
      body: null,
    });
    expect(credentials.values.get(account.id)).toBe("super-secret-token");
    expect(JSON.stringify(account)).not.toContain("super-secret-token");
  });

  it("uses GitLab profile and private-token contracts for self-hosted accounts", async () => {
    const http = new MockHostingHttpClient();
    const credentials = new MemoryHostingCredentialStore();
    http.enqueue(jsonResponse({ username: "fox" }));
    const foundation = ElectronHostingFoundation.of(http, credentials);

    const account = await foundation.saveAccount(
      "gitLab",
      "https://gitlab.example.test/ignored/path",
      "gitlab-secret",
    );

    expect(account).toEqual({
      id: "1b624160-1997-5e8e-8cb7-7516780ac65a",
      provider: "gitLab",
      baseUrl: "https://gitlab.example.test",
      login: "fox",
    });
    expect(http.requests[0]).toMatchObject({
      method: "GET",
      url: "https://gitlab.example.test/api/v4/user",
      headers: { "PRIVATE-TOKEN": "gitlab-secret" },
      body: null,
    });
  });

  it("rejects malformed profiles before storing credentials", async () => {
    const http = new MockHostingHttpClient();
    const credentials = new MemoryHostingCredentialStore();
    http.enqueue(jsonResponse({ login: "   " }));
    const foundation = ElectronHostingFoundation.of(http, credentials);

    await expect(
      foundation.saveAccount("gitHub", "https://github.com", "never-store-this-token"),
    ).rejects.toMatchObject({ code: "invalidResponse" });
    expect(credentials.values.size).toBe(0);
  });

  it("maps every GitHub request kind to the provider contract", async () => {
    const { foundation, http } = configuredFoundation("gitHub");
    const cases: readonly RequestCase[] = [
      {
        request: { kind: "list", project: "acme/repo", page: 2 },
        method: "GET",
        path: "repos/acme/repo/pulls?state=all&per_page=50&page=2",
        payload: null,
        response: [GITHUB_CHANGE_REQUEST],
        responseKind: "changeRequests",
      },
      {
        request: { kind: "get", project: "acme/repo", number: 7 },
        method: "GET",
        path: "repos/acme/repo/pulls/7",
        payload: null,
        response: GITHUB_CHANGE_REQUEST,
        responseKind: "changeRequest",
      },
      {
        request: { kind: "files", project: "acme/repo", number: 7 },
        method: "GET",
        path: "repos/acme/repo/pulls/7/files?per_page=100",
        payload: null,
        response: [
          {
            filename: "src/new.ts",
            previous_filename: "src/old.ts",
            status: "renamed",
            additions: 3,
            deletions: 2,
            patch: "@@ patch",
          },
        ],
        responseKind: "files",
      },
      {
        request: { kind: "timeline", project: "acme/repo", number: 7 },
        method: "GET",
        path: "repos/acme/repo/issues/7/timeline?per_page=100",
        payload: null,
        response: [
          {
            id: 42,
            event: "commented",
            actor: { login: "octocat" },
            body: "Looks good",
            created_at: "2026-01-02T00:00:00Z",
          },
        ],
        responseKind: "timeline",
      },
      {
        request: { kind: "viewedFiles", project: "acme/repo", number: 7 },
        method: "POST",
        path: "graphql",
        payload: {
          query: expect.stringContaining("GitClientViewedFiles"),
          variables: { owner: "acme", name: "repo", number: 7 },
        },
        response: {
          data: {
            repository: {
              pullRequest: {
                files: {
                  nodes: [
                    { path: "src/new.ts", viewerViewedState: "VIEWED" },
                    { path: "src/old.ts", viewerViewedState: "UNVIEWED" },
                  ],
                },
              },
            },
          },
        },
        responseKind: "viewedFiles",
      },
      {
        request: {
          kind: "setViewed",
          pullRequestId: "PR_kwDOExample",
          path: "src/new.ts",
          viewed: true,
        },
        method: "POST",
        path: "graphql",
        payload: {
          query: expect.stringContaining("GitClientMarkFileViewed"),
          variables: {
            pullRequestId: "PR_kwDOExample",
            path: "src/new.ts",
          },
        },
        response: { data: { markFileAsViewed: { clientMutationId: null } } },
        responseKind: "completed",
      },
      {
        request: {
          kind: "create",
          project: "acme/repo",
          title: "Ship",
          body: "Description",
          sourceBranch: "feature",
          targetBranch: "main",
          draft: true,
        },
        method: "POST",
        path: "repos/acme/repo/pulls",
        payload: {
          title: "Ship",
          body: "Description",
          head: "feature",
          base: "main",
          draft: true,
        },
        response: GITHUB_CHANGE_REQUEST,
        responseKind: "changeRequest",
      },
      {
        request: { kind: "comment", project: "acme/repo", number: 7, body: "Hello" },
        method: "POST",
        path: "repos/acme/repo/issues/7/comments",
        payload: { body: "Hello" },
        response: {},
        responseKind: "completed",
      },
      {
        request: {
          kind: "review",
          project: "acme/repo",
          number: 7,
          event: "approve",
          body: "Approved",
        },
        method: "POST",
        path: "repos/acme/repo/pulls/7/reviews",
        payload: { event: "APPROVE", body: "Approved" },
        response: {},
        responseKind: "completed",
      },
      {
        request: { kind: "updateBranch", project: "acme/repo", number: 7 },
        method: "PUT",
        path: "repos/acme/repo/pulls/7/update-branch",
        payload: {},
        response: {},
        responseKind: "completed",
      },
      {
        request: { kind: "syncFork", project: "acme/repo", branch: "main" },
        method: "POST",
        path: "repos/acme/repo/merge-upstream",
        payload: { branch: "main" },
        response: {},
        responseKind: "completed",
      },
      {
        request: {
          kind: "shareRepository",
          name: "new-repository",
          description: "Description",
          private: true,
          namespaceId: null,
        },
        method: "POST",
        path: "user/repos",
        payload: { name: "new-repository", description: "Description", private: true },
        response: {
          full_name: "fox/new-repository",
          html_url: "https://github.com/fox/new-repository",
          clone_url: "https://github.com/fox/new-repository.git",
          ssh_url: "git@github.com:fox/new-repository.git",
        },
        responseKind: "repository",
      },
    ];

    for (const item of cases) {
      http.enqueue(jsonResponse(item.response));
      const response = await foundation.execute("account-1", item.request);
      const request = http.requests.at(-1);
      expect(response.kind, item.request.kind).toBe(item.responseKind);
      expect(request, item.request.kind).toMatchObject({
        method: item.method,
        url:
          item.path === "graphql"
            ? "https://api.github.com/graphql"
            : `https://api.github.com/${item.path}`,
        headers: { Authorization: "Bearer provider-secret-token" },
        body:
          item.path === "graphql"
            ? expect.any(String)
            : item.payload === null
              ? null
              : JSON.stringify(item.payload),
      });
      if (item.path === "graphql") {
        expect(JSON.parse(request?.body ?? "null")).toEqual(item.payload);
      }
    }
  });

  it("loads all GitHub-owned repository names and private-repository capability", async () => {
    const { foundation, http } = configuredFoundation("gitHub");
    http.enqueue(
      jsonResponse({
        owned_private_repos: 2,
        plan: { private_repos: 10 },
      }),
    );
    http.enqueue(jsonResponse([{ name: "existing" }, { name: "another" }]));

    await expect(
      foundation.execute("account-1", { kind: "listShareRepositories" }),
    ).resolves.toEqual({
      kind: "shareRepositories",
      canCreatePrivate: true,
      names: ["existing", "another"],
    });
    expect(http.requests.map((request) => request.url)).toEqual([
      "https://api.github.com/user",
      "https://api.github.com/user/repos?type=owner&per_page=100&page=1",
    ]);
  });

  it("maps every GitLab request kind and rejects unsupported fork sync", async () => {
    const { foundation, http } = configuredFoundation("gitLab");
    const cases: readonly RequestCase[] = [
      {
        request: { kind: "list", project: "acme/repo", page: 2 },
        method: "GET",
        path: "projects/acme%2Frepo/merge_requests?scope=all&per_page=50&page=2",
        payload: null,
        response: [GITLAB_CHANGE_REQUEST],
        responseKind: "changeRequests",
      },
      {
        request: { kind: "get", project: "acme/repo", number: 7 },
        method: "GET",
        path: "projects/acme%2Frepo/merge_requests/7",
        payload: null,
        response: GITLAB_CHANGE_REQUEST,
        responseKind: "changeRequest",
      },
      {
        request: { kind: "files", project: "acme/repo", number: 7 },
        method: "GET",
        path: "projects/acme%2Frepo/merge_requests/7/changes",
        payload: null,
        response: {
          changes: [
            {
              new_path: "src/new.ts",
              old_path: "src/old.ts",
              renamed_file: true,
              diff: "--- a/src/old.ts\n+++ b/src/new.ts\n-old\n+new",
            },
          ],
        },
        responseKind: "files",
      },
      {
        request: { kind: "timeline", project: "acme/repo", number: 7 },
        method: "GET",
        path: "projects/acme%2Frepo/merge_requests/7/notes?per_page=100",
        payload: null,
        response: [
          {
            id: "note-1",
            system: true,
            author: { username: "fox" },
            body: "changed title",
            created_at: "2026-01-02T00:00:00Z",
          },
        ],
        responseKind: "timeline",
      },
      {
        request: {
          kind: "create",
          project: "acme/repo",
          title: "Ship",
          body: "Description",
          sourceBranch: "feature",
          targetBranch: "main",
          draft: true,
        },
        method: "POST",
        path: "projects/acme%2Frepo/merge_requests",
        payload: {
          title: "Draft: Ship",
          description: "Description",
          source_branch: "feature",
          target_branch: "main",
        },
        response: GITLAB_CHANGE_REQUEST,
        responseKind: "changeRequest",
      },
      {
        request: { kind: "comment", project: "acme/repo", number: 7, body: "Hello" },
        method: "POST",
        path: "projects/acme%2Frepo/merge_requests/7/notes",
        payload: { body: "Hello" },
        response: {},
        responseKind: "completed",
      },
      {
        request: {
          kind: "review",
          project: "acme/repo",
          number: 7,
          event: "approve",
          body: "Approved",
        },
        method: "POST",
        path: "projects/acme%2Frepo/merge_requests/7/approve",
        payload: {},
        response: {},
        responseKind: "completed",
      },
      {
        request: { kind: "updateBranch", project: "acme/repo", number: 7 },
        method: "PUT",
        path: "projects/acme%2Frepo/merge_requests/7/rebase",
        payload: {},
        response: {},
        responseKind: "completed",
      },
      {
        request: { kind: "listNamespaces" },
        method: "POST",
        path: "graphql",
        payload: { query: expect.stringContaining("GitClientShareNamespaces") },
        response: {
          data: {
            currentUser: { namespace: { fullName: "Fox", fullPath: "fox" } },
            groups: {
              nodes: [
                {
                  id: "gid://gitlab/Group/42",
                  fullName: "Acme / Team",
                  fullPath: "acme/team",
                  userPermissions: { createProjects: true },
                },
              ],
            },
          },
        },
        responseKind: "namespaces",
      },
      {
        request: {
          kind: "checkShareRepository",
          namespacePath: "acme/team",
          name: "new-repository",
        },
        method: "POST",
        path: "graphql",
        payload: {
          query: expect.stringContaining("GitClientCheckShareRepository"),
          variables: { fullPath: "acme/team/new-repository" },
        },
        response: { data: { project: null } },
        responseKind: "repositoryAvailability",
      },
      {
        request: {
          kind: "shareRepository",
          name: "new-repository",
          description: "Description",
          private: true,
          namespaceId: "gid://gitlab/Group/42",
        },
        method: "POST",
        path: "projects",
        payload: {
          name: "new-repository",
          description: "Description",
          visibility: "private",
          namespace_id: "42",
        },
        response: {
          path_with_namespace: "acme/team/new-repository",
          web_url: "https://gitlab.example.test/acme/team/new-repository",
          http_url_to_repo: "https://gitlab.example.test/acme/team/new-repository.git",
          ssh_url_to_repo: "git@gitlab.example.test:acme/team/new-repository.git",
        },
        responseKind: "repository",
      },
    ];

    for (const item of cases) {
      http.enqueue(jsonResponse(item.response));
      const response = await foundation.execute("account-1", item.request);
      const request = http.requests.at(-1);
      expect(response.kind, item.request.kind).toBe(item.responseKind);
      expect(request, item.request.kind).toMatchObject({
        method: item.method,
        url:
          item.path === "graphql"
            ? "https://gitlab.example.test/api/graphql"
            : `https://gitlab.example.test/api/v4/${item.path}`,
        headers: { "PRIVATE-TOKEN": "provider-secret-token" },
        body:
          item.path === "graphql"
            ? expect.any(String)
            : item.payload === null
              ? null
              : JSON.stringify(item.payload),
      });
      if (item.path === "graphql") {
        expect(JSON.parse(request?.body ?? "null")).toEqual(item.payload);
      }
    }

    await expect(
      foundation.execute("account-1", {
        kind: "syncFork",
        project: "acme/repo",
        branch: "main",
      }),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(
      foundation.execute("account-1", { kind: "listShareRepositories" }),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(
      foundation.execute("account-1", {
        kind: "viewedFiles",
        project: "acme/repo",
        number: 7,
      }),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(
      foundation.execute("account-1", {
        kind: "setViewed",
        pullRequestId: "PR_kwDOExample",
        path: "src/new.ts",
        viewed: true,
      }),
    ).rejects.toMatchObject({ code: "invalidInput" });
    expect(http.requests).toHaveLength(cases.length);
  });

  it("parses GitHub and GitLab response fields at the external boundary", async () => {
    const github = configuredFoundation("gitHub");
    github.http.enqueue(jsonResponse([GITHUB_CHANGE_REQUEST]));
    github.http.enqueue(
      jsonResponse([
        {
          filename: "src/new.ts",
          previous_filename: "src/old.ts",
          status: "renamed",
          additions: 3,
          deletions: 2,
          patch: "@@ patch",
        },
      ]),
    );
    github.http.enqueue(
      jsonResponse([
        {
          id: 42,
          user: { login: "fallback-user" },
          body: "Looks good",
          created_at: "2026-01-02T00:00:00Z",
        },
      ]),
    );

    await expect(
      github.foundation.execute("account-1", {
        kind: "list",
        project: "acme/repo",
        page: 1,
      }),
    ).resolves.toEqual({
      kind: "changeRequests",
      items: [
        {
          number: 7,
          title: "Ship",
          state: "open",
          author: "octocat",
          sourceBranch: "feature",
          targetBranch: "main",
          webUrl: "https://github.com/acme/repo/pull/7",
          nodeId: "PR_kwDOExample",
          draft: false,
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
      nextPage: null,
    });
    await expect(
      github.foundation.execute("account-1", {
        kind: "files",
        project: "acme/repo",
        number: 7,
      }),
    ).resolves.toEqual({
      kind: "files",
      items: [
        {
          path: "src/new.ts",
          previousPath: "src/old.ts",
          status: "renamed",
          additions: 3,
          deletions: 2,
          patch: "@@ patch",
        },
      ],
    });
    await expect(
      github.foundation.execute("account-1", {
        kind: "timeline",
        project: "acme/repo",
        number: 7,
      }),
    ).resolves.toEqual({
      kind: "timeline",
      items: [
        {
          id: "42",
          kind: "comment",
          author: "fallback-user",
          body: "Looks good",
          createdAt: "2026-01-02T00:00:00Z",
        },
      ],
    });

    const gitlab = configuredFoundation("gitLab");
    gitlab.http.enqueue(jsonResponse(GITLAB_CHANGE_REQUEST));
    gitlab.http.enqueue(
      jsonResponse({
        changes: [
          {
            new_path: "src/new.ts",
            old_path: "src/old.ts",
            renamed_file: true,
            diff: "--- a/src/old.ts\n+++ b/src/new.ts\n-old\n+new",
          },
        ],
      }),
    );
    gitlab.http.enqueue(
      jsonResponse([
        {
          id: "note-1",
          system: true,
          author: { username: "fox" },
          body: "changed title",
          created_at: "2026-01-02T00:00:00Z",
        },
      ]),
    );

    await expect(
      gitlab.foundation.execute("account-1", {
        kind: "get",
        project: "acme/repo",
        number: 7,
      }),
    ).resolves.toEqual({
      kind: "changeRequest",
      item: {
        number: 7,
        title: "Draft: Ship",
        state: "opened",
        author: "fox",
        sourceBranch: "feature",
        targetBranch: "main",
        webUrl: "https://gitlab.example.test/acme/repo/-/merge_requests/7",
        nodeId: null,
        draft: true,
        updatedAt: "2026-01-01T00:00:00Z",
      },
    });
    await expect(
      gitlab.foundation.execute("account-1", {
        kind: "files",
        project: "acme/repo",
        number: 7,
      }),
    ).resolves.toEqual({
      kind: "files",
      items: [
        {
          path: "src/new.ts",
          previousPath: "src/old.ts",
          status: "renamed",
          additions: 1,
          deletions: 1,
          patch: "--- a/src/old.ts\n+++ b/src/new.ts\n-old\n+new",
        },
      ],
    });
    await expect(
      gitlab.foundation.execute("account-1", {
        kind: "timeline",
        project: "acme/repo",
        number: 7,
      }),
    ).resolves.toEqual({
      kind: "timeline",
      items: [
        {
          id: "note-1",
          kind: "event",
          author: "fox",
          body: "changed title",
          createdAt: "2026-01-02T00:00:00Z",
        },
      ],
    });
  });

  it("maps every review event for both providers", async () => {
    const github = configuredFoundation("gitHub");
    const gitlab = configuredFoundation("gitLab");
    const cases = [
      {
        event: "approve" as const,
        github: { event: "APPROVE", body: "Review body" },
        gitlab: {},
        gitlabPath: "approve",
      },
      {
        event: "requestChanges" as const,
        github: { event: "REQUEST_CHANGES", body: "Review body" },
        gitlab: { body: "Request changes: Review body" },
        gitlabPath: "notes",
      },
      {
        event: "comment" as const,
        github: { event: "COMMENT", body: "Review body" },
        gitlab: { body: "Review body" },
        gitlabPath: "notes",
      },
    ];

    for (const item of cases) {
      github.http.enqueue(jsonResponse({}));
      gitlab.http.enqueue(jsonResponse({}));
      const request = {
        kind: "review" as const,
        project: "acme/repo",
        number: 7,
        event: item.event,
        body: "Review body",
      };
      await github.foundation.execute("account-1", request);
      await gitlab.foundation.execute("account-1", request);
      expect(github.http.requests.at(-1)?.body).toBe(JSON.stringify(item.github));
      expect(gitlab.http.requests.at(-1)).toMatchObject({
        url: `https://gitlab.example.test/api/v4/projects/acme%2Frepo/merge_requests/7/${item.gitlabPath}`,
        body: JSON.stringify(item.gitlab),
      });
    }
  });

  it("derives the next page only from a full provider-sized page", async () => {
    const { foundation, http } = configuredFoundation("gitHub");
    http.enqueue(jsonResponse(Array.from({ length: 50 }, () => GITHUB_CHANGE_REQUEST)));

    const response = await foundation.execute("account-1", {
      kind: "list",
      project: "acme/repo",
      page: 3,
    });

    expect(response).toMatchObject({ kind: "changeRequests", nextPage: 4 });
  });

  it("restores and deletes account metadata through an injected credential store", async () => {
    const { foundation, credentials } = configuredFoundation("gitHub");

    await foundation.deleteAccount("account-1");

    expect(credentials.values.has("account-1")).toBe(false);
    await expect(
      foundation.execute("account-1", {
        kind: "get",
        project: "acme/repo",
        number: 7,
      }),
    ).rejects.toMatchObject({ code: "accountNotFound" });
  });

  it("redacts credentials from HTTP and offline errors", async () => {
    const { foundation, http } = configuredFoundation("gitLab");
    http.enqueue(
      jsonResponse(
        { message: "token provider-secret-token glpat-private-value" },
        401,
        "Unauthorized",
      ),
    );

    const request = { kind: "list" as const, project: "acme/repo", page: 1 };
    const httpError = await foundation
      .execute("account-1", request)
      .catch((error: unknown) => error);
    expect(httpError).toMatchObject({ code: "http" });
    expect(String(httpError)).toContain("401 Unauthorized");
    expect(String(httpError)).not.toContain("provider-secret-token");
    expect(String(httpError)).not.toContain("glpat-private-value");

    http.enqueue(
      new Error(
        "offline PRIVATE-TOKEN: provider-secret-token Authorization: Bearer ghp_offline-secret",
      ),
    );
    const offlineError = await foundation
      .execute("account-1", request)
      .catch((error: unknown) => error);
    expect(offlineError).toMatchObject({ code: "offline" });
    expect(String(offlineError)).not.toContain("provider-secret-token");
    expect(String(offlineError)).not.toContain("ghp_offline-secret");
    expect(
      typeof offlineError === "object" && offlineError !== null
        ? Reflect.get(offlineError, "cause")
        : undefined,
    ).toBeUndefined();
  });

  it("reports redirect, timeout, size, invalid JSON, and missing credential failures", async () => {
    const redirect = configuredFoundation("gitHub");
    redirect.http.enqueue(jsonResponse({}, 302, "Found"));
    const request = { kind: "list" as const, project: "acme/repo", page: 1 };
    await expect(redirect.foundation.execute("account-1", request)).rejects.toMatchObject({
      code: "redirect",
    });

    const timeoutObservation: { signal: AbortSignal | null } = { signal: null };
    const pendingHttp: HostingHttpClient = {
      send: (pendingRequest) => {
        timeoutObservation.signal = pendingRequest.signal;
        return new Promise<HostingHttpResponse>(() => undefined);
      },
    };
    const timeoutCredentials = new MemoryHostingCredentialStore();
    timeoutCredentials.values.set("account-1", "secret");
    const timeout = ElectronHostingFoundation.of(pendingHttp, timeoutCredentials, {
      timeoutMs: 5,
      maxResponseBytes: 1_024,
    });
    timeout.restoreAccounts([
      {
        id: "account-1",
        provider: "gitHub",
        baseUrl: "https://github.com",
        login: "octocat",
      },
    ]);
    await expect(timeout.execute("account-1", request)).rejects.toMatchObject({ code: "timeout" });
    const observedSignal = timeoutObservation.signal;
    if (observedSignal === null) throw new Error("Timeout request signal was not observed");
    expect(observedSignal.aborted).toBe(true);

    const limitedHttp = new MockHostingHttpClient();
    const limited = ElectronHostingFoundation.of(limitedHttp, timeoutCredentials, {
      timeoutMs: 1_000,
      maxResponseBytes: 4,
    });
    limited.restoreAccounts([
      {
        id: "account-1",
        provider: "gitHub",
        baseUrl: "https://github.com",
        login: "octocat",
      },
    ]);
    limitedHttp.enqueue({ status: 200, statusText: "OK", body: new Uint8Array(5) });
    await expect(limited.execute("account-1", request)).rejects.toMatchObject({
      code: "responseTooLarge",
    });

    limitedHttp.enqueue({
      status: 200,
      statusText: "OK",
      body: new TextEncoder().encode("nope"),
    });
    await expect(limited.execute("account-1", request)).rejects.toMatchObject({
      code: "invalidResponse",
    });

    timeoutCredentials.values.delete("account-1");
    await expect(limited.execute("account-1", request)).rejects.toMatchObject({
      code: "credential",
    });
  });
});
