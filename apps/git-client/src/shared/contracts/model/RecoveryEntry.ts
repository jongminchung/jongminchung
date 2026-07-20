import type { RecoveryRef } from "./RecoveryRef";
import type { RepositoryId } from "./RepositoryId";

export type RecoveryEntry = {
  id: string;
  repositoryId: RepositoryId;
  operation: string;
  createdAtMs: number;
  branch: string | null;
  headOid: string | null;
  refs: Array<RecoveryRef>;
  recoverable: boolean;
};
