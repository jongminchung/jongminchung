import { Button } from "@jongminchung/ui/components/button";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppearance } from "../components/AppearanceProvider";
import { Icon } from "../components/Icon";
import { Notice } from "../components/Notice";
import { EmptyState } from "../components/ProductCollections";
import type { GitSessionController } from "../features/repository/session/useGitSessionController";
import { StartupWorkspace } from "./AppChrome";
import { RepositoryWorkspace } from "./composition/RepositoryWorkspaceComposition";
import { useAppStore } from "./state/AppStoreProvider";

export function AppWorkspaceRouter({
    openRepositoryFromPicker,
    session,
}: {
    readonly openRepositoryFromPicker: () => Promise<void>;
    readonly session: GitSessionController;
}) {
    const {
        preference: appearancePreference,
        setPreference: setAppearancePreference,
    } = useAppearance();
    const state = useAppStore(
        useShallow((store) => ({
            productSettings: store.productSettings,
            repositoryChromeMode: store.repositoryChromeMode,
            setDirtyEditorCount: store.setDirtyEditorCount,
            setProductSettings: store.setProductSettings,
            setPushRequest: store.setPushRequest,
            setRepositoryChromeMode: store.setRepositoryChromeMode,
            setRepositoryDialogMode: store.setRepositoryDialogMode,
            setRepositoryTool: store.setRepositoryTool,
            setSettingsOpen: store.setSettingsOpen,
            setShowRepositoryDialog: store.setShowRepositoryDialog,
        })),
    );
    const {
        productSettings,
        setDirtyEditorCount,
        setProductSettings,
        setPushRequest,
        setRepositoryChromeMode,
        setRepositoryDialogMode,
        setRepositoryTool,
        setSettingsOpen,
        setShowRepositoryDialog,
    } = state;
    const {
        activateTab: sessionActivateTab,
        activeTab: sessionActiveTab,
        sessions,
    } = session.workspace;
    const { repository: sessionRepository } = session.repository;
    const activeError = useMemo(() => {
        if (sessionActiveTab.kind !== "error") return null;
        const sessionId = sessionActiveTab.sessionId;
        return (
            sessions.find(
                (item) => item.kind === "error" && item.id === sessionId,
            ) ?? null
        );
    }, [sessions, sessionActiveTab]);
    const showNotifications = productSettings.showNotifications;

    return (
        <>
            {activeError?.kind === "error" ? (
                <main className="min-h-0 [grid-row:2_/_-1]">
                    <EmptyState
                        className="gap-2 px-10 py-10 [&_[data-slot=empty-title]]:text-foreground"
                        description={<code>{activeError.path}</code>}
                        icon={<Icon name="warning" size={28} />}
                        title={
                            <h1 className="text-base font-semibold">
                                Repository unavailable
                            </h1>
                        }
                    >
                        <Notice
                            className="w-full"
                            role="alert"
                            size="sm"
                            tone="destructive"
                        >
                            {activeError.message}
                        </Notice>
                        <Button
                            className="min-h-8 px-3 text-xs shadow-xs"
                            onClick={() =>
                                void sessionActivateTab({ kind: "welcome" })
                            }
                            variant="default"
                            size="default"
                        >
                            Back to Welcome
                        </Button>
                    </EmptyState>
                </main>
            ) : sessionActiveTab.kind === "welcome" || !sessionRepository ? (
                <StartupWorkspace
                    appearancePreference={appearancePreference}
                    onAppearancePreferenceChange={setAppearancePreference}
                    onCloneRepository={() => {
                        setRepositoryDialogMode("clone");
                        setShowRepositoryDialog(true);
                    }}
                    onNewProject={() => {
                        setRepositoryDialogMode("init");
                        setShowRepositoryDialog(true);
                    }}
                    onOpenRepository={() => void openRepositoryFromPicker()}
                    onOpenSettings={() => setSettingsOpen(true)}
                    session={session}
                />
            ) : (
                <RepositoryWorkspace
                    key={sessionRepository.snapshot.id}
                    onAddRepository={() => void openRepositoryFromPicker()}
                    onDirtyEditorCountChange={setDirtyEditorCount}
                    onChromeModeChange={setRepositoryChromeMode}
                    onDismissShortcutConflictWarning={() =>
                        setProductSettings((current) => ({
                            ...current,
                            showShortcutConflictWarning: false,
                        }))
                    }
                    onOpenSettings={() => setSettingsOpen(true)}
                    onOpenPush={(
                        localRevision = "HEAD",
                        knownRewrite = false,
                    ) => setPushRequest({ localRevision, knownRewrite })}
                    onOpenRepositoryTool={(kind) => setRepositoryTool(kind)}
                    repository={sessionRepository}
                    session={session}
                    productSettings={productSettings}
                    showNotifications={showNotifications}
                    showShortcutConflictWarning={
                        productSettings.showShortcutConflictWarning
                    }
                />
            )}
        </>
    );
}
