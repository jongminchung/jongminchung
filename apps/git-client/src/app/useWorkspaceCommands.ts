import { useCommandDefinitions } from "../components/CommandProvider";
import { createAppearanceCommands } from "./commands/appearanceCommands";
import { createHelpCommands } from "./commands/helpCommands";
import { createLayoutCommands } from "./commands/layoutCommands";
import { createMacroCommands } from "./commands/macroCommands";
import { createProjectCommands } from "./commands/projectCommands";
import type { WorkspaceCommandPorts } from "./commands/workspaceCommands";

export function useWorkspaceCommands(ports: WorkspaceCommandPorts): void {
    useCommandDefinitions(createProjectCommands(ports.project));
    useCommandDefinitions(createLayoutCommands(ports.layout));
    useCommandDefinitions(createHelpCommands(ports.help));
    useCommandDefinitions(createMacroCommands(ports.macro));
    useCommandDefinitions(createAppearanceCommands(ports.appearance));
}
