import type { GitOperation, PushPreview } from "../shared/contracts/model";

export type PushChoice = "normal" | "forceWithLease";

export function canForceWithLease(preview: PushPreview): boolean {
  return Boolean(
    preview.expectedLeaseOid &&
    preview.remoteOid &&
    !preview.newBranch &&
    !preview.remoteStateError &&
    preview.fastForward === false,
  );
}

export function canNormalPush(preview: PushPreview): boolean {
  return preview.fastForward !== false;
}

export function requiresPushConfirmation(
  preview: PushPreview,
  choice: PushChoice,
  knownRewrite: boolean,
): boolean {
  return (
    choice === "forceWithLease" &&
    (preview.protectedBranch || (preview.fastForward === false && !knownRewrite))
  );
}

export function createPushOperation(
  preview: PushPreview,
  choice: PushChoice,
  setUpstream: boolean,
): GitOperation {
  if (choice === "normal" && !canNormalPush(preview)) {
    throw new Error("Normal push is unavailable for a non-fast-forward destination");
  }
  if (choice === "forceWithLease" && !canForceWithLease(preview)) {
    throw new Error("Force push requires an exact reviewed remote object ID");
  }
  return {
    kind: "push",
    destination: {
      remote: preview.remote,
      remoteRef: preview.remoteRef,
      localRevision: preview.sourceRevision,
      setUpstream,
    },
    mode:
      choice === "normal"
        ? { kind: "normal" }
        : { kind: "forceWithLease", expectedRemoteOid: preview.expectedLeaseOid ?? "" },
  };
}
