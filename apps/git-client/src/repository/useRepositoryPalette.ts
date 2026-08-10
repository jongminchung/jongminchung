import { useMemo } from "react";
import { usePaletteItems } from "../components/CommandProvider";
import type { VcsOperationGroup } from "../components/VcsOperationsPopup";
import { COMMAND_ENABLED, commandDisabled, type PaletteItem } from "../domain/commands";
interface RepositoryPaletteContext {
  readonly hasTrackedWorkingChanges: boolean;
  readonly vcsFileEntry: import("../domain/changeReview").ChangeEntry | null;
  readonly vcsFileChange: import("../domain/types").FileChange | null;
  readonly vcsFileVersioned: boolean;
  readonly repository: import("../domain/types").RepositoryView;
  readonly workingEntries: readonly import("../domain/changeReview").ChangeEntry[];
  readonly session: import("../git-session/useGitSessionController").GitSessionController;
  readonly untrackedPaths: string[];
  readonly conflictedFile: import("../domain/types").FileChange | undefined;
  readonly vcsFilePath: string | null;
  readonly recentInspectors: readonly import("./state/workspaceTypes").InspectorState[];
  readonly projectFiles: readonly string[];
  readonly setRepositoryViewMode: (
    value: import("react").SetStateAction<import("../domain/changeReview").RepositoryViewMode>,
  ) => void;
  readonly openInspector: (
    next: import("./state/workspaceTypes").InspectorState,
    keepOpen?: boolean,
  ) => void;
  readonly scratchFiles: readonly import("../domain/scratchFiles").ScratchFile[];
  readonly openScratchFile: (
    scratch: import("../domain/scratchFiles").ScratchFile,
    line?: number,
    column?: number,
  ) => void;
  readonly primaryCommit: import("../domain/types").Commit | undefined;
  readonly availability: import("../domain/types").ActionAvailability;
  readonly setHistoryRewrite: (
    value: import("react").SetStateAction<
      import("./state/workspaceTypes").HistoryRewriteRequest | null
    >,
  ) => void;
  readonly selectRef: (ref: import("../domain/types").Ref) => void;
  readonly setSelectedOids: (value: import("react").SetStateAction<readonly string[]>) => void;
  readonly setChangeSelection: (
    value: import("react").SetStateAction<import("../domain/changeReview").ChangeSelection | null>,
  ) => void;
}

