import type { RepositoryId } from "./RepositoryId";
import type { ShelfFile } from "./ShelfFile";

export type ShelfEntry = {
  id: string;
  repositoryId: RepositoryId;
  message: string;
  createdAtMs: number;
  files: Array<ShelfFile>;
  indexPatchChecksum: string;
  worktreePatchChecksum: string;
};
