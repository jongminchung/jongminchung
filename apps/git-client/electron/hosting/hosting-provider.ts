import { randomUUID } from "node:crypto";
import type {
  HostingChangeRequest,
  HostingChangedFile,
  HostingProviderKind,
  HostingRequest,
  HostingResponse,
  HostingTimelineEntry,
} from "./hosting-contract";
import { HostingFoundationError } from "./hosting-error";
import type { HostingHttpMethod } from "./hosting-http";

const PAGE_SIZE = 50;
const GITHUB_VIEWED_FILES_QUERY = `query GitClientViewedFiles($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      files(first: 100) { nodes { path viewerViewedState } }
    }
  }
}`;
const GITHUB_MARK_FILE_VIEWED_MUTATION = `mutation GitClientMarkFileViewed($pullRequestId: ID!, $path: String!) {
  markFileAsViewed(input: { pullRequestId: $pullRequestId, path: $path }) { clientMutationId }
}`;
const GITHUB_UNMARK_FILE_VIEWED_MUTATION = `mutation GitClientUnmarkFileViewed($pullRequestId: ID!, $path: String!) {
  unmarkFileAsViewed(input: { pullRequestId: $pullRequestId, path: $path }) { clientMutationId }
}`;
const GITLAB_SHARE_NAMESPACES_QUERY = `query GitClientShareNamespaces {
  currentUser {
    namespace { fullName fullPath }
  }
  groups(allAvailable: false, first: 100) {
    nodes {
      id
      fullName
      fullPath
      userPermissions { createProjects }
    }
  }
}`;
const GITLAB_CHECK_SHARE_REPOSITORY_QUERY = `query GitClientCheckShareRepository($fullPath: ID!) {
  project(fullPath: $fullPath) { id }
}`;

export interface PreparedHostingRequest {
  readonly method: HostingHttpMethod;
  readonly path: string;
  readonly payload: unknown;
}

function invalidResponse(reason: string): HostingFoundationError {
  return new HostingFoundationError("invalidResponse", reason);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown, description: string): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) {
    throw invalidResponse(`Hosting ${description} response is not an object`);
  }
  return value;
}

function array(value: unknown, description: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw invalidResponse(`Hosting ${description} response is not an array`);
  }
  return value;
}

function stringValue(value: Readonly<Record<string, unknown>>, key: string): string {
  const result = value[key];
  if (typeof result !== "string") {
    throw invalidResponse(`Hosting response is missing ${key}`);
  }
  return result;
}

function numberValue(value: Readonly<Record<string, unknown>>, key: string): number {
  const result = value[key];
  if (!Number.isSafeInteger(result) || typeof result !== "number" || result < 0) {
    throw invalidResponse(`Hosting response is missing ${key}`);
  }
  return result;
}

function optionalString(value: Readonly<Record<string, unknown>>, key: string): string | null {
  const result = value[key];
  return typeof result === "string" ? result : null;
}

function optionalNumber(value: Readonly<Record<string, unknown>>, key: string): number {
  const result = value[key];
  return Number.isSafeInteger(result) && typeof result === "number" && result >= 0 ? result : 0;
}

function optionalBoolean(value: Readonly<Record<string, unknown>>, key: string): boolean {
  const result = value[key];
  return typeof result === "boolean" ? result : false;
}

function nestedString(value: Readonly<Record<string, unknown>>, path: readonly string[]): string {
  let current: unknown = value;
  for (const key of path) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) return "";
    current = Reflect.get(current, key);
  }
  return typeof current === "string" ? current : "";
}

function encodedGitHubProject(project: string): string {
  return project.split("/").map(encodeURIComponent).join("/");
}

function encodedGitLabProject(project: string): string {
  return encodeURIComponent(project);
}

function githubProjectCoordinates(project: string): readonly [string, string] {
  const [owner, name, ...remaining] = project.split("/");
  if (!owner || !name || remaining.length > 0) {
    throw new HostingFoundationError(
      "invalidInput",
      "GitHub project must use owner/repository form",
    );
  }
  return [owner, name];
}

