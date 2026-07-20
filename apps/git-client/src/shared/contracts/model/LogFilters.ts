export type LogFilters = {
  query: string | null;
  branch: string | null;
  author: string | null;
  since: string | null;
  until: string | null;
  paths: Array<string>;
  noMerges: boolean;
  regex: boolean;
  matchCase: boolean;
};
