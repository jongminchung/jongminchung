import type { DependentRefImpact } from "./DependentRefImpact";
import type { RebasePlanEntry } from "./RebasePlanEntry";

export type HistoryRewritePreview = {
  branch: string;
  headOid: string;
  base: string | null;
  root: boolean;
  entries: Array<RebasePlanEntry>;
  publishedCommitCount: number;
  descendantCount: number;
  dependentRefs: Array<DependentRefImpact>;
  hasMerges: boolean;
  protectedBranch: boolean;
  warnings: Array<string>;
};
