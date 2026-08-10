import { useCommandDefinitions } from "../components/CommandProvider";
import type { CommandDefinition } from "../domain/commands";
import {
  createAppearanceLayoutCommands,
  type AppearanceLayoutCommandPort,
} from "./commands/appearanceLayoutCommands";
import {
  createEditorNavigationCommands,
  type EditorNavigationCommandPort,
} from "./commands/editorNavigationCommands";
import { createProjectCommands, type ProjectCommandPort } from "./commands/projectCommands";
import type { RepositoryCommandContext } from "./commands/repositoryCommandTypes";
import {
  createSearchAnalysisCommands,
  type SearchAnalysisCommandPort,
} from "./commands/searchAnalysisCommands";
import { createVcsCommands, type VcsCommandPort } from "./commands/vcsCommands";

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
  RepositoryCommandContext,
  SearchAnalysisCommandPort,
  VcsCommandPort,
};

export function createRepositoryCommands(
  context: RepositoryCommandContext,
): readonly CommandDefinition[] {
  return [
    ...createProjectCommands(context),
    ...createEditorNavigationCommands(context),
    ...createVcsCommands(context),
    ...createSearchAnalysisCommands(context),
    ...createAppearanceLayoutCommands(context),
  ];
}

export function useRepositoryCommands(context: RepositoryCommandContext): void {
  useCommandDefinitions(createRepositoryCommands(context));
}
