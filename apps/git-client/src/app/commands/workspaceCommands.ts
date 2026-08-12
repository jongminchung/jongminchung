import type { CommandDefinition } from "../../domain/commands";
import {
    createAppearanceCommands,
    type AppearanceCommandPort,
} from "./appearanceCommands";
import { createHelpCommands, type HelpCommandPort } from "./helpCommands";
import { createLayoutCommands, type LayoutCommandPort } from "./layoutCommands";
import { createMacroCommands, type MacroCommandPort } from "./macroCommands";
import {
    createProjectCommands,
    type ProjectCommandPort,
} from "./projectCommands";

export { createAppearanceCommands } from "./appearanceCommands";
export { createHelpCommands } from "./helpCommands";
export { createLayoutCommands } from "./layoutCommands";
export { createMacroCommands } from "./macroCommands";
export { createProjectCommands } from "./projectCommands";
export interface WorkspaceCommandPorts {
    readonly appearance: AppearanceCommandPort;
    readonly help: HelpCommandPort;
    readonly layout: LayoutCommandPort;
    readonly macro: MacroCommandPort;
    readonly project: ProjectCommandPort;
}

export function createWorkspaceCommands(
    ports: WorkspaceCommandPorts,
): readonly CommandDefinition[] {
    return [
        ...createProjectCommands(ports.project),
        ...createLayoutCommands(ports.layout),
        ...createHelpCommands(ports.help),
        ...createMacroCommands(ports.macro),
        ...createAppearanceCommands(ports.appearance),
    ];
}
