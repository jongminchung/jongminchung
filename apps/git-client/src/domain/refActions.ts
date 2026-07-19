import type { GitOperation } from "../generated";
import type { Ref } from "./types";

export function checkoutTarget(ref: Ref): string {
  return ref.shortName;
}

export function deleteRefOperation(ref: Ref): GitOperation | null {
  if (ref.current) return null;
  if (ref.kind === "local") {
    return { kind: "deleteBranch", name: ref.shortName, force: false };
  }
  if (ref.kind === "tag") {
    return { kind: "deleteTag", name: ref.shortName };
  }
  const [remote, ...branchParts] = ref.shortName.split("/");
  if (!remote || branchParts.length === 0) return null;
  return {
    kind: "deleteRemoteBranch",
    remote,
    branch: branchParts.join("/"),
  };
}
