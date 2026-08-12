import { Button } from "@jongminchung/ui/components/button";
import { useCallback, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppDialog } from "../components/AppDialog";
import { useAppearance } from "../components/AppearanceProvider";
import { useCommands, usePaletteItems } from "../components/CommandProvider";
import { Icon } from "../components/Icon";
import { Notice } from "../components/Notice";
import { TrustProjectDialog } from "../components/TrustProjectDialog";
import { COMMAND_ENABLED, type PaletteItem } from "../domain/commands";
import { type ProductSettings } from "../domain/productSettings";
import {
    parseToolWindowLayout,
    type NamedToolWindowLayout,
    type ToolWindowLayout,
} from "../domain/toolWindowLayouts";
import { useGitSessionController } from "../git-session/useGitSessionController";
import { importElectronSettings } from "../platform/electronSettings";
import { WelcomeTitlebar, WorkspaceTitlebar } from "./AppChrome";
import { AppOverlays } from "./AppOverlays";
import { AppUtilityOverlays } from "./AppUtilityOverlays";
import { AppWorkspaceRouter } from "./AppWorkspaceRouter";
import { useAppHydration } from "./hooks/useAppHydration";
import { useAppWindowLifecycle } from "./hooks/useAppWindowLifecycle";
import { useProjectNavigation } from "./hooks/useProjectNavigation";
import { hydrateProductSettings } from "./state/appPersistence";
import { useAppStore } from "./state/AppStoreProvider";
import { useWorkspaceCommands } from "./useWorkspaceCommands";

interface ToolWindowLayoutCaptureDetail {
    readonly accept: (layout: ToolWindowLayout) => void;
}

