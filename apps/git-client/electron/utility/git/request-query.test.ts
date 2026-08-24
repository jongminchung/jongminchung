import { describe, expect, it } from "vitest";
import type {
  GitRequest,
  LogFilters,
  RepositoryId,
} from "../../../src/shared/contracts/model";
import {
  buildRequestArguments,
  type QueryOnlyGitRequest,
} from "./request-query";

const repositoryId = "00000000-0000-4000-8000-000000000001" as RepositoryId;
const filters: LogFilters = {
  query: null,
  branch: null,
  author: null,
  since: null,
  until: null,
  paths: [],
  noMerges: false,
  regex: false,
  matchCase: false,
};

describe("buildRequest인수", () => {
  it.each<readonly [QueryOnlyGitRequest, string]>([
    [{ kind: "status", repositoryId }, "status"],
    [{ kind: "refs", repositoryId }, "for-each-ref"],
    [
      {
        kind: "log",
        repositoryId,
        skip: 0,
        limit: 1000,
        order: "topology",
        filters,
      },
      "log",
    ],
    [{ kind: "commitDetails", repositoryId, revision: "HEAD" }, "show"],
    [
      {
        kind: "diff",
        repositoryId,
        from: null,
        to: null,
        paths: [],
        staged: false,
        options: { whitespace: "show", contextLines: 3 },
      },
      "diff",
    ],
    [{ kind: "tree", repositoryId, revision: "HEAD", path: null }, "ls-tree"],
    [
      {
        kind: "fileHistory",
        repositoryId,
        path: "file.txt",
        skip: 0,
        limit: 50,
      },
      "log",
    ],
    [
      { kind: "blame", repositoryId, revision: null, path: "file.txt" },
      "blame",
    ],
    [{ kind: "stashList", repositoryId }, "stash"],
    [
      {
        kind: "stashShow",
        repositoryId,
        stash: "stash@{0}",
        mode: "files",
      },
      "stash",
    ],
    [{ kind: "configList", repositoryId }, "config"],
    [{ kind: "submoduleStatus", repositoryId }, "submodule"],
    [{ kind: "signature", repositoryId, revision: "HEAD" }, "show"],
    [
      { kind: "checkIgnored", repositoryId, paths: ["ignored.txt"] },
      "ls-files",
    ],
    [{ kind: "mergedBranches", repositoryId, target: "HEAD" }, "for-each-ref"],
    [
      {
        kind: "pushPreview",
        repositoryId,
        remote: "origin",
        remoteRef: "refs/heads/main",
        localRevision: "HEAD",
      },
      "ls-remote",
    ],
    [
      {
        kind: "historyRewritePreview",
        repositoryId,
        fromRevision: "HEAD~2",
      },
      "log",
    ],
  ])("[성공] $0.kind에 대한 고정 실행 파일을 빌드함", (request, executable) => {
    expect(buildRequestArguments(request)[0]).toBe(executable);
  });

  it("[성공] 지원되는 모든 임시 필터를 유지하고 페이지 크기를 고정함", () => {
    const args = buildRequestArguments({
      kind: "log",
      repositoryId,
      skip: 7,
      limit: 5_000,
      order: "date",
      filters: {
        query: "fix",
        branch: "main",
        author: "A Person",
        since: "2025-01-01",
        until: "2026-01-01",
        paths: ["src/file.ts"],
        noMerges: true,
        regex: false,
        matchCase: false,
      },
    });
    expect(args).toEqual(
      expect.arrayContaining([
        "--skip=7",
        "--max-count=500",
        "--date-order",
        "--no-merges",
        "--regexp-ignore-case",
        "--fixed-strings",
        "--grep=fix",
        "--author=A Person",
        "--since=2025-01-01",
        "--until=2026-01-01",
        "main",
        "--",
        "src/file.ts",
      ]),
    );
  });

  it("[성공] 요청된 경우에만 대죄를 구분하는 확장식을 사용함", () => {
    const args = buildRequestArguments({
      kind: "log",
      repositoryId,
      skip: 0,
      limit: 500,
      order: "topology",
      filters: {
        ...filters,
        query: "^Fix\\(.+\\)$",
        regex: true,
        matchCase: true,
      },
    });

    expect(args).toContain("--extended-regexp");
    expect(args).not.toContain("--fixed-strings");
    expect(args).not.toContain("--regexp-ignore-case");
  });

  it("[실패] 고속도로 순회, 부스션과 놀라운 적용, 거짓 사용자, NUL 및 통합 페이지를 찾아드립니다", () => {
    const invalidRequests: GitRequest[] = [
      { kind: "tree", repositoryId, revision: "HEAD", path: "../secret" },
      { kind: "signature", repositoryId, revision: "--all" },
      {
        kind: "pushPreview",
        repositoryId,
        remote: "origin/evil",
        remoteRef: "refs/heads/main",
        localRevision: "HEAD",
      },
      {
        kind: "log",
        repositoryId,
        skip: 0,
        limit: 100,
        order: "topology",
        filters: { ...filters, query: "bad\0query" },
      },
      {
        kind: "fileHistory",
        repositoryId,
        path: "file",
        skip: -1,
        limit: 1,
      },
    ];
    for (const request of invalidRequests) {
      expect(() =>
        buildRequestArguments(request as QueryOnlyGitRequest),
      ).toThrow();
    }
  });
});