export function useRepositoryPalette(
  context: RepositoryPaletteContext,
): readonly VcsOperationGroup[] {
  const {
    hasTrackedWorkingChanges,
    vcsFileEntry,
    vcsFileChange,
    vcsFileVersioned,
    repository,
    workingEntries,
    session,
    untrackedPaths,
    conflictedFile,
    vcsFilePath,
    recentInspectors,
    projectFiles,
    setRepositoryViewMode,
    openInspector,
    scratchFiles,
    openScratchFile,
    primaryCommit,
    availability,
    setHistoryRewrite,
    selectRef,
    setSelectedOids,
    setChangeSelection,
  } = context;

  const vcsOperationGroups = useMemo<readonly VcsOperationGroup[]>(
    () => [
      {
        label: "Git",
        items: [
          {
            commandId: "view.changes",
            icon: "commit",
            label: "Commit…",
          },
          {
            commandId: "repository.stageTracked",
            disabledReason: hasTrackedWorkingChanges
              ? undefined
              : "There are no tracked changes to stage.",
            icon: "plus",
            label: "Stage All Tracked",
          },
          {
            commandId: "view.changes",
            icon: "changes",
            label: "Toggle Commit UI…",
          },
          {
            commandId: "repository.commitCurrentFile",
            disabledReason: vcsFileEntry ? undefined : "Select a changed file to commit.",
            icon: "commit",
            label: "Commit File",
          },
          {
            commandId: "repository.rollback",
            disabledReason:
              vcsFileChange?.status !== "untracked" && vcsFileChange?.worktree
                ? undefined
                : "Select a tracked file with working-tree changes.",
            icon: "undo",
            label: "Rollback…",
          },
          {
            commandId: "repository.showFileHistory",
            disabledReason:
              vcsFileVersioned && repository.snapshot.hasCommits
                ? undefined
                : "Select a versioned file to show its history.",
            icon: "history",
            label: "Show History",
          },
          {
            commandId: "repository.annotate",
            disabledReason:
              vcsFileVersioned && repository.snapshot.hasCommits
                ? undefined
                : "Select a versioned file to annotate.",
            icon: "file",
            label: "Annotate",
          },
          {
            commandId: "repository.compareCurrentFile",
            disabledReason: vcsFileEntry ? undefined : "Select a changed file to compare.",
            icon: "compare",
            label: "Compare with Same Repository Version",
          },
        ],
      },
      {
        items: [
          {
            commandId: "repository.branches",
            icon: "branch",
            label: "Branches…",
          },
          {
            commandId: "repository.push",
            icon: "push",
            label: "Push…",
          },
          {
            commandId: "repository.stashChanges",
            disabledReason:
              workingEntries.length > 0 ? undefined : "There are no changes to stash.",
            icon: "stash",
            label: "Stash Changes…",
          },
          {
            commandId: "repository.showStash",
            disabledReason: session.stashes.length > 0 ? undefined : "There are no stash entries.",
            icon: "stash",
            label: "Unstash Changes…",
          },
        ],
      },
      {
        items: [
          {
            commandId: "repository.worktrees",
            icon: "worktree",
            label: "Worktrees…",
          },
          {
            commandId: "repository.stageUnversioned",
            disabledReason:
              untrackedPaths.length > 0 ? undefined : "There are no unversioned files to add.",
            icon: "plus",
            label: "Add to VCS",
          },
          {
            commandId: "repository.copyBranchName",
            disabledReason: repository.snapshot.currentBranch ? undefined : "HEAD is detached.",
            icon: "copy",
            label: "Copy Branch Name",
          },
          {
            commandId: "repository.resolveConflicts",
            disabledReason: conflictedFile ? undefined : "There are no unresolved conflicts.",
            icon: "warning",
            label: "Resolve Conflicts…",
          },
          {
            commandId: "repository.unshallow",
            disabledReason: repository.snapshot.isShallow
              ? undefined
              : "The repository is not shallow.",
            icon: "fetch",
            label: "Unshallow repository",
          },
          {
            commandId: "localHistory.show",
            disabledReason: vcsFilePath ? undefined : "Select a file to show its Local History.",
            icon: "history",
            label: "Show History…",
          },
        ],
      },
    ],
    [
      conflictedFile,
      hasTrackedWorkingChanges,
      repository.snapshot.currentBranch,
      repository.snapshot.hasCommits,
      repository.snapshot.isShallow,
      session.stashes.length,
      untrackedPaths.length,
      vcsFileChange,
      vcsFileEntry,
      vcsFilePath,
      vcsFileVersioned,
      workingEntries.length,
    ],
  );

  const recentFilePaths = useMemo(
    () => new Set(recentInspectors.flatMap((entry) => (entry.path ? [entry.path] : []))),
    [recentInspectors],
  );

  const loadedPaletteItems = useMemo<readonly PaletteItem[]>(
    () => [
      ...projectFiles.map((path) => {
        const parts = path.split("/");
        const label = parts.at(-1) ?? path;
        const recent = recentFilePaths.has(path);
        return {
          id: `file:${path}`,
          kind: "file" as const,
          label,
          detail: parts.length > 1 ? parts.slice(0, -1).join("/") : repository.snapshot.name,
          category: recent ? "Recent Files" : "Files",
          keywords: [path],
          scopes: recent
            ? (["files", "recentFiles", "recentLocations"] as const)
            : (["files"] as const),
          availability: COMMAND_ENABLED,
          execute: (): void => {
            setRepositoryViewMode("history");
            openInspector({
              revision: repository.snapshot.headOid ?? "HEAD",
              source: { kind: "workingTree" },
              path,
              tab: "file",
            });
          },
        };
      }),
      ...scratchFiles.map((scratch) => ({
        id: `scratch:${scratch.id}`,
        kind: "file" as const,
        label: scratch.name,
        detail: "Scratches and Consoles",
        category: "Scratch Files",
        keywords: [scratch.languageId, `Scratches/${scratch.name}`],
        scopes: ["files", "recentFiles"] as const,
        availability: COMMAND_ENABLED,
        execute: (): void => openScratchFile(scratch),
      })),
      {
        id: "action:interactive-rebase",
        kind: "command" as const,
        label: "Interactive Rebase from Here…",
        detail: primaryCommit
          ? `Rewrite ${primaryCommit.oid.slice(0, 10)} through HEAD`
          : "Select one commit in the current branch",
        category: "History",
        keywords: ["rewrite", "squash", "fixup", "reword", "drop"],
        availability: availability.interactiveRebase
          ? COMMAND_ENABLED
          : commandDisabled(
              "Select one commit in the current branch and finish active operations.",
            ),
        execute: (): void => {
          if (primaryCommit && availability.interactiveRebase) {
            setHistoryRewrite({
              fromRevision: primaryCommit.oid,
              squashOids: [],
            });
          }
        },
      },
      ...repository.refs.map((ref) => ({
        id: `ref:${ref.name}`,
        kind: "ref" as const,
        label: ref.shortName,
        detail: `${ref.kind} · ${ref.oid.slice(0, 10)}`,
        category: "Refs",
        keywords: [ref.name, ref.oid],
        availability: COMMAND_ENABLED,
        execute: (): void => {
          setRepositoryViewMode("history");
          selectRef(ref);
        },
      })),
      ...repository.commits.map((commit) => ({
        id: `commit:${commit.oid}`,
        kind: "commit" as const,
        label: commit.subject,
        detail: `${commit.oid.slice(0, 10)} · ${commit.author}`,
        category: "Commits",
        keywords: [commit.oid, commit.author, ...commit.refs],
        availability: COMMAND_ENABLED,
        execute: (): void => {
          setRepositoryViewMode("history");
          setSelectedOids([commit.oid]);
        },
      })),
      ...workingEntries.map((entry) => ({
        id: `change:${entry.selection.layer}:${entry.file.path}`,
        kind: "change" as const,
        label: entry.file.path,
        detail: `${entry.selection.layer === "index" ? "Staged" : "Working Tree"} · ${entry.file.status}`,
        category: "Changed Files",
        keywords: [entry.file.oldPath ?? "", entry.file.status],
        scopes: ["recentlyChangedFiles"] as const,
        availability: COMMAND_ENABLED,
        execute: (): void => {
          setRepositoryViewMode("changes");
          setChangeSelection(entry.selection);
        },
      })),
    ],
    [
      availability.interactiveRebase,
      primaryCommit,
      projectFiles,
      recentFilePaths,
      repository.commits,
      repository.refs,
      repository.snapshot.headOid,
      repository.snapshot.name,
      openInspector,
      openScratchFile,
      scratchFiles,
      workingEntries,
      selectRef,
      setRepositoryViewMode,
      setHistoryRewrite,
      setChangeSelection,
      setSelectedOids,
    ],
  );
  usePaletteItems(loadedPaletteItems);

  return vcsOperationGroups;
}
