import { useCallback } from "react";
import type { GitSessionCapabilities } from "../../application/git-session/ports/GitSessionCapabilities";
import type { RepositoryToolKind } from "../../components/RepositoryToolDialog";
import {
  COMMAND_ENABLED,
  commandDisabled,
  type CommandDefinition,
} from "../../domain/commands";
import { type ProductSettings } from "../../domain/productSettings";
import type {
  FileChange,
  Ref,
  RepositoryView,
  StashEntry,
} from "../../domain/types";
import { useRepositoryCommandController } from "./commands/useRepositoryCommandController";
import { createRepositoryWorkspaceFeatureModel } from "./createRepositoryWorkspaceFeatureModel";
import { useRepositoryEditorFeatureController } from "./editor/useRepositoryEditorFeatureController";
import { useRepositoryHostingCoordinator } from "./overlays/useRepositoryHostingCoordinator";
import { useRepositoryReviewController } from "./review/useRepositoryReviewController";
import { useRepositoryReviewState } from "./review/useRepositoryReviewState";
import { useRepositoryNotifications } from "./tool-windows/useRepositoryNotifications";
import { useRepositoryPersistence } from "./tool-windows/useRepositoryPersistence";
import { useRepositoryToolWindowState } from "./tool-windows/useRepositoryToolWindowState";
import { useRepositoryWorkspaceLifecycle } from "./tool-windows/useRepositoryWorkspaceLifecycle";
import { useRepositoryVcsController } from "./vcs/useRepositoryVcsController";

type GitSession = GitSessionCapabilities;

export interface RepositoryWorkspaceProps {
  readonly repository: RepositoryView;
  readonly session: GitSession;
  readonly productSettings: ProductSettings;
  readonly onAddRepository: () => void;
  readonly onOpenPush: (localRevision?: string, knownRewrite?: boolean) => void;
  readonly onOpenRepositoryTool: (kind: RepositoryToolKind) => void;
  readonly showNotifications: boolean;
  readonly showShortcutConflictWarning: boolean;
  readonly onDirtyEditorCountChange: (count: number) => void;
  readonly onDismissShortcutConflictWarning: () => void;
  readonly onOpenSettings: () => void;
  readonly onChromeModeChange: (mode: "editor" | "terminal") => void;
}

