import { useCommandDefinitions } from "../components/CommandProvider";
import { createAppearanceCommands } from "./commands/appearanceCommands";
import { createHelpCommands } from "./commands/helpCommands";
import { createLayoutCommands } from "./commands/layoutCommands";
import { createMacroCommands } from "./commands/macroCommands";
import { createProjectCommands } from "./commands/projectCommands";
import type { WorkspaceCommandContext } from "./commands/workspaceCommandTypes";

export function useWorkspaceCommands(context: WorkspaceCommandContext): void {
    useCommandDefinitions(createProjectCommands(context));
    useCommandDefinitions(createLayoutCommands(context));
    useCommandDefinitions(createHelpCommands(context));
    useCommandDefinitions(createMacroCommands(context));
    useCommandDefinitions(createAppearanceCommands(context));
}