function graphQlData(value: unknown, description: string): Readonly<Record<string, unknown>> {
  const envelope = record(value, description);
  const errors = envelope.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    throw invalidResponse(`GraphQL ${description} returned errors`);
  }
  return record(envelope.data, `${description} data`);
}

function gitlabNamespaceRestId(value: string): string {
  const match = /([0-9]+)$/u.exec(value);
  if (!match?.[1]) {
    throw new HostingFoundationError("invalidInput", "GitLab namespace ID is invalid");
  }
  return match[1];
}

function changeRequestPath(
  provider: HostingProviderKind,
  project: string,
  number: number,
  suffix = "",
): string {
  const trailing = suffix.length === 0 ? "" : `/${suffix}`;
  return provider === "gitHub"
    ? `repos/${encodedGitHubProject(project)}/pulls/${number}${trailing}`
    : `projects/${encodedGitLabProject(project)}/merge_requests/${number}${trailing}`;
}

function reviewEvent(event: "approve" | "requestChanges" | "comment"): string {
  switch (event) {
    case "approve":
      return "APPROVE";
    case "requestChanges":
      return "REQUEST_CHANGES";
    case "comment":
      return "COMMENT";
  }
}

export function prepareHostingRequest(
  provider: HostingProviderKind,
  request: HostingRequest,
): PreparedHostingRequest {
  const githubProject =
    request.kind === "setViewed" ||
    request.kind === "listNamespaces" ||
    request.kind === "listShareRepositories" ||
    request.kind === "checkShareRepository" ||
    request.kind === "shareRepository"
      ? ""
      : encodedGitHubProject(request.project);
  const gitlabProject =
    request.kind === "setViewed" ||
    request.kind === "listNamespaces" ||
    request.kind === "listShareRepositories" ||
    request.kind === "checkShareRepository" ||
    request.kind === "shareRepository"
      ? ""
      : encodedGitLabProject(request.project);
  switch (request.kind) {
    case "list":
      return Object.freeze({
        method: "GET",
        path:
          provider === "gitHub"
            ? `repos/${githubProject}/pulls?state=all&per_page=${PAGE_SIZE}&page=${request.page}`
            : `projects/${gitlabProject}/merge_requests?scope=all&per_page=${PAGE_SIZE}&page=${request.page}`,
        payload: null,
      });
    case "get":
      return Object.freeze({
        method: "GET",
        path: changeRequestPath(provider, request.project, request.number),
        payload: null,
      });
    case "files":
      return Object.freeze({
        method: "GET",
        path: changeRequestPath(
          provider,
          request.project,
          request.number,
          provider === "gitHub" ? "files?per_page=100" : "changes",
        ),
        payload: null,
      });
    case "timeline":
      return Object.freeze({
        method: "GET",
        path:
          provider === "gitHub"
            ? `repos/${githubProject}/issues/${request.number}/timeline?per_page=100`
            : `projects/${gitlabProject}/merge_requests/${request.number}/notes?per_page=100`,
        payload: null,
      });
    case "viewedFiles": {
      if (provider !== "gitHub") {
        throw new HostingFoundationError(
          "invalidInput",
          "Server-backed viewed files are available for GitHub accounts",
        );
      }
      const [owner, name] = githubProjectCoordinates(request.project);
      return Object.freeze({
        method: "POST",
        path: "graphql",
        payload: {
          query: GITHUB_VIEWED_FILES_QUERY,
          variables: { owner, name, number: request.number },
        },
      });
    }
    case "setViewed":
      if (provider !== "gitHub") {
        throw new HostingFoundationError(
          "invalidInput",
          "Server-backed viewed state is available for GitHub accounts",
        );
      }
      return Object.freeze({
        method: "POST",
        path: "graphql",
        payload: {
          query: request.viewed
            ? GITHUB_MARK_FILE_VIEWED_MUTATION
            : GITHUB_UNMARK_FILE_VIEWED_MUTATION,
          variables: {
            pullRequestId: request.pullRequestId,
            path: request.path,
          },
        },
      });
    case "create":
      return Object.freeze({
        method: "POST",
        path:
          provider === "gitHub"
            ? `repos/${githubProject}/pulls`
            : `projects/${gitlabProject}/merge_requests`,
        payload:
          provider === "gitHub"
            ? {
                title: request.title,
                body: request.body,
                head: request.sourceBranch,
                base: request.targetBranch,
                draft: request.draft,
              }
            : {
                title: request.draft ? `Draft: ${request.title}` : request.title,
                description: request.body,
                source_branch: request.sourceBranch,
                target_branch: request.targetBranch,
              },
      });
    case "comment":
      return Object.freeze({
        method: "POST",
        path:
          provider === "gitHub"
            ? `repos/${githubProject}/issues/${request.number}/comments`
            : `projects/${gitlabProject}/merge_requests/${request.number}/notes`,
        payload: { body: request.body },
      });
    case "review":
      if (provider === "gitHub") {
        return Object.freeze({
          method: "POST",
          path: `repos/${githubProject}/pulls/${request.number}/reviews`,
          payload: { event: reviewEvent(request.event), body: request.body },
        });
      }
      if (request.event === "approve") {
        return Object.freeze({
          method: "POST",
          path: `projects/${gitlabProject}/merge_requests/${request.number}/approve`,
          payload: {},
        });
      }
      return Object.freeze({
        method: "POST",
        path: `projects/${gitlabProject}/merge_requests/${request.number}/notes`,
        payload: {
          body:
            request.event === "requestChanges" ? `Request changes: ${request.body}` : request.body,
        },
      });
    case "updateBranch":
      return Object.freeze({
        method: "PUT",
        path:
          provider === "gitHub"
            ? `repos/${githubProject}/pulls/${request.number}/update-branch`
            : `projects/${gitlabProject}/merge_requests/${request.number}/rebase`,
        payload: {},
      });
    case "syncFork":
      if (provider !== "gitHub") {
        throw new HostingFoundationError(
          "invalidInput",
          "Fork sync is available for GitHub accounts",
        );
      }
      return Object.freeze({
        method: "POST",
        path: `repos/${githubProject}/merge-upstream`,
        payload: { branch: request.branch },
      });
    case "listNamespaces":
      if (provider !== "gitLab") {
        throw new HostingFoundationError(
          "invalidInput",
          "Project namespaces are available for GitLab accounts",
        );
      }
      return Object.freeze({
        method: "POST",
        path: "graphql",
        payload: { query: GITLAB_SHARE_NAMESPACES_QUERY },
      });
    case "listShareRepositories":
      if (provider !== "gitHub") {
        throw new HostingFoundationError(
          "invalidInput",
          "Owned share repositories are available for GitHub accounts",
        );
      }
      return Object.freeze({
        method: "GET",
        path: "user",
        payload: null,
      });
    case "checkShareRepository":
      if (provider !== "gitLab") {
        throw new HostingFoundationError(
          "invalidInput",
          "Repository availability checks are available for GitLab accounts",
        );
      }
      return Object.freeze({
        method: "POST",
        path: "graphql",
        payload: {
          query: GITLAB_CHECK_SHARE_REPOSITORY_QUERY,
          variables: { fullPath: `${request.namespacePath}/${request.name}` },
        },
      });
    case "shareRepository":
      return Object.freeze({
        method: "POST",
        path: provider === "gitHub" ? "user/repos" : "projects",
        payload:
          provider === "gitHub"
            ? {
                name: request.name,
                description: request.description,
                private: request.private,
              }
            : {
                name: request.name,
                description: request.description,
                visibility: request.private ? "private" : "public",
                ...(request.namespaceId === null
                  ? {}
                  : { namespace_id: gitlabNamespaceRestId(request.namespaceId) }),
              },
      });
  }
}