export function AppShell() {
    const session = useGitSessionController();
    const {
        activity: {
            current: sessionActivity,
            dismiss: sessionDismissActivity,
            retry: sessionRetryActivity,
        },
        queries: { reload: sessionReload },
        repository: {
            accessMode: sessionAccessMode,
            repository: sessionRepository,
        },
        workspace: {
            activateTab: sessionActivateTab,
            activeTab: sessionActiveTab,
            dismissError: sessionDismissError,
            dismissNotice: sessionDismissNotice,
            error: sessionError,
            notice: sessionNotice,
            openRepositories: sessionOpenRepositories,
            openRepository: sessionOpenRepository,
            removeRecentProject: sessionRemoveRecentProject,
            restoring: sessionRestoring,
            sessions: sessionSessions,
        },
    } = session;
    const commands = useCommands();
    const { setPreference: setAppearancePreference } = useAppearance();
    const overlay = useAppStore(
        useShallow((state) => ({
            pendingTrustPath: state.pendingTrustPath,
            projectSwitcherOpen: state.projectSwitcherOpen,
            setShowRepositoryDialog: state.setShowRepositoryDialog,
            setPendingTrustPath: state.setPendingTrustPath,
            setRepositoryDialogMode: state.setRepositoryDialogMode,
            setProjectSwitcherOpen: state.setProjectSwitcherOpen,
            setPushRequest: state.setPushRequest,
            setSettingsOpen: state.setSettingsOpen,
            setHelpOpen: state.setHelpOpen,
            setWhatsNewOpen: state.setWhatsNewOpen,
            setActivityMonitorOpen: state.setActivityMonitorOpen,
            setSpecialFilesOpen: state.setSpecialFilesOpen,
            setLeftoverDirectoriesOpen: state.setLeftoverDirectoriesOpen,
            setCommandLineLauncherOpen: state.setCommandLineLauncherOpen,
            setDiagnosticConfiguration: state.setDiagnosticConfiguration,
            setNewProjectSettingsOpen: state.setNewProjectSettingsOpen,
            setQuickSwitchSchemeOpen: state.setQuickSwitchSchemeOpen,
            setRepairIdeOpen: state.setRepairIdeOpen,
            setInvalidateCachesOpen: state.setInvalidateCachesOpen,
            setRunConfigurationTemplatesOpen:
                state.setRunConfigurationTemplatesOpen,
            setSavedMacrosOpen: state.setSavedMacrosOpen,
            setLayoutChooserMode: state.setLayoutChooserMode,
        })),
    );
    const {
        pendingTrustPath,
        projectSwitcherOpen,
        setShowRepositoryDialog,
        setPendingTrustPath,
        setRepositoryDialogMode,
        setProjectSwitcherOpen,
        setPushRequest,
        setSettingsOpen,
        setHelpOpen,
        setWhatsNewOpen,
        setActivityMonitorOpen,
        setSpecialFilesOpen,
        setLeftoverDirectoriesOpen,
        setCommandLineLauncherOpen,
        setDiagnosticConfiguration,
        setNewProjectSettingsOpen,
        setQuickSwitchSchemeOpen,
        setRepairIdeOpen,
        setInvalidateCachesOpen,
        setRunConfigurationTemplatesOpen,
        setSavedMacrosOpen,
        setLayoutChooserMode,
    } = overlay;
    const settings = useAppStore(
        useShallow((state) => ({
            savedMacros: state.savedMacros,
            macroRecording: state.macroRecording,
            recordedCommandIds: state.recordedCommandIds,
            lastMacro: state.lastMacro,
            productSettings: state.productSettings,
            toolWindowLayouts: state.toolWindowLayouts,
            dirtyEditorCount: state.dirtyEditorCount,
            repositoryChromeMode: state.repositoryChromeMode,
            setSavedMacros: state.setSavedMacros,
            setMacroRecording: state.setMacroRecording,
            setRecordedCommandIds: state.setRecordedCommandIds,
            setLastMacro: state.setLastMacro,
            setProductSettings: state.setProductSettings,
            setToolWindowLayouts: state.setToolWindowLayouts,
        })),
    );
    const {
        savedMacros,
        macroRecording,
        recordedCommandIds,
        lastMacro,
        productSettings,
        toolWindowLayouts,
        dirtyEditorCount,
        repositoryChromeMode,
        setSavedMacros,
        setMacroRecording,
        setRecordedCommandIds,
        setLastMacro,
        setProductSettings,
        setToolWindowLayouts,
    } = settings;
    const presentationPreviousFullScreen = useRef(false);
    const zenPreviousFullScreen = useRef(false);
    const handleProductSettingsChange = useCallback(
        (settings: ProductSettings): void => setProductSettings(settings),
        [setProductSettings],
    );
    const dialog = useAppDialog();

    const {
        activateProjectSafely,
        confirmDiscardEditors,
        openRecentProjectSafely,
        openRepositoryFromPicker,
        openRepositoryToolSafely,
    } = useProjectNavigation({
        dialog,
        dirtyEditorCount,
        navigation: {
            activateTab: sessionActivateTab,
            activeTab: sessionActiveTab,
            openRepository: sessionOpenRepository,
        },
    });
    const importSettingsArchive = useCallback(async (): Promise<void> => {
        if (!(await importElectronSettings())) return;
        setProductSettings(await hydrateProductSettings());
    }, [setProductSettings]);

    const captureToolWindowLayout = useCallback((): ToolWindowLayout | null => {
        let captured: ToolWindowLayout | null = null;
        window.dispatchEvent(
            new CustomEvent("git-client:capture-tool-window-layout", {
                detail: {
                    accept: (layout: ToolWindowLayout) => {
                        captured = parseToolWindowLayout(layout);
                    },
                } satisfies ToolWindowLayoutCaptureDetail,
            }),
        );
        return captured;
    }, []);
    const applyToolWindowLayout = useCallback(
        (layout: ToolWindowLayout): void => {
            window.dispatchEvent(
                new CustomEvent("git-client:apply-tool-window-layout", {
                    detail: { layout: parseToolWindowLayout(layout) },
                }),
            );
        },
        [],
    );
    const renameToolWindowLayout = useCallback(
        async (layout: NamedToolWindowLayout): Promise<void> => {
            const name = await dialog.input({
                title: "Rename Layout",
                label: "Layout name",
                initialValue: layout.name,
                confirmLabel: "Rename",
                validate: (candidate) => {
                    const normalized = candidate.trim();
                    if (!normalized) return "Enter a layout name.";
                    if (normalized.length > 64)
                        return "Layout names must be 64 characters or fewer.";
                    return toolWindowLayouts.some(
                        (other) =>
                            other.id !== layout.id &&
                            other.name.toLocaleLowerCase() ===
                                normalized.toLocaleLowerCase(),
                    )
                        ? "A layout with this name already exists."
                        : null;
                },
            });
            if (name === null) return;
            setToolWindowLayouts((current) =>
                current.map((candidate) =>
                    candidate.id === layout.id
                        ? { ...candidate, name: name.trim() }
                        : candidate,
                ),
            );
        },
        [toolWindowLayouts, dialog, setToolWindowLayouts],
    );
    const saveToolWindowLayout = useCallback(
        (layout: NamedToolWindowLayout): void => {
            const state = captureToolWindowLayout();
            if (state === null) return;
            setToolWindowLayouts((current) =>
                current.map((candidate) =>
                    candidate.id === layout.id
                        ? { ...candidate, state }
                        : candidate,
                ),
            );
        },
        [captureToolWindowLayout, setToolWindowLayouts],
    );

    useAppHydration();

    const welcomeVisible =
        !sessionRestoring &&
        sessionActiveTab.kind === "welcome" &&
        sessionOpenRepositories.length === 0;
    useAppWindowLifecycle({
        repositoryName: sessionRepository?.snapshot.name,
        restoring: sessionRestoring,
        welcomeVisible,
    });

    const openRepositories = useMemo(
        () =>
            sessionSessions.flatMap((item) =>
                item.kind === "repository" ? [item.repository.snapshot] : [],
            ),
        [sessionSessions],
    );
    const activeProjectName = useMemo(() => {
        if (sessionActiveTab.kind !== "repository") return "Git Client";
        const repositoryId = sessionActiveTab.repositoryId;
        const active = sessionSessions.find(
            (item) =>
                item.kind === "repository" &&
                item.repository.snapshot.id === repositoryId,
        );
        return active?.kind === "repository"
            ? active.repository.snapshot.name
            : "Git Client";
    }, [sessionActiveTab, sessionSessions]);
    useWorkspaceCommands({
        activeProjectName,
        applyToolWindowLayout,
        captureToolWindowLayout,
        commands,
        dialog,
        dirtyEditorCount,
        importSettingsArchive,
        lastMacro,
        macroRecording,
        openRepositoryFromPicker,
        presentationPreviousFullScreen,
        productSettings,
        recordedCommandIds,
        renameToolWindowLayout,
        saveToolWindowLayout,
        savedMacros,
        session,
        setActivityMonitorOpen,
        setAppearancePreference,
        setCommandLineLauncherOpen,
        setDiagnosticConfiguration,
        setHelpOpen,
        setInvalidateCachesOpen,
        setLastMacro,
        setLayoutChooserMode,
        setLeftoverDirectoriesOpen,
        setMacroRecording,
        setNewProjectSettingsOpen,
        setProductSettings,
        setProjectSwitcherOpen,
        setQuickSwitchSchemeOpen,
        setRecordedCommandIds,
        setRepairIdeOpen,
        setRepositoryDialogMode,
        setRunConfigurationTemplatesOpen,
        setSavedMacros,
        setSavedMacrosOpen,
        setSettingsOpen,
        setShowRepositoryDialog,
        setSpecialFilesOpen,
        setToolWindowLayouts,
        setWhatsNewOpen,
        toolWindowLayouts,
        zenPreviousFullScreen,
    });

    const repositoryPaletteItems = useMemo<readonly PaletteItem[]>(
        () =>
            openRepositories.map((repository) => ({
                id: `repository:${repository.id}`,
                kind: "repository",
                label: repository.name,
                detail: repository.path,
                category: "Repositories",
                keywords: [repository.path, repository.currentBranch ?? ""],
                availability: COMMAND_ENABLED,
                execute: async () => {
                    if (
                        sessionActiveTab.kind === "repository" &&
                        sessionActiveTab.repositoryId === repository.id
                    )
                        return;
                    if (!(await confirmDiscardEditors())) return;
                    await sessionActivateTab({
                        kind: "repository",
                        repositoryId: repository.id,
                    });
                },
            })),
        [
            confirmDiscardEditors,
            openRepositories,
            sessionActivateTab,
            sessionActiveTab,
        ],
    );
    usePaletteItems(repositoryPaletteItems);

    return (
        <div
            className={`appShell [background:var(--background)] [display:grid] [grid-template-rows:35px_32px_minmax(0,_1fr)_20px] [height:100%] [min-width:800px] [overflow:hidden] [position:relative] [&_button]:rounded-sm [&_input]:rounded-sm [&_textarea]:rounded-sm [&_select]:rounded-sm [&_button:not(:disabled):hover]:[background-color:color-mix(in_oklch,_var(--foreground)_7%,_transparent)] data-[window-mode=welcome]:grid-rows-[30px_29px_minmax(0,1fr)_20px]! [html[data-status-bar-visible=false]_&]:grid-rows-[30px_29px_minmax(0,1fr)_0]! [html[data-presentation-mode=true]_&]:grid-rows-[30px_29px_minmax(0,1fr)_0]! [html[data-status-bar-visible=false]_&[data-window-mode=welcome]]:grid-rows-[30px_29px_minmax(0,1fr)_0]! [html[data-presentation-mode=true]_&[data-window-mode=welcome]]:grid-rows-[30px_29px_minmax(0,1fr)_0]! appShell`}
            data-window-mode={welcomeVisible ? "welcome" : "workspace"}
        >
            <AppUtilityOverlays
                applyToolWindowLayout={applyToolWindowLayout}
                onProductSettingsChange={handleProductSettingsChange}
                reloadRepository={sessionReload}
                renameToolWindowLayout={renameToolWindowLayout}
                saveToolWindowLayout={saveToolWindowLayout}
            />
            {pendingTrustPath && (
                <TrustProjectDialog
                    onCancel={() => setPendingTrustPath(null)}
                    onPreview={() => {
                        const path = pendingTrustPath;
                        setPendingTrustPath(null);
                        void sessionOpenRepository(path, "safe");
                    }}
                    onTrust={() => {
                        const path = pendingTrustPath;
                        setPendingTrustPath(null);
                        void sessionOpenRepository(path, "trusted");
                    }}
                    parentName={
                        pendingTrustPath.split("/").filter(Boolean).at(-2) ??
                        "project"
                    }
                    projectName={
                        pendingTrustPath.split("/").filter(Boolean).at(-1) ??
                        "project"
                    }
                />
            )}
            {welcomeVisible ? (
                <WelcomeTitlebar />
            ) : (
                <WorkspaceTitlebar
                    onActivateProject={activateProjectSafely}
                    onCloneProject={() => {
                        setRepositoryDialogMode("clone");
                        setShowRepositoryDialog(true);
                    }}
                    onOpenProject={() => void openRepositoryFromPicker()}
                    onOpenRecentProject={openRecentProjectSafely}
                    onOpenPush={() =>
                        setPushRequest({
                            localRevision: "HEAD",
                            knownRewrite: false,
                        })
                    }
                    onOpenRepositoryTool={(kind) =>
                        void openRepositoryToolSafely(kind)
                    }
                    onOpenSettings={() => setSettingsOpen(true)}
                    onProjectSwitcherOpenChange={setProjectSwitcherOpen}
                    onRemoveRecentProject={sessionRemoveRecentProject}
                    projectSwitcherOpen={projectSwitcherOpen}
                    readOnly={sessionAccessMode === "safe"}
                    session={session}
                    showRepositoryActions={
                        sessionActiveTab.kind === "repository" &&
                        repositoryChromeMode === "editor"
                    }
                />
            )}
            {sessionError && (
                <Notice
                    className="absolute top-20 z-[8] w-full items-center rounded-none border-x-0 px-3 py-1.5"
                    icon={<Icon name="warning" size={14} />}
                    role="alert"
                    size="sm"
                    tone="destructive"
                >
                    <span className="flex w-full items-center gap-2">
                        <span className="min-w-0 flex-1">{sessionError}</span>
                        {sessionActivity?.status === "failed" &&
                            sessionActivity.canRetry && (
                                <Button
                                    className="h-auto p-0 text-xs text-inherit"
                                    onClick={() => void sessionRetryActivity()}
                                    size="xs"
                                    variant="link"
                                >
                                    Retry
                                </Button>
                            )}
                        <Button
                            className="h-auto p-0 text-xs text-inherit"
                            onClick={() => {
                                sessionDismissError();
                                if (sessionActivity?.status === "failed")
                                    sessionDismissActivity(sessionActivity.id);
                            }}
                            size="xs"
                            variant="link"
                        >
                            Dismiss
                        </Button>
                    </span>
                </Notice>
            )}
            {sessionNotice && (
                <Notice
                    className="absolute top-20 z-[8] w-full items-center rounded-none border-x-0 px-3 py-1.5"
                    icon={<Icon name="history" size={14} />}
                    role="status"
                    size="sm"
                >
                    <span className="flex w-full items-center gap-2">
                        <span className="min-w-0 flex-1">{sessionNotice}</span>
                        <Button
                            className="h-auto p-0 text-xs text-inherit"
                            onClick={sessionDismissNotice}
                            size="xs"
                            variant="link"
                        >
                            Dismiss
                        </Button>
                    </span>
                </Notice>
            )}
            <AppWorkspaceRouter
                openRepositoryFromPicker={openRepositoryFromPicker}
                session={session}
            />
            <AppOverlays
                openRepositoryToolSafely={openRepositoryToolSafely}
                session={session}
            />
            {dialog.node}
        </div>
    );
}
