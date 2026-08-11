import {
  COMMAND_ENABLED,
  commandDefinition,
  commandDisabled,
  type CommandDefinition,
} from "../../domain/commands";
import { isElectronRuntime } from "../../platform/electron";
import { writeClipboardText } from "../../platform/electronActions";
import type { RepositoryCommandContext } from "./repositoryCommandTypes";

export type VcsCommandPort = Pick<
  RepositoryCommandContext,
  | "applyPatchFromClipboard"
  | "applyPatchFromFile"
  | "availability"
  | "changeSelection"
  | "compareVcsFile"
  | "conflictedFile"
  | "createPatchFromLocalChanges"
  | "dialog"
  | "hasTrackedWorkingChanges"
  | "historySelectedPath"
  | "inspector"
  | "onOpenPush"
  | "openConflict"
  | "openVcsFileTab"
  | "primaryCommit"
  | "repository"
  | "repositoryAvailability"
  | "requestOpenRepositoryTool"
  | "requestShareProject"
  | "rollbackVcsFile"
  | "runAction"
  | "session"
  | "setBottomPanelTab"
  | "setToast"
  | "setVcsOperationsOpen"
  | "showVcsFileChanges"
  | "untrackedPaths"
  | "vcsFileChange"
  | "vcsFileEntry"
  | "vcsFilePath"
  | "vcsFileVersioned"
  | "workingEntries"
>;

