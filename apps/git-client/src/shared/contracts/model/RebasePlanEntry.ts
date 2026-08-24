import type { RebasePlanAction } from "./RebasePlanAction";

export type RebasePlanEntry = {
  oid: string;
  subject: string;
  parents: Array<string>;
  action: RebasePlanAction;
  message: string | null;
  published: boolean;
  mergeCommit: boolean;
};
