import type { CommandDefinition } from "../../domain/commands";
import { createAppearanceCommands } from "./appearanceCommands";
import { createHelpCommands } from "./helpCommands";
import { createLayoutCommands } from "./layoutCommands";
import { createMacroCommands } from "./macroCommands";
import { createProjectCommands } from "./projectCommands";
import type { WorkspaceCommandContext } from "./workspaceCommandTypes";

export { createAppearanceCommands } from "./appearanceCommands";
export { createHelpCommands } from "./helpCommands";
export { createLayoutCommands } from "./layoutCommands";
export { createMacroCommands } from "./macroCommands";
export { createProjectCommands } from "./projectCommands";
export type { WorkspaceCommandContext } from "./workspaceCommandTypes";

export function createWorkspaceCommands(
    context: WorkspaceCommandContext,
): readonly CommandDefinition[] {
    return [
        ...createProjectCommands(context),
        ...createLayoutCommands(context),
        ...createHelpCommands(context),
        ...createMacroCommands(context),
        ...createAppearanceCommands(context),
    ];
}
