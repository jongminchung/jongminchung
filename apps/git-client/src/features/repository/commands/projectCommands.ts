import { dispatchWorkbenchEvent } from "../../../application/workbench-events/WorkbenchEventPort";
import {
    COMMAND_ENABLED,
    commandDefinition,
    commandDisabled,
    type CommandDefinition,
} from "../../../domain/commands";
export interface ProjectCommandPort {
    readonly dialog: import("../../../components/AppDialog").AppDialogController;
    readonly dirtyInspectorKeys: ReadonlySet<string>;
    readonly inspector:
        | import("../state/workspaceTypes").InspectorState
        | undefined;
    readonly projectFiles: readonly string[];
    readonly repositoryAvailability: () => ReturnType<
        CommandDefinition["availability"]
    >;
    readonly session: import("../../../application/git-session/ports/GitSessionCapabilities").GitSessionCapabilities;
    readonly setExportToHtmlOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly setScratchFileChooserOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
}

export function createProjectCommands(
    context: ProjectCommandPort,
): readonly CommandDefinition[] {
    const {
        dialog,
        dirtyInspectorKeys,
        inspector,
        projectFiles,
        repositoryAvailability,
        session,
        setExportToHtmlOpen,
        setScratchFileChooserOpen,
    } = context;
    return [
        commandDefinition("workspace.newScratch", () =>
            setScratchFileChooserOpen(true),
        ),
        commandDefinition(
            "workspace.exportHtml",
            () => setExportToHtmlOpen(true),
            () =>
                inspector?.path || projectFiles.length > 0
                    ? COMMAND_ENABLED
                    : commandDisabled("Select a file or directory to export."),
        ),
        commandDefinition(
            "workspace.reloadAll",
            async () => {
                if (dirtyInspectorKeys.size > 0) {
                    const accepted = await dialog.confirm({
                        title: "Reload all files from disk?",
                        description: `${dirtyInspectorKeys.size} editor tab(s) contain unsaved changes.`,
                        impact: "Unsaved editor content will be lost.",
                        confirmLabel: "Discard and reload",
                        dangerous: true,
                    });
                    if (!accepted) return;
                }
                dispatchWorkbenchEvent("git-client:reload-editors", undefined);
                await session.queries.reload();
            },
            repositoryAvailability,
        ),
    ];
}
