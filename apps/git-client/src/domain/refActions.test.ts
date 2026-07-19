import { describe, expect, it } from "vitest";
import { sampleRefs } from "./sampleData";
import { checkoutTarget, deleteRefOperation } from "./refActions";

describe("reference actions", () => {
  it("checks out user-facing local, remote, and tag names instead of full refs", () => {
    expect(sampleRefs.map(checkoutTarget)).toEqual(sampleRefs.map((ref) => ref.shortName));
  });

  it("maps each deletable reference kind to the matching Git side effect", () => {
    const local = sampleRefs.find((ref) => ref.kind === "local" && !ref.current);
    const remote = sampleRefs.find((ref) => ref.kind === "remote");
    const tag = sampleRefs.find((ref) => ref.kind === "tag");

    expect(local && deleteRefOperation(local)).toEqual({
      kind: "deleteBranch",
      name: local?.shortName,
      force: false,
    });
    expect(remote && deleteRefOperation(remote)).toEqual({
      kind: "deleteRemoteBranch",
      remote: "origin",
      branch: remote?.shortName.slice("origin/".length),
    });
    expect(tag && deleteRefOperation(tag)).toEqual({
      kind: "deleteTag",
      name: tag?.shortName,
    });
  });

  it("never offers deletion for the current branch", () => {
    const current = sampleRefs.find((ref) => ref.current);
    expect(current && deleteRefOperation(current)).toBeNull();
  });
});