function parseChangeRequest(provider: HostingProviderKind, value: unknown): HostingChangeRequest {
  const item = record(value, "change request");
  if (provider === "gitHub") {
    return Object.freeze({
      number: numberValue(item, "number"),
      title: stringValue(item, "title"),
      state: stringValue(item, "state"),
      author: nestedString(item, ["user", "login"]),
      sourceBranch: nestedString(item, ["head", "ref"]),
      targetBranch: nestedString(item, ["base", "ref"]),
      webUrl: stringValue(item, "html_url"),
      nodeId: optionalString(item, "node_id"),
      draft: optionalBoolean(item, "draft"),
      updatedAt: stringValue(item, "updated_at"),
    });
  }
  const title = stringValue(item, "title");
  const explicitDraft = item.draft;
  return Object.freeze({
    number: numberValue(item, "iid"),
    title,
    state: stringValue(item, "state"),
    author: nestedString(item, ["author", "username"]),
    sourceBranch: stringValue(item, "source_branch"),
    targetBranch: stringValue(item, "target_branch"),
    webUrl: stringValue(item, "web_url"),
    nodeId: null,
    draft:
      typeof explicitDraft === "boolean"
        ? explicitDraft
        : title.startsWith("Draft:") || title.startsWith("WIP:"),
    updatedAt: stringValue(item, "updated_at"),
  });
}

