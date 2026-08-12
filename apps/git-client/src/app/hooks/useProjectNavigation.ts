import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import type { WorkspaceTab } from "../../application/git-session/state/GitSessionState";
import type { AppDialogController } from "../../components/AppDialog";
import type { RepositoryToolKind } from "../../components/RepositoryToolDialog";
import type { RepositoryAccessMode } from "../../domain/repositoryAccess";
import { electronApi } from "../../platform/electron";
import { useAppStore } from "../state/AppStoreProvider";

export interface ProjectNavigationPort {
    readonly activateTab: (tab: WorkspaceTab) => Promise<void>;
    readonly activeTab: WorkspaceTab;
    readonly openRepository: (
        path: string,
        mode?: RepositoryAccessMode,
    ) => Promise<void>;
}

export function useProjectNavigation({
    dialog,
    dirtyEditorCount,
    navigation,
}: {
    readonly dialog: AppDialogController;
    readonly dirtyEditorCount: number;
    readonly navigation: ProjectNavigationPort;
}) {
    const {
        setPendingTrustPath,
        setRepositoryDialogMode,
        setRepositoryTool,
        setShowRepositoryDialog,
    } = useAppStore(
        useShallow((state) => ({
            setPendingTrustPath: state.setPendingTrustPath,
            setRepositoryDialogMode: state.setRepositoryDialogMode,
            setRepositoryTool: state.setRepositoryTool,
            setShowRepositoryDialog: state.setShowRepositoryDialog,
        })),
    );
    const confirmDiscardEditors = useCallback(async (): Promise<boolean> => {
        if (dirtyEditorCount === 0) return true;
        return dialog.confirm({
            title: "Leave editors with unsaved changes?",
            description: `${dirtyEditorCount} editor tab(s) contain unsaved changes.`,
            impact: "Unsaved editor content will be lost.",
            confirmLabel: "Discard and continue",
            dangerous: true,
        });
    }, [dirtyEditorCount, dialog]);
    const openRepositoryToolSafely = useCallback(
        async (kind: RepositoryToolKind): Promise<void> => {
            if (!(await confirmDiscardEditors())) return;
            setRepositoryTool(kind);
        },
        [confirmDiscardEditors, setRepositoryTool],
    );
    const activateProjectSafely = useCallback(
        async (repositoryId: string): Promise<void> => {
            if (
                navigation.activeTab.kind === "repository" &&
                navigation.activeTab.repositoryId === repositoryId
            ) {
                return;
            }
            if (!(await confirmDiscardEditors())) return;
            await navigation.activateTab({ kind: "repository", repositoryId });
        },
        [confirmDiscardEditors, navigation],
    );
    const openRecentProjectSafely = useCallback(
        async (path: string): Promise<void> => {
            if (!(await confirmDiscardEditors())) return;
            await navigation.openRepository(path);
        },
        [confirmDiscardEditors, navigation],
    );
    const openRepositoryFromPicker = useCallback(async (): Promise<void> => {
        if (!(await confirmDiscardEditors())) return;
        const api = electronApi();
        if (api === null) {
            setRepositoryDialogMode("open");
            setShowRepositoryDialog(true);
            return;
        }
        const selected = await api.dialog.openDirectory({
            title: "Open File or Project",
            defaultPath: null,
            filters: [],
        });
        if (typeof selected === "string") setPendingTrustPath(selected);
    }, [
        confirmDiscardEditors,
        setPendingTrustPath,
        setRepositoryDialogMode,
        setShowRepositoryDialog,
    ]);

    return {
        activateProjectSafely,
        confirmDiscardEditors,
        openRecentProjectSafely,
        openRepositoryFromPicker,
        openRepositoryToolSafely,
    };
}
