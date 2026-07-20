import type { HostingReviewEvent } from "./HostingReviewEvent";

export type HostingRequest =
  | { kind: "list"; project: string; page: number }
  | { kind: "get"; project: string; number: number }
  | { kind: "files"; project: string; number: number }
  | { kind: "timeline"; project: string; number: number }
  | { kind: "viewedFiles"; project: string; number: number }
  | { kind: "setViewed"; pullRequestId: string; path: string; viewed: boolean }
  | {
      kind: "create";
      project: string;
      title: string;
      body: string;
      sourceBranch: string;
      targetBranch: string;
      draft: boolean;
    }
  | { kind: "comment"; project: string; number: number; body: string }
  | { kind: "review"; project: string; number: number; event: HostingReviewEvent; body: string }
  | { kind: "updateBranch"; project: string; number: number }
  | { kind: "syncFork"; project: string; branch: string }
  | { kind: "listNamespaces" }
  | { kind: "listShareRepositories" }
  | { kind: "checkShareRepository"; namespacePath: string; name: string }
  | {
      kind: "shareRepository";
      name: string;
      description: string;
      private: boolean;
      namespaceId: string | null;
    };