function parseChangedFile(provider: HostingProviderKind, value: unknown): HostingChangedFile {
  const item = record(value, "changed file");
  if (provider === "gitHub") {
    return Object.freeze({
      path: stringValue(item, "filename"),
      previousPath: optionalString(item, "previous_filename"),
      status: stringValue(item, "status"),
      additions: optionalNumber(item, "additions"),
      deletions: optionalNumber(item, "deletions"),
      patch: optionalString(item, "patch"),
    });
  }
  const patch = optionalString(item, "diff") ?? "";
  const lines = patch.split(/\r?\n/u);
  return Object.freeze({
    path: stringValue(item, "new_path"),
    previousPath: optionalString(item, "old_path"),
    status: optionalBoolean(item, "new_file")
      ? "added"
      : optionalBoolean(item, "deleted_file")
        ? "deleted"
        : optionalBoolean(item, "renamed_file")
          ? "renamed"
          : "modified",
    additions: lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length,
    deletions: lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length,
    patch: patch.length === 0 ? null : patch,
  });
}

function parseTimelineEntry(provider: HostingProviderKind, value: unknown): HostingTimelineEntry {
  const item = record(value, "timeline");
  const rawId = item.id;
  const id =
    typeof rawId === "string"
      ? rawId
      : Number.isSafeInteger(rawId) && typeof rawId === "number"
        ? String(rawId)
        : randomUUID();
  if (provider === "gitHub") {
    const actor = nestedString(item, ["actor", "login"]);
    return Object.freeze({
      id,
      kind: optionalString(item, "event") ?? "comment",
      author: actor.length === 0 ? nestedString(item, ["user", "login"]) : actor,
      body: optionalString(item, "body") ?? "",
      createdAt: optionalString(item, "created_at") ?? "",
    });
  }
  return Object.freeze({
    id,
    kind: optionalBoolean(item, "system") ? "event" : "comment",
    author: nestedString(item, ["author", "username"]),
    body: optionalString(item, "body") ?? "",
    createdAt: optionalString(item, "created_at") ?? "",
  });
}

