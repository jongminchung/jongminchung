import {
    COMMAND_ENABLED,
    commandDefinition,
    commandDisabled,
    type CommandDefinition,
} from "../../domain/commands";
import type { RepositoryCommandContext } from "./repositoryCommandTypes";

export type ProjectCommandPort = Pick<
    RepositoryCommandContext,
    | "dialog"
    | "dirtyInspectorKeys"
    | "inspector"
    | "projectFiles"
    | "repositoryAvailability"
    | "session"
    | "setExportToHtmlOpen"
    | "setScratchFileChooserOpen"
>;

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
                window.dispatchEvent(
                    new CustomEvent("git-client:reload-editors"),
                );
                await session.queries.reload();
            },
            repositoryAvailability,
        ),
    ];
}
