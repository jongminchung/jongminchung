export type HistoryRewriteResult = {
  branch: string;
  oldHeadOid: string;
  newHeadOid: string;
  rewrittenCommitCount: number;
  publishedCommitCount: number;
  recoveryEntryCreated: boolean;
};
