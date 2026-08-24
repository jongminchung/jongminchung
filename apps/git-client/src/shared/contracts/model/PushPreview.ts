import type { PushPreviewCommit } from "./PushPreviewCommit";

export type PushPreview = {
  sourceBranch: string | null;
  sourceRevision: string;
  localOid: string;
  remote: string;
  remoteRef: string;
  upstreamConfigured: boolean;
  setUpstreamDefault: boolean;
  remoteOid: string | null;
  expectedLeaseOid: string | null;
  ahead: number;
  behind: number;
  fastForward: boolean | null;
  newBranch: boolean;
  commits: Array<PushPreviewCommit>;
  remoteOnlyCommits: Array<PushPreviewCommit>;
  protectedBranch: boolean;
  checkedAtMs: number;
  remoteStateError: string | null;
  warnings: Array<string>;
};
