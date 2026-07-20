import type { RepositoryId } from "./RepositoryId";

export type Changelist = {
  id: string;
  repositoryId: RepositoryId;
  name: string;
  paths: Array<string>;
  createdAtMs: number;
  updatedAtMs: number;
};