export function createVcsCommands(context: VcsCommandPort): readonly CommandDefinition[] {
  const {
    applyPatchFromClipboard,
    applyPatchFromFile,
    availability,
    changeSelection,
    compareVcsFile,
    conflictedFile,
    createPatchFromLocalChanges,
    dialog,
    hasTrackedWorkingChanges,
    historySelectedPath,
    inspector,
    onOpenPush,
    openConflict,
    openVcsFileTab,
    primaryCommit,
    repository,
    repositoryAvailability,
    requestOpenRepositoryTool,
    requestShareProject,
    rollbackVcsFile,
    runAction,
    session,
    setBottomPanelTab,
    setToast,
    setVcsOperationsOpen,
    showVcsFileChanges,
    untrackedPaths,
    vcsFileChange,
    vcsFileEntry,
    vcsFilePath,
    vcsFileVersioned,
    workingEntries,
  } = context;
  return [
    commandDefinition(
      "localHistory.show",
      () => {
        const path = inspector?.path ?? changeSelection?.path ?? historySelectedPath ?? undefined;
        const url = new URL(window.location.href);
        url.pathname = "/local-history";
        url.search = "";
        url.searchParams.set("repositoryId", repository.snapshot.id);
        url.searchParams.set("repositoryName", repository.snapshot.name);
        if (path) url.searchParams.set("path", path);
        window.open(url, "_blank", "popup=yes");
      },
      () =>
        inspector?.path || changeSelection?.path || historySelectedPath
          ? COMMAND_ENABLED
          : commandDisabled("Select a file to show its Local History."),
    ),
    commandDefinition("localHistory.showProject", () => {
      const url = new URL(window.location.href);
      url.pathname = "/local-history";
      url.search = "";
      url.searchParams.set("repositoryId", repository.snapshot.id);
      url.searchParams.set("repositoryName", repository.snapshot.name);
      window.open(url, "_blank", "popup=yes");
    }),
    commandDefinition("localHistory.recent", () => {
      window.dispatchEvent(new CustomEvent("git-client:open-local-history"));
    }),
    commandDefinition("localHistory.putLabel", async () => {
      const label = await dialog.input({
        title: "Put Label",
        label: "Label name:",
        confirmLabel: "OK",
      });
      if (label !== null && label.trim().length > 0) {
        await session.mutations.putLocalHistoryLabel(label.trim());
      }
    }),
    commandDefinition("repository.refresh", session.queries.reload, repositoryAvailability),
    commandDefinition(
      "repository.fetch",
      () =>
        session.mutations.executeOperation({
          kind: "fetch",
          remote: null,
          prune: false,
        }),
      repositoryAvailability,
    ),
    commandDefinition(
      "repository.pull",
      () => session.mutations.executeOperation({ kind: "pull", rebase: false }),
      repositoryAvailability,
    ),
    commandDefinition("repository.push", () => onOpenPush(), repositoryAvailability),
    commandDefinition(
      "repository.update",
      () => session.mutations.executeOperation({ kind: "pull", rebase: false }),
      repositoryAvailability,
    ),
    commandDefinition("repository.merge", () => requestOpenRepositoryTool("refs")),
    commandDefinition("repository.rebase", () => requestOpenRepositoryTool("refs")),
    commandDefinition("repository.branches", () => requestOpenRepositoryTool("refs")),
    commandDefinition(
      "repository.newTag",
      async () => {
        const name = await dialog.input({
          title: "Create tag",
          label: "Tag name",
          initialValue: "v0.1.0",
          description: `Creates a lightweight tag at ${primaryCommit?.oid.slice(0, 12) ?? "HEAD"}.`,
        });
        if (!name) return;
        await session.mutations.executeOperation({
          kind: "createTag",
          name,
          revision: primaryCommit?.oid ?? "HEAD",
          message: null,
        });
      },
      () =>
        repository.snapshot.hasCommits
          ? repositoryAvailability()
          : commandDisabled("The repository has no commits."),
    ),
    commandDefinition(
      "repository.resetHead",
      async () => {
        const revision = await dialog.input({
          title: "Reset HEAD",
          label: "Commit or revision",
          initialValue: primaryCommit?.oid ?? "HEAD",
        });
        if (!revision) return;
        const mode = await dialog.input({
          title: "Choose reset mode",
          label: "Mode: soft, mixed, hard, or keep",
          initialValue: "mixed",
          description:
            "Hard discards index and working-tree changes; keep refuses to overwrite local changes.",
        });
        if (!mode || !["soft", "mixed", "hard", "keep"].includes(mode)) {
          if (mode) setToast("Reset mode must be soft, mixed, hard, or keep.");
          return;
        }
        const accepted = await dialog.confirm({
          title: `Reset ${repository.snapshot.currentBranch ?? "HEAD"}?`,
          description: `Moves the current branch to ${revision}.`,
          impact:
            mode === "hard"
              ? "Hard reset discards index and working-tree changes."
              : `Reset mode: ${mode}`,
          confirmLabel: "Reset branch",
          dangerous: true,
        });
        if (!accepted) return;
        await session.mutations.executeOperation({
          kind: "reset",
          revision,
          mode: mode as "soft" | "mixed" | "hard" | "keep",
        });
      },
      () =>
        repository.snapshot.hasCommits
          ? repositoryAvailability()
          : commandDisabled("The repository has no commits."),
    ),
    commandDefinition("repository.newWorktree", () => requestOpenRepositoryTool("worktrees")),
    commandDefinition("repository.worktrees", () => requestOpenRepositoryTool("worktrees")),
    commandDefinition(
      "repository.shelveChanges",
      () => {
        window.dispatchEvent(new CustomEvent("git-client:shelve-changes"));
      },
      () =>
        workingEntries.length > 0
          ? repositoryAvailability()
          : commandDisabled("There are no changes to shelve."),
    ),
    commandDefinition("repository.showShelf", () => {
      window.dispatchEvent(
        new CustomEvent("git-client:open-bottom-panel", {
          detail: { tab: "shelf" },
        }),
      );
    }),
    commandDefinition(
      "repository.stashChanges",
      () => {
        setBottomPanelTab("stash");
        window.dispatchEvent(new CustomEvent("git-client:stash-changes"));
      },
      () =>
        workingEntries.length > 0
          ? repositoryAvailability()
          : commandDisabled("There are no changes to stash."),
    ),
    commandDefinition(
      "repository.showStash",
      () => {
        setBottomPanelTab("stash");
        window.dispatchEvent(
          new CustomEvent("git-client:open-bottom-panel", {
            detail: { tab: "stash" },
          }),
        );
      },
      () =>
        session.repository.stashes.length > 0
          ? repositoryAvailability()
          : commandDisabled("There are no stash entries."),
    ),
    commandDefinition(
      "repository.manageRemotes",
      () => requestOpenRepositoryTool("remotes"),
      repositoryAvailability,
    ),
    commandDefinition(
      "repository.manageAccounts",
      () => requestOpenRepositoryTool("hosting"),
      repositoryAvailability,
    ),
    commandDefinition(
      "repository.shareGitHub",
      () => requestShareProject("gitHub"),
      () =>
        isElectronRuntime()
          ? repositoryAvailability()
          : commandDisabled("Project sharing requires the Electron application."),
    ),
    commandDefinition(
      "repository.shareGitLab",
      () => requestShareProject("gitLab"),
      () =>
        isElectronRuntime()
          ? repositoryAvailability()
          : commandDisabled("Project sharing requires the Electron application."),
    ),
    commandDefinition("repository.createPatchFromChanges", createPatchFromLocalChanges, () =>
      workingEntries.length > 0
        ? repositoryAvailability()
        : commandDisabled("There are no local changes."),
    ),
    commandDefinition("repository.applyPatch", applyPatchFromFile, repositoryAvailability),
    commandDefinition(
      "repository.applyPatchFromClipboard",
      applyPatchFromClipboard,
      repositoryAvailability,
    ),
    commandDefinition(
      "repository.operationsPopup",
      () => setVcsOperationsOpen(true),
      repositoryAvailability,
    ),
    commandDefinition(
      "repository.stageUnversioned",
      () =>
        session.mutations.executeOperation({
          kind: "stage",
          paths: untrackedPaths,
        }),
      () =>
        untrackedPaths.length > 0
          ? repositoryAvailability()
          : commandDisabled("There are no unversioned files to add."),
    ),
    commandDefinition(
      "repository.stageTracked",
      () => session.mutations.executeOperation({ kind: "stageTracked" }),
      () =>
        hasTrackedWorkingChanges
          ? repositoryAvailability()
          : commandDisabled("There are no tracked changes to stage."),
    ),
    commandDefinition("repository.rollback", rollbackVcsFile, () =>
      vcsFileChange?.status !== "untracked" && vcsFileChange?.worktree
        ? repositoryAvailability()
        : commandDisabled("Select a tracked file with working-tree changes."),
    ),
    commandDefinition("repository.commitCurrentFile", showVcsFileChanges, () =>
      vcsFileEntry
        ? repositoryAvailability()
        : commandDisabled("Select a file with changes to commit."),
    ),
    commandDefinition(
      "repository.addCurrentFile",
      () =>
        vcsFilePath
          ? session.mutations.executeOperation({
              kind: "stage",
              paths: [vcsFilePath],
            })
          : undefined,
      () =>
        vcsFilePath && vcsFileChange?.status === "untracked"
          ? repositoryAvailability()
          : commandDisabled("Select an unversioned file to add."),
    ),
    commandDefinition("repository.showCurrentFileDiff", showVcsFileChanges, () =>
      vcsFileEntry
        ? repositoryAvailability()
        : commandDisabled("Select a changed file to show its diff."),
    ),
    commandDefinition(
      "repository.compareCurrentFileRevision",
      () => compareVcsFile("revision"),
      () =>
        vcsFileVersioned && repository.snapshot.hasCommits
          ? repositoryAvailability()
          : commandDisabled("Select a versioned file to compare."),
    ),
    commandDefinition(
      "repository.compareCurrentFileRef",
      () => compareVcsFile("ref"),
      () =>
        vcsFileVersioned && repository.snapshot.hasCommits
          ? repositoryAvailability()
          : commandDisabled("Select a versioned file to compare."),
    ),
    commandDefinition(
      "repository.showFileHistory",
      () => openVcsFileTab("history"),
      () =>
        vcsFileVersioned && repository.snapshot.hasCommits
          ? repositoryAvailability()
          : commandDisabled("Select a versioned file to show its history."),
    ),
    commandDefinition(
      "repository.annotate",
      () => openVcsFileTab("blame"),
      () =>
        vcsFileVersioned && repository.snapshot.hasCommits
          ? repositoryAvailability()
          : commandDisabled("Select a versioned file to annotate."),
    ),
    commandDefinition("repository.compareCurrentFile", showVcsFileChanges, () =>
      vcsFileEntry
        ? repositoryAvailability()
        : commandDisabled("Select a changed file to compare."),
    ),
    commandDefinition(
      "repository.copyBranchName",
      async () => {
        const branch = repository.snapshot.currentBranch;
        if (!branch) return;
        await writeClipboardText(branch);
        setToast(`Copied ${branch}`);
      },
      () =>
        repository.snapshot.currentBranch ? COMMAND_ENABLED : commandDisabled("HEAD is detached."),
    ),
    commandDefinition(
      "repository.resolveConflicts",
      () => conflictedFile && openConflict(conflictedFile),
      () =>
        conflictedFile
          ? repositoryAvailability()
          : commandDisabled("There are no unresolved conflicts."),
    ),
    commandDefinition(
      "repository.unshallow",
      () => session.mutations.executeOperation({ kind: "unshallow" }),
      () =>
        repository.snapshot.isShallow
          ? repositoryAvailability()
          : commandDisabled("The repository is not shallow."),
    ),
    commandDefinition(
      "history.newBranch",
      () => runAction("newBranch"),
      () =>
        availability.newBranch
          ? repositoryAvailability()
          : commandDisabled("Select a commit to create a branch."),
    ),
    commandDefinition(
      "history.copyRevision",
      () => runAction("copyRevision"),
      () =>
        availability.copyRevision
          ? COMMAND_ENABLED
          : commandDisabled("Select one commit to copy its revision."),
    ),
  ];
}
