import type { RepositorySnapshot, ShelfEntry } from "../generated";
import type { Commit, FileChange, Ref, RepositoryView, StatusModel } from "./types";

const SUBJECTS = [
  "feat: add workspace-aware repository sessions",
  "fix(graph): preserve lanes across page boundaries",
  "refactor: isolate credential redaction",
  "test: cover rebase conflict recovery",
  "chore(deps): update tauri to 2.11.5",
  "feat(diff): support line-level staging",
  "fix: debounce duplicate status refreshes",
  "docs: record destructive operation safeguards",
  "perf(log): render first 500 commits lazily",
  "feat: resolve GitLab forge URLs",
] as const;
const AUTHORS = ["Jongmin Chung", "Suh Junmin", "Jamie", "renovate-ci"] as const;
const now = Math.floor(Date.now() / 1000);

function oid(index: number): string {
  return `${(index + 1).toString(16).padStart(8, "0")}b1a7e4c9d2f6a8305e77c4f91a12d0aa`;
}

export const sampleCommits: readonly Commit[] = Array.from({ length: 140 }, (_, index) => {
  const parents = index === 139 ? [] : [oid(index + 1)];
  if (index === 12) parents.push(oid(18));
  return {
    oid: oid(index),
    parents,
    author: AUTHORS[index % AUTHORS.length]!,
    email: `${AUTHORS[index % AUTHORS.length]!.toLowerCase().replaceAll(" ", ".")}@example.com`,
    authoredAt: now - index * 4_700,
    committedAt: now - index * 4_700,
    refs:
      index === 0
        ? ["HEAD -> refs/heads/main", "refs/remotes/origin/main"]
        : index === 7
          ? ["refs/heads/feat/merge-editor"]
          : index === 22
            ? ["tag: refs/tags/v0.1.0"]
            : [],
    subject: SUBJECTS[index % SUBJECTS.length]!,
    body:
      index === 0
        ? "Keep repository sessions isolated while sharing the same dense log workspace.\n\nRefs: GC-142"
        : "The change keeps Git as the source of truth and adds no repository-local metadata.",
  };
});

export const sampleRefs: readonly Ref[] = [
  {
    name: "refs/heads/main",
    shortName: "main",
    oid: oid(0),
    kind: "local",
    current: true,
    upstream: "refs/remotes/origin/main",
    tracking: "",
    subject: SUBJECTS[0],
    author: AUTHORS[0],
    timestamp: now,
    favorite: true,
  },
  {
    name: "refs/heads/feat/merge-editor",
    shortName: "feat/merge-editor",
    oid: oid(7),
    kind: "local",
    current: false,
    subject: SUBJECTS[7],
    author: AUTHORS[3],
    timestamp: now - 32_900,
    favorite: true,
  },
  {
    name: "refs/heads/feat/worktree-sessions",
    shortName: "feat/worktree-sessions",
    oid: oid(16),
    kind: "local",
    current: false,
    subject: SUBJECTS[6],
    author: AUTHORS[1],
    timestamp: now - 75_200,
    favorite: false,
  },
  {
    name: "refs/heads/fix/status-race",
    shortName: "fix/status-race",
    oid: oid(6),
    kind: "local",
    current: false,
    subject: SUBJECTS[6],
    author: AUTHORS[2],
    timestamp: now - 28_200,
    favorite: false,
  },
  {
    name: "refs/remotes/origin/main",
    shortName: "origin/main",
    oid: oid(1),
    kind: "remote",
    current: false,
    subject: SUBJECTS[1],
    author: AUTHORS[1],
    timestamp: now - 4_700,
    favorite: true,
  },
  {
    name: "refs/remotes/origin/feat/merge-editor",
    shortName: "origin/feat/merge-editor",
    oid: oid(9),
    kind: "remote",
    current: false,
    subject: SUBJECTS[9],
    author: AUTHORS[1],
    timestamp: now - 42_300,
    favorite: false,
  },
  {
    name: "refs/tags/v0.1.0",
    shortName: "v0.1.0",
    oid: oid(22),
    kind: "tag",
    current: false,
    subject: SUBJECTS[2],
    author: AUTHORS[2],
    timestamp: now - 103_400,
    favorite: false,
  },
];

