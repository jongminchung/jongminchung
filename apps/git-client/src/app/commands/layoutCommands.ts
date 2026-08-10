import {
  COMMAND_ENABLED,
  commandDefinition,
  commandDisabled,
  type CommandDefinition,
} from "../../domain/commands";
import { DEFAULT_TOOL_WINDOW_LAYOUT } from "../../domain/toolWindowLayouts";
import type { WorkspaceCommandContext } from "./workspaceCommandTypes";

export function createLayoutCommands(
  context: Pick<
    WorkspaceCommandContext,
    | "activeProjectName"
    | "applyToolWindowLayout"
    | "captureToolWindowLayout"
    | "dialog"
    | "renameToolWindowLayout"
    | "saveToolWindowLayout"
    | "session"
    | "setLayoutChooserMode"
    | "setToolWindowLayouts"
    | "toolWindowLayouts"
  >,
): readonly CommandDefinition[] {
  const {
    activeProjectName,
    applyToolWindowLayout,
    captureToolWindowLayout,
    dialog,
    renameToolWindowLayout,
    saveToolWindowLayout,
    session,
    setLayoutChooserMode,
    setToolWindowLayouts,
    toolWindowLayouts,
  } = context;
  return [
    commandDefinition(
      "window.layoutDefault",
      () => applyToolWindowLayout(DEFAULT_TOOL_WINDOW_LAYOUT),
      () =>
        session.activeTab.kind === "repository"
          ? COMMAND_ENABLED
          : commandDisabled("Open a project to restore its layout."),
    ),
    {
      ...commandDefinition(
        "window.activateCurrentProject",
        () => window.focus(),
        () =>
          session.activeTab.kind === "repository"
            ? COMMAND_ENABLED
            : commandDisabled("Open a project window."),
      ),
      label: activeProjectName,
    },
    commandDefinition(
      "window.layoutRestoreCustom",
      () => {
        const layout = toolWindowLayouts[0];
        if (!layout) return;
        if (toolWindowLayouts.length === 1) {
          applyToolWindowLayout(layout.state);
        } else {
          setLayoutChooserMode("restore");
        }
      },
      () =>
        session.activeTab.kind === "repository"
          ? COMMAND_ENABLED
          : commandDisabled("Open a project to restore a layout."),
    ),
    commandDefinition(
      "window.layoutSaveCustom",
      () => {
        const layout = toolWindowLayouts[0];
        if (!layout) return;
        if (toolWindowLayouts.length === 1) {
          saveToolWindowLayout(layout);
        } else {
          setLayoutChooserMode("save");
        }
      },
      () =>
        session.activeTab.kind === "repository"
          ? COMMAND_ENABLED
          : commandDisabled("Open a project to save its layout."),
    ),
    commandDefinition(
      "window.layoutRenameCustom",
      async () => {
        const layout = toolWindowLayouts[0];
        if (!layout) return;
        if (toolWindowLayouts.length === 1) {
          await renameToolWindowLayout(layout);
        } else {
          setLayoutChooserMode("rename");
        }
      },
      () =>
        toolWindowLayouts.length > 0
          ? COMMAND_ENABLED
          : commandDisabled("There are no saved layouts."),
    ),
    commandDefinition(
      "window.layoutSaveNew",
      async () => {
        const state = captureToolWindowLayout();
        if (state === null) return;
        const name = await dialog.input({
          title: "Save Current Layout as New",
          label: "Layout name",
          initialValue: "Custom",
          confirmLabel: "Save",
          validate: (candidate) => {
            const normalized = candidate.trim();
            if (!normalized) return "Enter a layout name.";
            if (normalized.length > 64) return "Layout names must be 64 characters or fewer.";
            return toolWindowLayouts.some(
              (layout) => layout.name.toLocaleLowerCase() === normalized.toLocaleLowerCase(),
            )
              ? "A layout with this name already exists."
              : null;
          },
        });
        if (name === null) return;
        setToolWindowLayouts((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            name: name.trim(),
            state,
          },
        ]);
      },
      () =>
        session.activeTab.kind === "repository"
          ? COMMAND_ENABLED
          : commandDisabled("Open a project to save its layout."),
    ),
  ];
}
