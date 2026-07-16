import { describe, expect, it } from "vitest";
import { restoredWorkspaceTab, workspacePaths } from "./workspacePersistence";

const sessions = [
  {
    kind: "repository" as const,
    repository: { snapshot: { id: "repo-a", path: "/work/a" } },
  },
  { kind: "error" as const, id: "error:/missing", path: "/missing" },
  {
    kind: "repository" as const,
    repository: { snapshot: { id: "repo-b", path: "/work/b" } },
  },
];

describe("workspace persistence", () => {
  it("preserves repository and failed-path tab order", () => {
    expect(workspacePaths(sessions)).toEqual(["/work/a", "/missing", "/work/b"]);
  });

  it("restores repository, error, and Manage active tabs", () => {
    expect(restoredWorkspaceTab(sessions, "/work/b")).toEqual({
      kind: "repository",
      repositoryId: "repo-b",
    });
    expect(restoredWorkspaceTab(sessions, "/missing")).toEqual({
      kind: "error",
      sessionId: "error:/missing",
    });
    expect(restoredWorkspaceTab(sessions, "/unknown")).toEqual({ kind: "manage" });
  });
});
