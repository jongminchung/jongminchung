import { describe, expect, it } from "vitest";
import { deriveActionAvailability } from "./actionAvailability";
import type { Commit, SelectionContext } from "./types";

const commit = (oid: string, parents: readonly string[] = ["parent"]): Commit => ({
  oid,
  parents,
  author: "Jamie",
  email: "jamie@example.com",
  authoredAt: 0,
  committedAt: 0,
  refs: [],
  subject: oid,
  body: "",
});

const context = (overrides: Partial<SelectionContext> = {}): SelectionContext => ({
  selectedCommits: [commit("selected")],
  currentBranch: "main",
  headOid: "head",
  upstream: "origin/main",
  selectedIsAncestorOfHead: true,
  selectedIsAheadOfUpstream: true,
  hasChild: true,
  repositoryHasCommits: true,
  operationInProgress: false,
  ...overrides,
});

describe("deriveActionAvailability", () => {
  it("enables the single local ancestor actions", () => {
    expect(deriveActionAvailability(context())).toMatchObject({
      copyRevision: true,
      cherryPick: true,
      drop: true,
      pushUpTo: true,
      goToParent: true,
      goToChild: true,
    });
  });

  it("disables branch mutations for detached HEAD and active operations", () => {
    for (const overrides of [{ currentBranch: undefined }, { operationInProgress: true }]) {
      expect(deriveActionAvailability(context(overrides))).toMatchObject({
        reset: false,
        revert: false,
        drop: false,
        pushUpTo: false,
      });
    }
  });

  it("requires two commits for compare and squash", () => {
    const availability = deriveActionAvailability(
      context({ selectedCommits: [commit("a"), commit("b")] }),
    );
    expect(availability).toMatchObject({
      compareVersions: true,
      squash: true,
      copyRevision: false,
      reset: false,
    });
  });

  it("does not drop or cherry-pick HEAD and checks upstream ancestry before partial push", () => {
    expect(
      deriveActionAvailability(context({ selectedCommits: [commit("head")], headOid: "head" })),
    ).toMatchObject({ drop: false, cherryPick: false });
    expect(deriveActionAvailability(context({ selectedIsAncestorOfHead: false }))).toMatchObject({
      drop: false,
      pushUpTo: false,
    });
    expect(deriveActionAvailability(context({ selectedIsAheadOfUpstream: false }))).toMatchObject({
      pushUpTo: false,
    });
  });

  it("handles initial repositories and root commits", () => {
    expect(
      deriveActionAvailability(context({ selectedCommits: [], repositoryHasCommits: false })),
    ).toEqual(expect.objectContaining({ newBranch: false, newTag: false }));
    expect(deriveActionAvailability(context({ selectedCommits: [commit("root", [])] }))).toEqual(
      expect.objectContaining({ goToParent: false }),
    );
  });
});
