import { useCommandDefinitions } from "../../../components/CommandProvider";
import type { CommandDefinition } from "../../../domain/commands";
import {
    createAppearanceLayoutCommands,
    type AppearanceLayoutCommandPort,
} from "./appearanceLayoutCommands";
import {
    createEditorNavigationCommands,
    type EditorNavigationCommandPort,
} from "./editorNavigationCommands";
import {
    createProjectCommands,
    type ProjectCommandPort,
} from "./projectCommands";
import {
    createSearchAnalysisCommands,
    type SearchAnalysisCommandPort,
} from "./searchAnalysisCommands";
import { createVcsCommands, type VcsCommandPort } from "./vcsCommands";

export {
    createAppearanceLayoutCommands,
    createEditorNavigationCommands,
    createProjectCommands,
    createSearchAnalysisCommands,
    createVcsCommands,
};
export type {
    AppearanceLayoutCommandPort,
    EditorNavigationCommandPort,
    ProjectCommandPort,
    SearchAnalysisCommandPort,
    VcsCommandPort,
};

export interface RepositoryCommandPorts {
    readonly project: ProjectCommandPort;
    readonly editor: EditorNavigationCommandPort;
    readonly vcs: VcsCommandPort;
    readonly search: SearchAnalysisCommandPort;
    readonly appearance: AppearanceLayoutCommandPort;
}

export function createRepositoryCommands(
    ports: RepositoryCommandPorts,
): readonly CommandDefinition[] {
    return [
        ...createProjectCommands(ports.project),
        ...createEditorNavigationCommands(ports.editor),
        ...createVcsCommands(ports.vcs),
        ...createSearchAnalysisCommands(ports.search),
        ...createAppearanceLayoutCommands(ports.appearance),
    ];
}

export function useRepositoryCommands(ports: RepositoryCommandPorts): void {
    useCommandDefinitions(createProjectCommands(ports.project));
    useCommandDefinitions(createEditorNavigationCommands(ports.editor));
    useCommandDefinitions(createVcsCommands(ports.vcs));
    useCommandDefinitions(createSearchAnalysisCommands(ports.search));
    useCommandDefinitions(createAppearanceLayoutCommands(ports.appearance));
}
