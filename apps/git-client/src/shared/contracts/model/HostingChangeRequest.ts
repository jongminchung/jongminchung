export type HostingChangeRequest = {
  number: number;
  title: string;
  state: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  webUrl: string;
  nodeId: string | null;
  draft: boolean;
  updatedAt: string;
};
