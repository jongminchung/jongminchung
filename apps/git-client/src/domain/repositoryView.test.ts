import { describe, expect, it } from "vitest";
import { updateRepositoryView } from "./repositoryView";
import type { RepositoryView, StatusModel } from "./types";

describe("updateRepositoryView", () => {
  it("preserves history references during a status-only refresh", () => {
    const repository = {
      snapshot: { id: "repo" },
      refs: [{ name: "refs/heads/main" }],
      commits: [{ oid: "abc" }],
      status: { ahead: 0, behind: 0, stashCount: 0, changes: [] },
    } as unknown as RepositoryView;
    const status: StatusModel = {
      ahead: 0,
      behind: 0,
      stashCount: 0,
      changes: [
        {
          path: "run.sh",
          status: "modified",
          staged: false,
          worktree: true,
        },
      ],
    };

    const updated = updateRepositoryView(repository, { status });

    expect(updated).not.toBe(repository);
    expect(updated.status).toBe(status);
    expect(updated.snapshot).toBe(repository.snapshot);
    expect(updated.refs).toBe(repository.refs);
    expect(updated.commits).toBe(repository.commits);
    expect(updateRepositoryView(updated, {})).toBe(updated);
  });
});
