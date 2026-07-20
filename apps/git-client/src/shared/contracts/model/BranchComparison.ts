export type BranchComparison = {
  ahead: number;
  behind: number;
  leftOnly: Array<string>;
  rightOnly: Array<string>;
};
