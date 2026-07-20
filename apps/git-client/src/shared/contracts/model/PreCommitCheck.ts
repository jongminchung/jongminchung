export type PreCommitCheck = {
  branch: string | null;
  detachedHead: boolean;
  protectedBranch: boolean;
  crlfPaths: Array<string>;
  largeFiles: Array<string>;
  riskyPaths: Array<string>;
  hooks: Array<string>;
};
