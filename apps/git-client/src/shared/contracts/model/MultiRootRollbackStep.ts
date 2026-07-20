import type { GitOperation } from "./GitOperation";
import type { RepositoryId } from "./RepositoryId";

export type MultiRootRollbackStep = {
  repositoryId: RepositoryId;
  path: string;
  description: string;
  operations: Array<GitOperation>;
};
