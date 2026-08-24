import type { RepositoryId } from "./RepositoryId";
import type { RepositoryInvalidation } from "./RepositoryInvalidation";

export type RepositoryChangedEvent = {
  repositoryId: RepositoryId;
  invalidations: Array<RepositoryInvalidation>;
};
