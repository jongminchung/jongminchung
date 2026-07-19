import { describe, expect, it } from "vitest";
import type { FileChange, TreeEntry } from "./types";
import { mergeProjectTreeEntries } from "./projectTree";

const tracked: readonly TreeEntry[] = [
  { mode: "040000", kind: "tree", oid: "tree-src", path: "src" },
  { mode: "100644", kind: "blob", oid: "blob-readme", path: "README.md" },
];

const changes: readonly FileChange[] = [
  { path: "README.md", status: "modified", staged: false, worktree: true },
  { path: "notes/한글 경로.md", status: "untracked", staged: false, worktree: true },
  { path: "src/App.tsx", status: "modified", staged: false, worktree: true },
];

describe("project tree", () => {
  it("merges tracked and working-tree-only root entries", () => {
    expect(mergeProjectTreeEntries("", tracked, changes)).toEqual([
      { path: "notes", name: "notes", kind: "tree", oid: "working-tree:notes" },
      { path: "src", name: "src", kind: "tree", oid: "tree-src", size: undefined },
      {
        path: "README.md",
        name: "README.md",
        kind: "blob",
        oid: "blob-readme",
        size: undefined,
        status: "modified",
      },
    ]);
  });

  it("exposes untracked descendants inside synthetic directories", () => {
    expect(mergeProjectTreeEntries("notes", [], changes)).toEqual([
      {
        path: "notes/한글 경로.md",
        name: "한글 경로.md",
        kind: "blob",
        oid: "working-tree:notes/한글 경로.md",
        status: "untracked",
      },
    ]);
  });
});

