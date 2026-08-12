import {
    COMMAND_ENABLED,
    commandDefinition,
    commandDisabled,
    type CommandDefinition,
} from "../../domain/commands";
import { isElectronRuntime } from "../../platform/electron";
import {
    collectDiagnosticLogs,
    dumpDiagnosticThreads,
    openKeyboardShortcutsPdf,
    revealDiagnosticPath,
    writeDiagnosticConfiguration,
} from "../../platform/electronActions";
import type { WorkspaceCommandContext } from "./workspaceCommandTypes";

export function createHelpCommands(
    context: Pick<
        WorkspaceCommandContext,
        | "dialog"
        | "setActivityMonitorOpen"
        | "setCommandLineLauncherOpen"
        | "setDiagnosticConfiguration"
        | "setHelpOpen"
        | "setLeftoverDirectoriesOpen"
        | "setSpecialFilesOpen"
        | "setWhatsNewOpen"
    >,
): readonly CommandDefinition[] {
    const {
        dialog,
        setActivityMonitorOpen,
        setCommandLineLauncherOpen,
        setDiagnosticConfiguration,
        setHelpOpen,
        setLeftoverDirectoriesOpen,
        setSpecialFilesOpen,
        setWhatsNewOpen,
    } = context;
    return [
        commandDefinition("help.open", () => setHelpOpen(true)),
        commandDefinition("help.whatsNew", () => setWhatsNewOpen(true)),
        commandDefinition(
            "help.keyboardShortcutsPdf",
            openKeyboardShortcutsPdf,
            () =>
                isElectronRuntime()
                    ? COMMAND_ENABLED
                    : commandDisabled(
                          "Keyboard Shortcuts PDF requires the Electron application.",
                      ),
        ),
        commandDefinition(
            "help.showLog",
            () => revealDiagnosticPath("logs"),
            () =>
                isElectronRuntime()
                    ? COMMAND_ENABLED
                    : commandDisabled(
                          "Application logs require the Electron application.",
                      ),
        ),
        commandDefinition(
            "help.collectLogs",
            async () => {
                await collectDiagnosticLogs();
            },
            () =>
                isElectronRuntime()
                    ? COMMAND_ENABLED
                    : commandDisabled(
                          "Diagnostic export requires the Electron application.",
                      ),
        ),
        commandDefinition(
            "help.activityMonitor",
            () => setActivityMonitorOpen(true),
            () =>
                isElectronRuntime()
                    ? COMMAND_ENABLED
                    : commandDisabled(
                          "Activity Monitor requires the Electron application.",
                      ),
        ),
        commandDefinition(
            "help.dumpThreads",
            async () => {
                await dumpDiagnosticThreads();
            },
            () =>
                isElectronRuntime()
                    ? COMMAND_ENABLED
                    : commandDisabled(
                          "Thread dumps require the Electron application.",
                      ),
        ),
        commandDefinition(
            "help.debugLogSettings",
            () =>
                setDiagnosticConfiguration({
                    kind: "debugLog",
                    title: "Debug Log Settings",
                    description:
                        "Enter logger categories, one per line. Append :TRACE or :ALL to increase detail.",
                }),
            () =>
                isElectronRuntime()
                    ? COMMAND_ENABLED
                    : commandDisabled(
                          "Debug logging requires the Electron application.",
                      ),
        ),
        commandDefinition(
            "help.specialFiles",
            () => setSpecialFilesOpen(true),
            () =>
                isElectronRuntime()
                    ? COMMAND_ENABLED
                    : commandDisabled(
                          "Special files require the Electron application.",
                      ),
        ),
        commandDefinition(
            "help.changeMemorySettings",
            async () => {
                const value = await dialog.input({
                    title: "Change Memory Settings",
                    label: "Maximum heap size (MiB)",
                    description:
                        "The new renderer heap limit is applied after restart.",
                    initialValue: "2048",
                    confirmLabel: "Save",
                    validate: (candidate) => {
                        const memory = Number(candidate);
                        return Number.isInteger(memory) &&
                            memory >= 256 &&
                            memory <= 32_768
                            ? null
                            : "Enter an integer from 256 to 32768.";
                    },
                });
                if (value === null) return;
                await writeDiagnosticConfiguration(
                    "vmOptions",
                    `# Applied after the next restart.\n--max-old-space-size=${value}\n`,
                );
            },
            () =>
                isElectronRuntime()
                    ? COMMAND_ENABLED
                    : commandDisabled(
                          "Memory settings require the Electron application.",
                      ),
        ),
        commandDefinition(
            "help.customProperties",
            () =>
                setDiagnosticConfiguration({
                    kind: "customProperties",
                    title: "Edit Custom Properties",
                    description:
                        "Enter Git Client property overrides as key=value lines.",
                }),
            () =>
                isElectronRuntime()
                    ? COMMAND_ENABLED
                    : commandDisabled(
                          "Custom properties require the Electron application.",
                      ),
        ),
        commandDefinition(
            "help.customVmOptions",
            () =>
                setDiagnosticConfiguration({
                    kind: "vmOptions",
                    title: "Edit Custom VM Options",
                    description:
                        "For safety, Git Client accepts only --max-old-space-size=256..32768.",
                }),
            () =>
                isElectronRuntime()
                    ? COMMAND_ENABLED
                    : commandDisabled(
                          "Custom VM options require the Electron application.",
                      ),
        ),
        commandDefinition(
            "help.deleteLeftovers",
            () => setLeftoverDirectoriesOpen(true),
            () =>
                isElectronRuntime()
                    ? COMMAND_ENABLED
                    : commandDisabled(
                          "Leftover profile cleanup requires the Electron application.",
                      ),
        ),
        commandDefinition(
            "tools.commandLineLauncher",
            () => setCommandLineLauncherOpen(true),
            () =>
                isElectronRuntime()
                    ? COMMAND_ENABLED
                    : commandDisabled(
                          "Command-line launcher information requires Electron.",
                      ),
        ),
    ];
}
