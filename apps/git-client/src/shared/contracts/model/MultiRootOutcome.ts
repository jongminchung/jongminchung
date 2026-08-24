import type { RepositoryId } from "./RepositoryId";

export type MultiRootOutcome = {
  repositoryId: RepositoryId;
  path: string;
  succeeded: boolean;
  message: string;
};
