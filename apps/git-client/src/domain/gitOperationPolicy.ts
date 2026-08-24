import type {
  GitOperation,
  RepositoryInvalidation,
} from "../shared/contracts/model/index";

export interface GitOperationPolicy {
  readonly invalidations: readonly RepositoryInvalidation[];
  readonly recordsRecovery: boolean;
  readonly retryable: boolean;
}

const statusOnly = ["status"] as const;
const statusAndHistory = ["status", "history"] as const;
const statusHistoryAndOperation = ["status", "history", "operation"] as const;
const statusHistoryAndStash = ["status", "history", "stash"] as const;
const statusHistoryAndManagement = ["status", "history", "management"] as const;

const indexPolicy = {
  invalidations: statusOnly,
  recordsRecovery: false,
  retryable: false,
} as const satisfies GitOperationPolicy;
const defaultPolicy = {
  invalidations: statusHistoryAndOperation,
  recordsRecovery: false,
  retryable: false,
} as const satisfies GitOperationPolicy;
const recoveryPolicy = {
  invalidations: statusHistoryAndOperation,
  recordsRecovery: true,
  retryable: false,
} as const satisfies GitOperationPolicy;
const retryablePolicy = {
  invalidations: statusHistoryAndOperation,
  recordsRecovery: false,
  retryable: true,
} as const satisfies GitOperationPolicy;
const pushPolicy = {
  invalidations: statusAndHistory,
  recordsRecovery: false,
  retryable: false,
} as const satisfies GitOperationPolicy;
const stashRecoveryPolicy = {
  invalidations: statusHistoryAndStash,
  recordsRecovery: true,
  retryable: false,
} as const satisfies GitOperationPolicy;
const managementPolicy = {
  invalidations: statusHistoryAndManagement,
  recordsRecovery: false,
  retryable: false,
} as const satisfies GitOperationPolicy;

export const gitOperationPolicies = {
  stage: indexPolicy,
  stageAll: indexPolicy,
  stageTracked: indexPolicy,
  addIntent: indexPolicy,
  unstage: indexPolicy,
  removeCached: indexPolicy,
  discard: indexPolicy,
  applyPatch: indexPolicy,
  partialPatch: indexPolicy,
  commit: recoveryPolicy,
  commitAdvanced: recoveryPolicy,
  fetch: retryablePolicy,
  pull: defaultPolicy,
  push: pushPolicy,
  createBranch: recoveryPolicy,
  renameBranch: recoveryPolicy,
  deleteBranch: recoveryPolicy,
  setUpstream: defaultPolicy,
  deleteRemoteBranch: defaultPolicy,
  checkout: defaultPolicy,
  createTag: recoveryPolicy,
  deleteTag: recoveryPolicy,
  pushTag: defaultPolicy,
  reset: recoveryPolicy,
  revert: recoveryPolicy,
  cherryPick: recoveryPolicy,
  merge: recoveryPolicy,
  rebase: recoveryPolicy,
  interactiveRebase: recoveryPolicy,
  dropCommits: recoveryPolicy,
  squashCommits: recoveryPolicy,
  rewordCommit: recoveryPolicy,
  undoCommit: recoveryPolicy,
  createFixupCommit: recoveryPolicy,
  createSquashCommit: recoveryPolicy,
  continue: recoveryPolicy,
  skip: recoveryPolicy,
  abort: recoveryPolicy,
  stashPush: stashRecoveryPolicy,
  stashApply: stashRecoveryPolicy,
  stashDrop: stashRecoveryPolicy,
  stashClear: stashRecoveryPolicy,
  stashBranch: stashRecoveryPolicy,
  unshallow: defaultPolicy,
  updateSubmodules: defaultPolicy,
  setConfig: defaultPolicy,
  worktreeAdd: managementPolicy,
  worktreeRemove: managementPolicy,
  remoteAdd: managementPolicy,
  remoteRemove: managementPolicy,
  remoteSetUrl: managementPolicy,
} as const satisfies Record<GitOperation["kind"], GitOperationPolicy>;

export function operationPolicyFor(
  operation: Pick<GitOperation, "kind">,
): GitOperationPolicy {
  return gitOperationPolicies[operation.kind];
}
