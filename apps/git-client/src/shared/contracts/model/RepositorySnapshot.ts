import type { GitVersion } from "./GitVersion";
import type { InProgressOperation } from "./InProgressOperation";
import type { RepositoryId } from "./RepositoryId";

export type RepositorySnapshot = {
  id: RepositoryId;
  name: string;
  path: string;
  gitDirectory: string;
  commonDirectory: string;
  currentBranch: string | null;
  headOid: string | null;
  upstream: string | null;
  remoteUrl: string | null;
  ahead: number;
  behind: number;
  isBare: boolean;
  isShallow: boolean;
  isDetached: boolean;
  hasCommits: boolean;
  operation: InProgressOperation | null;
  gitVersion: GitVersion;
};
