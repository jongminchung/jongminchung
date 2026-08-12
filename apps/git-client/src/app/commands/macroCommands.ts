import {
    COMMAND_ENABLED,
    commandDefinition,
    commandDisabled,
    type CommandDefinition,
    type CommandId,
} from "../../domain/commands";
import type { SavedMacro } from "../../domain/macros";
import type { WorkspaceCommandContext } from "./workspaceCommandTypes";

export function createMacroCommands(
    context: Pick<
        WorkspaceCommandContext,
        | "commands"
        | "dialog"
        | "lastMacro"
        | "macroRecording"
        | "recordedCommandIds"
        | "savedMacros"
        | "setLastMacro"
        | "setMacroRecording"
        | "setRecordedCommandIds"
        | "setSavedMacros"
        | "setSavedMacrosOpen"
    >,
): readonly CommandDefinition[] {
    const {
        commands,
        dialog,
        lastMacro,
        macroRecording,
        recordedCommandIds,
        savedMacros,
        setLastMacro,
        setMacroRecording,
        setRecordedCommandIds,
        setSavedMacros,
        setSavedMacrosOpen,
    } = context;
    return [
        {
            ...commandDefinition("edit.startMacroRecording", async () => {
                if (!macroRecording) {
                    setRecordedCommandIds([]);
                    setMacroRecording(true);
                    return;
                }
                setMacroRecording(false);
                const macro: SavedMacro = {
                    id: crypto.randomUUID(),
                    name: "Last Macro",
                    commandIds: recordedCommandIds,
                };
                const name = await dialog.input({
                    title: "Enter Macro Name",
                    label: "Macro name",
                    description:
                        "Enter a name for the macro. Leave blank if the macro is temporary.",
                    allowEmpty: true,
                    confirmLabel: "OK",
                    validate: (candidate) =>
                        candidate.length > 128
                            ? "Macro names must be 128 characters or fewer."
                            : savedMacros.some(
                                    (saved) => saved.name === candidate,
                                )
                              ? "A macro with this name already exists."
                              : null,
                });
                if (name === null) return;
                setLastMacro(macro);
                if (name === "") return;
                setSavedMacros((current) => [...current, { ...macro, name }]);
            }),
            label: macroRecording
                ? "Stop Macro Recording"
                : "Start Macro Recording",
        },
        commandDefinition(
            "edit.playbackLastMacro",
            async () => {
                if (lastMacro === null) return;
                for (const commandId of lastMacro.commandIds) {
                    await commands.execute(commandId as CommandId);
                }
            },
            () =>
                lastMacro !== null && !macroRecording
                    ? COMMAND_ENABLED
                    : commandDisabled(
                          macroRecording
                              ? "Stop macro recording before playback."
                              : "No macro has been recorded in this session.",
                      ),
        ),
        commandDefinition("edit.playSavedMacros", () =>
            setSavedMacrosOpen(true),
        ),
    ];
}
