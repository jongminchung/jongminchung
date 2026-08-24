import { describe, expect, it } from "vitest";
import type { HostingChangeRequest } from "../shared/contracts/model/index";
import {
  adjacentHostingChangeRequest,
  filterHostingChangeRequests,
} from "./hostingView";

const ITEMS = [
  {
    number: 12,
    title: "Add review workflow",
    state: "open",
    author: "octocat",
    sourceBranch: "feature/review",
    targetBranch: "main",
    webUrl: "https://github.com/acme/repo/pull/12",
    nodeId: "PR_12",
    draft: false,
    updatedAt: "2026-07-19T00:00:00Z",
  },
  {
    number: 13,
    title: "Draft the merge UI",
    state: "open",
    author: "fox",
    sourceBranch: "feature/merge",
    targetBranch: "main",
    webUrl: "https://gitlab.com/acme/repo/-/merge_requests/13",
    nodeId: null,
    draft: true,
    updatedAt: "2026-07-19T00:00:00Z",
  },
  {
    number: 14,
    title: "Retire legacy bridge",
    state: "closed",
    author: "octocat",
    sourceBranch: "cleanup",
    targetBranch: "main",
    webUrl: "https://github.com/acme/repo/pull/14",
    nodeId: "PR_14",
    draft: false,
    updatedAt: "2026-07-19T00:00:00Z",
  },
] as const satisfies readonly HostingChangeRequest[];

describe("반응 변경 요청 보기", () => {
  it("[성공] Rebased 스타일의 상태 범위와 텍스트 검색을 함께 적용함", () => {
    expect(filterHostingChangeRequests(ITEMS, "octocat", "open")).toEqual([
      ITEMS[0],
    ]);
    expect(filterHostingChangeRequests(ITEMS, "13", "draft")).toEqual([
      ITEMS[1],
    ]);
    expect(filterHostingChangeRequests(ITEMS, "legacy", "all")).toEqual([
      ITEMS[2],
    ]);
  });

  it("[성공] 키보드 목록 탐색을 위해 예상대로 이동함", () => {
    expect(adjacentHostingChangeRequest(ITEMS, null, "next")).toBe(ITEMS[0]);
    expect(adjacentHostingChangeRequest(ITEMS, 13, "previous")).toBe(ITEMS[0]);
    expect(adjacentHostingChangeRequest(ITEMS, 14, "next")).toBe(ITEMS[2]);
    expect(adjacentHostingChangeRequest(ITEMS, 14, "first")).toBe(ITEMS[0]);
    expect(adjacentHostingChangeRequest(ITEMS, 12, "last")).toBe(ITEMS[2]);
  });
});