export const sampleStatus: StatusModel = {
  branchOid: oid(0),
  branch: "main",
  upstream: "origin/main",
  ahead: 1,
  behind: 0,
  stashCount: 3,
  changes: [
    {
      path: "src/domain/actionAvailability.ts",
      status: "modified",
      staged: true,
      worktree: false,
      additions: 34,
      deletions: 4,
    },
    {
      path: "src/components/CommitGraph.tsx",
      status: "added",
      staged: true,
      worktree: false,
      additions: 81,
      deletions: 0,
    },
    {
      path: "src-tauri/src/git.rs",
      status: "modified",
      staged: false,
      worktree: true,
      additions: 22,
      deletions: 9,
    },
    {
      path: "README.md",
      status: "modified",
      staged: false,
      worktree: true,
      additions: 8,
      deletions: 2,
    },
    {
      path: "notes/한글 경로.md",
      status: "untracked",
      staged: false,
      worktree: true,
      additions: 12,
      deletions: 0,
    },
  ],
};

export const sampleSnapshot: RepositorySnapshot = {
  id: "demo-repository",
  name: "git-client",
  path: "/Users/jaime/Code/git-client",
  gitDirectory: "/Users/jaime/Code/git-client/.git",
  commonDirectory: "/Users/jaime/Code/git-client/.git",
  currentBranch: "main",
  headOid: oid(0),
  upstream: "origin/main",
  remoteUrl: "git@github.com:jongminchung/git-client.git",
  ahead: 1,
  behind: 0,
  isBare: false,
  isShallow: false,
  isDetached: false,
  hasCommits: true,
  operation: null,
  gitVersion: { major: 2, minor: 55, patch: 0, display: "git version 2.55.0" },
};

export const sampleRepository: RepositoryView = {
  snapshot: sampleSnapshot,
  refs: sampleRefs,
  commits: sampleCommits,
  status: sampleStatus,
};

export const sampleCommitFiles: readonly FileChange[] = [
  {
    path: "src/components/CommitLog.tsx",
    status: "modified",
    staged: false,
    worktree: false,
    additions: 38,
    deletions: 9,
  },
  {
    path: "src/domain/actionAvailability.ts",
    status: "modified",
    staged: false,
    worktree: false,
    additions: 16,
    deletions: 3,
  },
  {
    path: "src-tauri/src/git.rs",
    status: "added",
    staged: false,
    worktree: false,
    additions: 142,
    deletions: 0,
  },
  {
    path: "src/styles/App.module.css",
    status: "modified",
    staged: false,
    worktree: false,
    additions: 55,
    deletions: 21,
  },
  {
    path: "README.md",
    status: "modified",
    staged: false,
    worktree: false,
    additions: 10,
    deletions: 2,
  },
];

export const samplePatch = `diff --git a/src/domain/actionAvailability.ts b/src/domain/actionAvailability.ts
index 9c3a912..21254b1 100644
--- a/src/domain/actionAvailability.ts
+++ b/src/domain/actionAvailability.ts
@@ -8,7 +8,12 @@ export function deriveActionAvailability(context: SelectionContext) {
   const exactlyOne = selectedCount === 1;
-  const canRewrite = Boolean(context.currentBranch);
+  const canRewrite = Boolean(context.currentBranch) &&
+    !context.operationInProgress;
+  const selectedIsHead = selected?.oid === context.headOid;

-  return { reset: exactlyOne && canRewrite };
+  return {
+    reset: exactlyOne && canRewrite,
+    drop: exactlyOne && canRewrite && !selectedIsHead,
+  };
 }
`;

export const sampleShelves: readonly ShelfEntry[] = [
  {
    id: "f6478d5c-5aa0-4d4a-b646-cb950b0ca555",
    repositoryId: sampleSnapshot.id,
    message: "WIP: merge editor result model",
    createdAtMs: Date.now() - 3_600_000,
    files: [
      { path: "src/components/MergeEditor.tsx", checksum: "", untracked: false },
      { path: "src/domain/conflicts.ts", checksum: "", untracked: false },
      { path: "notes/merge-cases.md", checksum: "a5e", untracked: true },
    ],
    indexPatchChecksum: "4ad0",
    worktreePatchChecksum: "9ce1",
  },
];
