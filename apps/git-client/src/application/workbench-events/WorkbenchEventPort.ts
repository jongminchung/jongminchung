import type {
  EditorAction,
  EditorSearchAction,
  EditorStatus,
} from "../../domain/editorContracts";
import type { ProductSettings } from "../../domain/productSettings";
import type { ToolWindowLayout } from "../../domain/toolWindowLayouts";
import type { WorkspaceBottomPanelTab } from "../../domain/workspacePersistence";

export interface WorkbenchEventDetailMap {
  readonly "git-client:apply-tool-window-layout": {
    readonly layout: ToolWindowLayout;
  };
  readonly "git-client:capture-tool-window-layout": {
    readonly accept: (layout: ToolWindowLayout) => void;
  };
  readonly "git-client:command-executed": { readonly id: string };
  readonly "git-client:editor-action": { readonly action: EditorAction };
  readonly "git-client:editor-activated": string;
  readonly "git-client:editor-search": {
    readonly action: EditorSearchAction;
  };
  readonly "git-client:editor-status": EditorStatus | null;
  readonly "git-client:find": { readonly direction: -1 | 1 };
  readonly "git-client:go-to-line": {
    readonly line: number;
    readonly column: number;
  };
  readonly "git-client:keymap-changed": ProductSettings["keymapOverrides"];
  readonly "git-client:open-bottom-panel": {
    readonly tab: WorkspaceBottomPanelTab;
  };
  readonly "git-client:open-git-console": undefined;
  readonly "git-client:open-local-history": undefined;
  readonly "git-client:open-terminal": undefined;
  readonly "git-client:product-settings-changed": ProductSettings;
  readonly "git-client:product-settings-request": {
    readonly kind: "toggleCompact";
  };
  readonly "git-client:reload-editors": undefined;
  readonly "git-client:repair-indexes": undefined;
  readonly "git-client:repository-view-request": "changes";
  readonly "git-client:save-all":
    | undefined
    | { readonly tasks: Promise<void>[] };
  readonly "git-client:shelve-changes": undefined;
  readonly "git-client:show-processes": undefined;
  readonly "git-client:stash-changes": undefined;
  readonly "git-client:terminal-tab-close": undefined;
  readonly "git-client:terminal-tab-navigate": { readonly offset: -1 | 1 };
  readonly "git-client:toggle-column-selection": undefined;
}

export type WorkbenchEventName = keyof WorkbenchEventDetailMap;

export interface WorkbenchDispatchOptions {
  readonly cancelable?: boolean;
}

export interface WorkbenchEventControl {
  preventDefault(): void;
}

export interface WorkbenchEventPort {
  dispatch<Name extends WorkbenchEventName>(
    name: Name,
    detail: WorkbenchEventDetailMap[Name],
    options?: WorkbenchDispatchOptions,
  ): boolean;
  listen<Name extends WorkbenchEventName>(
    name: Name,
    listener: (
      detail: WorkbenchEventDetailMap[Name],
      control: WorkbenchEventControl,
    ) => void,
  ): () => void;
}

const inertPort: WorkbenchEventPort = {
  dispatch: () => true,
  listen: () => () => undefined,
};

let activePort: WorkbenchEventPort = inertPort;

export function setWorkbenchEventPort(port: WorkbenchEventPort): () => void {
  const previous = activePort;
  activePort = port;
  return () => {
    if (activePort === port) activePort = previous;
  };
}

export function dispatchWorkbenchEvent<Name extends WorkbenchEventName>(
  name: Name,
  detail: WorkbenchEventDetailMap[Name],
  options?: WorkbenchDispatchOptions,
): boolean {
  return activePort.dispatch(name, detail, options);
}

export function listenWorkbenchEvent<Name extends WorkbenchEventName>(
  name: Name,
  listener: (
    detail: WorkbenchEventDetailMap[Name],
    control: WorkbenchEventControl,
  ) => void,
): () => void {
  return activePort.listen(name, listener);
}