export function useRepositoryWorkspaceFeature({
  repository,
  session,
  productSettings,
  onAddRepository,
  onOpenPush,
  onOpenRepositoryTool,
  showNotifications,
  showShortcutConflictWarning,
  onDirtyEditorCountChange,
  onDismissShortcutConflictWarning,
  onOpenSettings,
  onChromeModeChange,
}: RepositoryWorkspaceProps) {
  const sessionActivity = session.activity.current;
  const safeMode = session.repository.accessMode === "safe";
  const review = useRepositoryReviewState(safeMode);
  const { setConflictContent, setDiffState, setSelectedOids, setSelectedRef } =
    review;
  const { loadStashPatch, readConflict } = session.queries;
  const layout = useRepositoryToolWindowState({
    activity: sessionActivity,
    productSettings,
    repository,
  });
  const {
    bottomCollapsed,
    logOpen,
    bottomPanelTab,
    dialog,
    shareProjectProvider,
    editorStatus,
    setBottomCollapsed,
    setToast,
    setShareProjectProvider,
    setShareExistingRemotes,
    setNotifications,
    setBalloonId,
  } = layout;
  const editor = useRepositoryEditorFeatureController({
    onDirtyEditorCountChange,
    onOpenRepositoryTool,
    repository,
    review,
    session: {
      queries: {
        loadFiles: session.queries.loadFiles,
        readFile: session.queries.readFile,
        reload: session.queries.reload,
      },
      mutations: {
        writeWorkingTreeFile: session.mutations.writeWorkingTreeFile,
      },
    },
    toolWindows: layout,
  });
  const { inspector, inspectorTabs, nextLogTabNumber, openInspector } = editor;
  const vcs = useRepositoryVcsController({
    executeOperation: session.mutations.executeOperation,
    importPatch: session.mutations.importPatch,
    inspector,
    loadLocalChangesPatch: session.queries.loadLocalChangesPatch,
    loadRevisionDiff: session.queries.loadRevisionDiff,
    openInspector,
    repository,
  });
  const reviewController = useRepositoryReviewController({
    dialog,
    onOpenPush,
    openInspector,
    repository,
    session,
    workingEntries: vcs.workingEntries,
  });

  useRepositoryPersistence({
    nextLogTabNumber,
    repositoryId: repository.snapshot.id,
    repositoryName: repository.snapshot.name,
  });
  useRepositoryNotifications({
    sessionActivity,
    sessionError: session.workspace.error,
    showNotifications,
    showShortcutConflictWarning,
  });

  const openStashDiff = useCallback(
    (stash: StashEntry): void => {
      const file: FileChange = {
        path: stash.selector,
        status: "modified",
        staged: false,
        worktree: false,
      };
      setDiffState({
        file,
        patch: "",
        loading: true,
        mode: "readOnly",
      });
      const load = async (): Promise<void> => {
        try {
          setDiffState({
            file,
            patch: await loadStashPatch(stash.selector),
            loading: false,
            mode: "readOnly",
          });
        } catch (error) {
          setDiffState({
            file,
            patch: `Unable to load stash: ${String(error)}`,
            loading: false,
            mode: "readOnly",
          });
        }
      };
      void load();
    },
    [loadStashPatch, setDiffState],
  );

  const selectRef = (ref: Ref): void => {
    setSelectedRef(ref.name);
    if (reviewController.commitsByOid.has(ref.oid)) {
      setSelectedOids([ref.oid]);
    }
  };

  const openConflict = useCallback(
    (file: FileChange): void => {
      const load = async (): Promise<void> => {
        try {
          setConflictContent(await readConflict(file.path));
        } catch (error) {
          setToast(`Unable to read conflict: ${String(error)}`);
        }
      };
      void load();
    },
    [readConflict, setConflictContent, setToast],
  );

  const repositoryBusy =
    session.repository.loading || sessionActivity?.status === "running";
  const repositoryAvailability = (): ReturnType<
    CommandDefinition["availability"]
  > =>
    safeMode
      ? commandDisabled(
          "Git changes and executable tools are unavailable in Safe Mode.",
        )
      : repositoryBusy
        ? commandDisabled(
            sessionActivity?.label ?? "Repository data is loading.",
          )
        : COMMAND_ENABLED;
  const hosting = useRepositoryHostingCoordinator({
    executeOperation: session.mutations.executeOperation,
    onNotification: (notification) =>
      setNotifications((current) => [notification, ...current]),
    onToast: setToast,
    remotes: session.repository.remotes,
    repository,
    shareProjectProvider,
    setBalloonId,
    setShareExistingRemotes,
    setShareProjectProvider,
  });
  const command = useRepositoryCommandController({
    editor,
    hosting,
    onOpenPush,
    onOpenSettings,
    openConflict,
    productSettings,
    repository,
    repositoryAvailability,
    review,
    reviewController,
    selectRef,
    session,
    toolWindows: layout,
    vcs,
  });

  const abortInProgressOperation = async (): Promise<void> => {
    const operation = repository.snapshot.operation;
    if (!operation || operation === "bisect") return;
    await session.mutations.abortOperation(operation);
  };

  const hasEditorTabs = logOpen || inspectorTabs.length > 0;
  const lifecycle = useRepositoryWorkspaceLifecycle({
    bottomCollapsed,
    bottomPanelTab,
    editorStatus,
    hasEditorTabs,
    onChromeModeChange,
    productSettings,
    repository,
    safeMode,
    sessionLoading: session.repository.loading,
    setBottomCollapsed,
    setHistoryRewrite: review.setHistoryRewrite,
    setRepositoryViewMode: review.setRepositoryViewMode,
    setShareExistingRemotes,
    setShareProjectProvider,
  });

  return createRepositoryWorkspaceFeatureModel({
    command,
    editor,
    handlers: {
      abortInProgressOperation,
      openConflict,
      openStashDiff,
      selectRef,
    },
    hosting,
    lifecycle,
    productSettings,
    repository,
    review,
    reviewController,
    safeMode,
    session,
    toolWindows: layout,
    vcs,
    workspace: {
      onAddRepository,
      onDismissShortcutConflictWarning,
      onOpenPush,
      onOpenSettings,
    },
  });
}

export type { RepositoryWorkspaceFeatureModel } from "./createRepositoryWorkspaceFeatureModel";
