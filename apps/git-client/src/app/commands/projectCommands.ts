import type {
    WorkspaceRepositorySession,
    WorkspaceTab,
} from "../../application/git-session/state/GitSessionState";
import { terminalService } from "../../application/terminal/activeTerminalService";
import type { AppDialogController } from "../../components/AppDialog";
import type { AppearancePreference } from "../../domain/appearance";
import {
    COMMAND_ENABLED,
    commandDefinition,
    commandDisabled,
    type CommandDefinition,
} from "../../domain/commands";
import { DEFAULT_PRODUCT_SETTINGS } from "../../domain/productSettings";
import { DEFAULT_NAMED_TOOL_WINDOW_LAYOUT } from "../../domain/toolWindowLayouts";
import type { RepositoryView } from "../../domain/types";
import { exportElectronSettings } from "../../platform/electronSettings";
import type { AppStore } from "../state/appStore";

export type ProjectCommandPort = Pick<
    AppStore,
    | "dirtyEditorCount"
    | "setInvalidateCachesOpen"
    | "setNewProjectSettingsOpen"
    | "setProductSettings"
    | "setProjectSwitcherOpen"
    | "setRepairIdeOpen"
    | "setRepositoryDialogMode"
    | "setRunConfigurationTemplatesOpen"
    | "setSettingsOpen"
    | "setShowRepositoryDialog"
    | "setToolWindowLayouts"
> & {
    readonly dialog: AppDialogController;
    readonly importSettingsArchive: () => Promise<void>;
    readonly openRepositoryFromPicker: () => Promise<void>;
    readonly session: {
        readonly repository: { readonly repository: RepositoryView | null };
        readonly workspace: {
            readonly activeTab: WorkspaceTab;
            readonly sessions: readonly WorkspaceRepositorySession[];
            readonly openRepositories: readonly unknown[];
            readonly closeProject: () => Promise<void>;
        };
    };
    readonly setAppearancePreference: (
        preference: AppearancePreference,
    ) => void;
};

export function createProjectCommands(
    context: ProjectCommandPort,
): readonly CommandDefinition[] {
    const {
        dialog,
        dirtyEditorCount,
        importSettingsArchive,
        openRepositoryFromPicker,
        session,
        setAppearancePreference,
        setInvalidateCachesOpen,
        setNewProjectSettingsOpen,
        setProductSettings,
        setProjectSwitcherOpen,
        setRepairIdeOpen,
        setRepositoryDialogMode,
        setRunConfigurationTemplatesOpen,
        setSettingsOpen,
        setShowRepositoryDialog,
        setToolWindowLayouts,
    } = context;
    return [
        commandDefinition("workspace.new", () => {
            setRepositoryDialogMode("init");
            setShowRepositoryDialog(true);
        }),
        commandDefinition(
            "workspace.open",
            () => void openRepositoryFromPicker(),
        ),
        commandDefinition("workspace.manageProjects", () => {
            if (session.repository.repository) setProjectSwitcherOpen(true);
            else void openRepositoryFromPicker();
        }),
        commandDefinition("workspace.clone", () => {
            setRepositoryDialogMode("clone");
            setShowRepositoryDialog(true);
        }),
        commandDefinition("workspace.settings", () => setSettingsOpen(true)),
        commandDefinition("workspace.exportSettings", async () => {
            await exportElectronSettings();
        }),
        commandDefinition("workspace.importSettings", async () => {
            await importSettingsArchive();
        }),
        commandDefinition("workspace.restoreDefaultSettings", async () => {
            const accepted = await dialog.confirm({
                title: "Restore default settings?",
                description:
                    "Resets appearance, layout, status widgets, notifications, and keymap settings.",
                impact: "Open repositories, hosting accounts, and repository files are not changed.",
                confirmLabel: "Restore defaults",
                dangerous: true,
            });
            if (!accepted) return;
            setProductSettings(DEFAULT_PRODUCT_SETTINGS);
            setToolWindowLayouts([DEFAULT_NAMED_TOOL_WINDOW_LAYOUT]);
            setAppearancePreference({ theme: "dark", syncWithOs: false });
            setSettingsOpen(false);
        }),
        commandDefinition(
            "workspace.repairIde",
            () => setRepairIdeOpen(true),
            () =>
                session.workspace.activeTab.kind === "repository"
                    ? COMMAND_ENABLED
                    : commandDisabled("Open a project to repair its indexes."),
        ),
        commandDefinition("workspace.invalidateCaches", () =>
            setInvalidateCachesOpen(true),
        ),
        commandDefinition("workspace.settingsNewProjects", () =>
            setNewProjectSettingsOpen(true),
        ),
        commandDefinition("workspace.runConfigurationTemplates", () =>
            setRunConfigurationTemplatesOpen(true),
        ),
        commandDefinition(
            "workspace.close",
            async () => {
                const repositorySessions = session.workspace.sessions.filter(
                    (item) => item.kind === "repository",
                );
                if (repositorySessions.length === 0) return;
                const terminalCount = repositorySessions.reduce(
                    (count, item) =>
                        count +
                        terminalService.count(item.repository.snapshot.id),
                    0,
                );
                if (terminalCount > 0 || dirtyEditorCount > 0) {
                    const consequences = [
                        dirtyEditorCount > 0
                            ? `${dirtyEditorCount} unsaved editor tab(s)`
                            : null,
                        terminalCount > 0
                            ? `${terminalCount} terminal session(s)`
                            : null,
                    ].filter((item): item is string => item !== null);
                    const accepted = await dialog.confirm({
                        title: "Close project?",
                        description:
                            "Closing this project discards unsaved editor state and terminates its running terminal sessions.",
                        impact: consequences.join("\n"),
                        confirmLabel: "Close project",
                        dangerous: true,
                    });
                    if (!accepted) return;
                }
                await session.workspace.closeProject();
            },
            () =>
                session.workspace.openRepositories.length > 0
                    ? COMMAND_ENABLED
                    : commandDisabled("There is no project to close."),
        ),
    ];
}
