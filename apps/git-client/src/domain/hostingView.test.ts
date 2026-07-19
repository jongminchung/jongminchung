import { describe, expect, it } from "vitest";
import type { HostingChangeRequest } from "../generated";
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

describe("hosting change request view", () => {
    it("applies the Rebased-style state scope and text search together", () => {
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

    it("moves predictably for keyboard list navigation", () => {
        expect(adjacentHostingChangeRequest(ITEMS, null, "next")).toBe(
            ITEMS[0],
        );
        expect(adjacentHostingChangeRequest(ITEMS, 13, "previous")).toBe(
            ITEMS[0],
        );
        expect(adjacentHostingChangeRequest(ITEMS, 14, "next")).toBe(ITEMS[2]);
        expect(adjacentHostingChangeRequest(ITEMS, 14, "first")).toBe(ITEMS[0]);
        expect(adjacentHostingChangeRequest(ITEMS, 12, "last")).toBe(ITEMS[2]);
    });
});
