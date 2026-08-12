import { lazy, Suspense } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppearance } from "../components/AppearanceProvider";
import type { RepositoryToolKind } from "../components/RepositoryToolDialog";
import type { GitSessionController } from "../git-session/useGitSessionController";
import { useAppStore } from "./state/AppStoreProvider";

const PushDialog = lazy(() =>
    import("../components/PushDialog").then(({ PushDialog }) => ({
        default: PushDialog,
    })),
);
const RepositoryDialog = lazy(() =>
    import("../components/RepositoryDialog").then(({ RepositoryDialog }) => ({
        default: RepositoryDialog,
    })),
);
const RepositoryToolDialog = lazy(() =>
    import("../components/RepositoryToolDialog").then(
        ({ RepositoryToolDialog }) => ({
            default: RepositoryToolDialog,
        }),
    ),
);
const SettingsDialog = lazy(() =>
    import("../components/SettingsDialog").then(({ SettingsDialog }) => ({
        default: SettingsDialog,
    })),
);

export function AppOverlays({
    openRepositoryToolSafely,
    session,
}: {
    readonly openRepositoryToolSafely: (
        kind: RepositoryToolKind,
    ) => Promise<void>;
    readonly session: GitSessionController;
}) {
    const { setPreference: setAppearancePreference } = useAppearance();
    const state = useAppStore(
        useShallow((store) => ({
            newProjectAppearancePreference:
                store.newProjectAppearancePreference,
            newProjectSettings: store.newProjectSettings,
            newProjectSettingsOpen: store.newProjectSettingsOpen,
            productSettings: store.productSettings,
            pushRequest: store.pushRequest,
            repositoryDialogMode: store.repositoryDialogMode,
            repositoryTool: store.repositoryTool,
            settingsOpen: store.settingsOpen,
            showRepositoryDialog: store.showRepositoryDialog,
            setNewProjectAppearancePreference:
                store.setNewProjectAppearancePreference,
            setNewProjectSettings: store.setNewProjectSettings,
            setNewProjectSettingsOpen: store.setNewProjectSettingsOpen,
            setProductSettings: store.setProductSettings,
            setPushRequest: store.setPushRequest,
            setRepositoryTool: store.setRepositoryTool,
            setSettingsOpen: store.setSettingsOpen,
            setShowRepositoryDialog: store.setShowRepositoryDialog,
        })),
    );
    const {
        newProjectAppearancePreference,
        newProjectSettings,
        newProjectSettingsOpen,
        productSettings,
        pushRequest,
        repositoryDialogMode,
        repositoryTool,
        settingsOpen,
        showRepositoryDialog,
        setNewProjectAppearancePreference,
        setNewProjectSettings,
        setNewProjectSettingsOpen,
        setProductSettings,
        setPushRequest,
        setRepositoryTool,
        setSettingsOpen,
        setShowRepositoryDialog,
    } = state;
    const handleProductSettingsChange = (
        settings: typeof productSettings,
    ): void => setProductSettings(settings);
    const {
        compareBranches: sessionCompareBranches,
        loadGitConfig: sessionLoadGitConfig,
        loadMergedBranches: sessionLoadMergedBranches,
        loadPushPreview: sessionLoadPushPreview,
        loadSubmodules: sessionLoadSubmodules,
        readIgnoreRules: sessionReadIgnoreRules,
    } = session.queries;
    const {
        executeOperation: sessionExecuteOperation,
        writeIgnoreRules: sessionWriteIgnoreRules,
    } = session.mutations;
    const {
        remotes: sessionRemotes,
        repository: sessionRepository,
        worktrees: sessionWorktrees,
    } = session.repository;
    const {
        cancelRepositoryCreation: sessionCancelRepositoryCreation,
        cloneRepository: sessionCloneRepository,
        initializeRepository: sessionInitializeRepository,
        openRepository: sessionOpenRepository,
    } = session.workspace;

    return (
        <Suspense fallback={null}>
            {showRepositoryDialog && (
                <RepositoryDialog
                    initialMode={repositoryDialogMode}
                    onCancelCreation={sessionCancelRepositoryCreation}
                    onClone={async (url, path, options, onEvent) => {
                        const cloned = await sessionCloneRepository(
                            url,
                            path,
                            options,
                            onEvent,
                        );
                        setProductSettings(newProjectSettings);
                        setAppearancePreference(newProjectAppearancePreference);
                        return cloned;
                    }}
                    onClose={() => setShowRepositoryDialog(false)}
                    onInit={async (path, bare, onEvent) => {
                        const initialized = await sessionInitializeRepository(
                            path,
                            bare,
                            onEvent,
                        );
                        setProductSettings(newProjectSettings);
                        setAppearancePreference(newProjectAppearancePreference);
                        return initialized;
                    }}
                    onOpen={sessionOpenRepository}
                />
            )}
            {repositoryTool && sessionRepository && (
                <RepositoryToolDialog
                    kind={repositoryTool}
                    onClose={() => setRepositoryTool(null)}
                    onCompareBranches={sessionCompareBranches}
                    onLoadConfig={sessionLoadGitConfig}
                    onLoadMergedBranches={sessionLoadMergedBranches}
                    onLoadSubmodules={sessionLoadSubmodules}
                    onOpenPush={() =>
                        setPushRequest({
                            localRevision: "HEAD",
                            knownRewrite: false,
                        })
                    }
                    onOpenWorktree={sessionOpenRepository}
                    onOperation={sessionExecuteOperation}
                    onReadIgnoreRules={sessionReadIgnoreRules}
                    onWriteIgnoreRules={sessionWriteIgnoreRules}
                    refs={sessionRepository.refs}
                    remotes={sessionRemotes}
                    repository={sessionRepository.snapshot}
                    worktrees={sessionWorktrees}
                />
            )}
            {pushRequest && sessionRepository && (
                <PushDialog
                    knownRewrite={pushRequest.knownRewrite}
                    localRevision={pushRequest.localRevision}
                    onClose={() => setPushRequest(null)}
                    onLoadPreview={sessionLoadPushPreview}
                    onPush={(operation) =>
                        sessionExecuteOperation(operation, true)
                    }
                    remotes={sessionRemotes}
                />
            )}
            {settingsOpen && (
                <SettingsDialog
                    isOpen
                    onClose={() => setSettingsOpen(false)}
                    onSettingsChange={handleProductSettingsChange}
                    settings={productSettings}
                    onOpenRepositorySettings={() => {
                        setSettingsOpen(false);
                        void openRepositoryToolSafely("settings");
                    }}
                />
            )}
            {newProjectSettingsOpen && (
                <SettingsDialog
                    appearancePreference={newProjectAppearancePreference}
                    isOpen
                    onAppearancePreferenceChange={
                        setNewProjectAppearancePreference
                    }
                    onClose={() => setNewProjectSettingsOpen(false)}
                    onSettingsChange={setNewProjectSettings}
                    settings={newProjectSettings}
                    showRepositorySettings={false}
                    title="Settings for New Projects"
                />
            )}
        </Suspense>
    );
}