export function parseHostingResponse(
  provider: HostingProviderKind,
  request: HostingRequest,
  value: unknown,
): HostingResponse {
  switch (request.kind) {
    case "list": {
      const values = array(value, "list");
      return Object.freeze({
        kind: "changeRequests",
        items: values.map((item) => parseChangeRequest(provider, item)),
        nextPage: values.length === PAGE_SIZE ? request.page + 1 : null,
      });
    }
    case "get":
    case "create":
      return Object.freeze({
        kind: "changeRequest",
        item: parseChangeRequest(provider, value),
      });
    case "files": {
      const values =
        provider === "gitHub"
          ? array(value, "files")
          : array(record(value, "files").changes, "files");
      return Object.freeze({
        kind: "files",
        items: values.map((item) => parseChangedFile(provider, item)),
      });
    }
    case "timeline":
      return Object.freeze({
        kind: "timeline",
        items: array(value, "timeline").map((item) => parseTimelineEntry(provider, item)),
      });
    case "viewedFiles": {
      const data = graphQlData(value, "viewed files");
      const repository = record(data.repository, "viewed files repository");
      const pullRequest = record(repository.pullRequest, "viewed files pull request");
      const files = record(pullRequest.files, "viewed files connection");
      const paths = array(files.nodes, "viewed files nodes").flatMap((node) => {
        if (node === null) return [];
        const file = record(node, "viewed file");
        return file.viewerViewedState === "VIEWED" ? [stringValue(file, "path")] : [];
      });
      return Object.freeze({ kind: "viewedFiles", paths });
    }
    case "setViewed":
      graphQlData(value, "set viewed state");
      return Object.freeze({ kind: "completed", message: "Viewed state updated" });
    case "comment":
      return Object.freeze({ kind: "completed", message: "Comment posted" });
    case "review":
      return Object.freeze({ kind: "completed", message: "Review submitted" });
    case "updateBranch":
      return Object.freeze({ kind: "completed", message: "Branch update requested" });
    case "syncFork":
      return Object.freeze({ kind: "completed", message: "Fork synchronized" });
    case "listNamespaces": {
      if (provider !== "gitLab") {
        throw invalidResponse("GitHub does not return GitLab namespaces");
      }
      const data = graphQlData(value, "share namespaces");
      const currentUser = record(data.currentUser, "namespace current user");
      const personal = record(currentUser.namespace, "personal namespace");
      const groups = record(data.groups, "namespace groups");
      const groupItems = array(groups.nodes, "namespace groups").flatMap((item) => {
        if (item === null) return [];
        const group = record(item, "namespace group");
        const permissions = record(group.userPermissions, "namespace group permissions");
        if (!optionalBoolean(permissions, "createProjects")) return [];
        return [
          Object.freeze({
            id: stringValue(group, "id"),
            fullName: stringValue(group, "fullName"),
            fullPath: stringValue(group, "fullPath"),
            personal: false,
          }),
        ];
      });
      return Object.freeze({
        kind: "namespaces",
        items: Object.freeze([
          Object.freeze({
            id: null,
            fullName: stringValue(personal, "fullName"),
            fullPath: stringValue(personal, "fullPath"),
            personal: true,
          }),
          ...groupItems,
        ]),
      });
    }
    case "listShareRepositories": {
      if (provider !== "gitHub") {
        throw invalidResponse("GitLab does not return GitHub owned repositories");
      }
      const data = record(value, "share repository information");
      const profile = record(data.profile, "share repository profile");
      const repositories = array(data.repositories, "owned share repositories");
      const planValue = profile.plan;
      const plan =
        planValue === null || planValue === undefined
          ? null
          : record(planValue, "GitHub user plan");
      const ownedPrivate = optionalNumber(profile, "owned_private_repos");
      const privateLimit = plan === null ? null : optionalNumber(plan, "private_repos");
      return Object.freeze({
        kind: "shareRepositories",
        canCreatePrivate:
          plan === null ||
          ownedPrivate === null ||
          privateLimit === null ||
          privateLimit > ownedPrivate,
        names: Object.freeze(
          repositories.map((item) => stringValue(record(item, "owned repository"), "name")),
        ),
      });
    }
    case "checkShareRepository": {
      if (provider !== "gitLab") {
        throw invalidResponse("GitHub does not return GitLab repository availability");
      }
      const data = graphQlData(value, "share repository availability");
      if (data.project !== null && !isRecord(data.project)) {
        throw invalidResponse("GitLab project availability response is invalid");
      }
      return Object.freeze({
        kind: "repositoryAvailability",
        exists: data.project !== null,
      });
    }
    case "shareRepository": {
      const repository = record(value, "repository");
      return provider === "gitHub"
        ? Object.freeze({
            kind: "repository",
            project: stringValue(repository, "full_name"),
            webUrl: stringValue(repository, "html_url"),
            cloneUrl: stringValue(repository, "clone_url"),
            sshUrl: optionalString(repository, "ssh_url"),
          })
        : Object.freeze({
            kind: "repository",
            project: stringValue(repository, "path_with_namespace"),
            webUrl: stringValue(repository, "web_url"),
            cloneUrl: stringValue(repository, "http_url_to_repo"),
            sshUrl: optionalString(repository, "ssh_url_to_repo"),
          });
    }
  }
}
