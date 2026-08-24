import type { SetStateAction } from "react";
import type { StateCreator } from "zustand/vanilla";
import { createStore } from "zustand/vanilla";
import type { RepositoryDialogMode } from "../../components/RepositoryDialog";
import type { RepositoryToolKind } from "../../components/RepositoryToolDialog";
import {
  DEFAULT_APPEARANCE_PREFERENCE,
  type AppearancePreference,
} from "../../domain/appearance";
import { type SavedMacro } from "../../domain/macros";
import {
  DEFAULT_PRODUCT_SETTINGS,
  type ProductSettings,
} from "../../domain/productSettings";
import {
  DEFAULT_RUN_CONFIGURATION_TEMPLATES,
  type RunConfigurationTemplate,
} from "../../domain/runConfigurationTemplates";
import {
  DEFAULT_NAMED_TOOL_WINDOW_LAYOUT,
  type NamedToolWindowLayout,
} from "../../domain/toolWindowLayouts";
import type { DiagnosticConfigurationKind } from "../../shared/contracts/ipc";

type Setter<T> = (value: SetStateAction<T>) => void;

function resolve<T>(value: SetStateAction<T>, current: T): T {
  return typeof value === "function"
    ? (value as (previous: T) => T)(current)
    : value;
}

export interface PushRequest {
  readonly localRevision: string;
  readonly knownRewrite: boolean;
}

export interface DiagnosticConfiguration {
  readonly kind: DiagnosticConfigurationKind;
  readonly title: string;
  readonly description: string;
}

export type LayoutChooserMode = "restore" | "save" | "rename";
export type RepositoryChromeMode = "editor" | "terminal";

export interface AppOverlaySlice {
  readonly showRepositoryDialog: boolean;
  readonly pendingTrustPath: string | null;
  readonly repositoryDialogMode: RepositoryDialogMode;
  readonly projectSwitcherOpen: boolean;
  readonly repositoryTool: RepositoryToolKind | null;
  readonly pushRequest: PushRequest | null;
  readonly settingsOpen: boolean;
  readonly helpOpen: boolean;
  readonly whatsNewOpen: boolean;
  readonly activityMonitorOpen: boolean;
  readonly specialFilesOpen: boolean;
  readonly leftoverDirectoriesOpen: boolean;
  readonly commandLineLauncherOpen: boolean;
  readonly diagnosticConfiguration: DiagnosticConfiguration | null;
  readonly newProjectSettingsOpen: boolean;
  readonly quickSwitchSchemeOpen: boolean;
  readonly repairIdeOpen: boolean;
  readonly invalidateCachesOpen: boolean;
  readonly runConfigurationTemplatesOpen: boolean;
  readonly savedMacrosOpen: boolean;
  readonly layoutChooserMode: LayoutChooserMode | undefined;
  readonly setShowRepositoryDialog: Setter<boolean>;
  readonly setPendingTrustPath: Setter<string | null>;
  readonly setRepositoryDialogMode: Setter<RepositoryDialogMode>;
  readonly setProjectSwitcherOpen: Setter<boolean>;
  readonly setRepositoryTool: Setter<RepositoryToolKind | null>;
  readonly setPushRequest: Setter<PushRequest | null>;
  readonly setSettingsOpen: Setter<boolean>;
  readonly setHelpOpen: Setter<boolean>;
  readonly setWhatsNewOpen: Setter<boolean>;
  readonly setActivityMonitorOpen: Setter<boolean>;
  readonly setSpecialFilesOpen: Setter<boolean>;
  readonly setLeftoverDirectoriesOpen: Setter<boolean>;
  readonly setCommandLineLauncherOpen: Setter<boolean>;
  readonly setDiagnosticConfiguration: Setter<DiagnosticConfiguration | null>;
  readonly setNewProjectSettingsOpen: Setter<boolean>;
  readonly setQuickSwitchSchemeOpen: Setter<boolean>;
  readonly setRepairIdeOpen: Setter<boolean>;
  readonly setInvalidateCachesOpen: Setter<boolean>;
  readonly setRunConfigurationTemplatesOpen: Setter<boolean>;
  readonly setSavedMacrosOpen: Setter<boolean>;
  readonly setLayoutChooserMode: Setter<LayoutChooserMode | undefined>;
}

export interface AppSettingsSlice {
  readonly savedMacros: readonly SavedMacro[];
  readonly savedMacrosLoaded: boolean;
  readonly macroRecording: boolean;
  readonly recordedCommandIds: readonly string[];
  readonly lastMacro: SavedMacro | null;
  readonly productSettings: ProductSettings;
  readonly toolWindowLayouts: readonly NamedToolWindowLayout[];
  readonly toolWindowLayoutsLoaded: boolean;
  readonly newProjectSettings: ProductSettings;
  readonly newProjectAppearancePreference: AppearancePreference;
  readonly runConfigurationTemplates: readonly RunConfigurationTemplate[];
  readonly productSettingsLoaded: boolean;
  readonly projectDefaultsLoaded: boolean;
  readonly dirtyEditorCount: number;
  readonly repositoryChromeMode: RepositoryChromeMode;
  readonly setSavedMacros: Setter<readonly SavedMacro[]>;
  readonly setSavedMacrosLoaded: Setter<boolean>;
  readonly setMacroRecording: Setter<boolean>;
  readonly setRecordedCommandIds: Setter<readonly string[]>;
  readonly setLastMacro: Setter<SavedMacro | null>;
  readonly setProductSettings: Setter<ProductSettings>;
  readonly setToolWindowLayouts: Setter<readonly NamedToolWindowLayout[]>;
  readonly setToolWindowLayoutsLoaded: Setter<boolean>;
  readonly setNewProjectSettings: Setter<ProductSettings>;
  readonly setNewProjectAppearancePreference: Setter<AppearancePreference>;
  readonly setRunConfigurationTemplates: Setter<
    readonly RunConfigurationTemplate[]
  >;
  readonly setProductSettingsLoaded: Setter<boolean>;
  readonly setProjectDefaultsLoaded: Setter<boolean>;
  readonly setDirtyEditorCount: Setter<number>;
  readonly setRepositoryChromeMode: Setter<RepositoryChromeMode>;
}

export type AppStore = AppOverlaySlice & AppSettingsSlice;
type AppSliceCreator<T> = StateCreator<AppStore, [], [], T>;

const createAppOverlaySlice: AppSliceCreator<AppOverlaySlice> = (set) => ({
  showRepositoryDialog: false,
  pendingTrustPath: null,
  repositoryDialogMode: "open",
  projectSwitcherOpen: false,
  repositoryTool: null,
  pushRequest: null,
  settingsOpen: false,
  helpOpen: false,
  whatsNewOpen: false,
  activityMonitorOpen: false,
  specialFilesOpen: false,
  leftoverDirectoriesOpen: false,
  commandLineLauncherOpen: false,
  diagnosticConfiguration: null,
  newProjectSettingsOpen: false,
  quickSwitchSchemeOpen: false,
  repairIdeOpen: false,
  invalidateCachesOpen: false,
  runConfigurationTemplatesOpen: false,
  savedMacrosOpen: false,
  layoutChooserMode: undefined,
  setShowRepositoryDialog: (value) =>
    set((state) => ({
      showRepositoryDialog: resolve(value, state.showRepositoryDialog),
    })),
  setPendingTrustPath: (value) =>
    set((state) => ({
      pendingTrustPath: resolve(value, state.pendingTrustPath),
    })),
  setRepositoryDialogMode: (value) =>
    set((state) => ({
      repositoryDialogMode: resolve(value, state.repositoryDialogMode),
    })),
  setProjectSwitcherOpen: (value) =>
    set((state) => ({
      projectSwitcherOpen: resolve(value, state.projectSwitcherOpen),
    })),
  setRepositoryTool: (value) =>
    set((state) => ({
      repositoryTool: resolve(value, state.repositoryTool),
    })),
  setPushRequest: (value) =>
    set((state) => ({ pushRequest: resolve(value, state.pushRequest) })),
  setSettingsOpen: (value) =>
    set((state) => ({ settingsOpen: resolve(value, state.settingsOpen) })),
  setHelpOpen: (value) =>
    set((state) => ({ helpOpen: resolve(value, state.helpOpen) })),
  setWhatsNewOpen: (value) =>
    set((state) => ({ whatsNewOpen: resolve(value, state.whatsNewOpen) })),
  setActivityMonitorOpen: (value) =>
    set((state) => ({
      activityMonitorOpen: resolve(value, state.activityMonitorOpen),
    })),
  setSpecialFilesOpen: (value) =>
    set((state) => ({
      specialFilesOpen: resolve(value, state.specialFilesOpen),
    })),
  setLeftoverDirectoriesOpen: (value) =>
    set((state) => ({
      leftoverDirectoriesOpen: resolve(value, state.leftoverDirectoriesOpen),
    })),
  setCommandLineLauncherOpen: (value) =>
    set((state) => ({
      commandLineLauncherOpen: resolve(value, state.commandLineLauncherOpen),
    })),
  setDiagnosticConfiguration: (value) =>
    set((state) => ({
      diagnosticConfiguration: resolve(value, state.diagnosticConfiguration),
    })),
  setNewProjectSettingsOpen: (value) =>
    set((state) => ({
      newProjectSettingsOpen: resolve(value, state.newProjectSettingsOpen),
    })),
  setQuickSwitchSchemeOpen: (value) =>
    set((state) => ({
      quickSwitchSchemeOpen: resolve(value, state.quickSwitchSchemeOpen),
    })),
  setRepairIdeOpen: (value) =>
    set((state) => ({
      repairIdeOpen: resolve(value, state.repairIdeOpen),
    })),
  setInvalidateCachesOpen: (value) =>
    set((state) => ({
      invalidateCachesOpen: resolve(value, state.invalidateCachesOpen),
    })),
  setRunConfigurationTemplatesOpen: (value) =>
    set((state) => ({
      runConfigurationTemplatesOpen: resolve(
        value,
        state.runConfigurationTemplatesOpen,
      ),
    })),
  setSavedMacrosOpen: (value) =>
    set((state) => ({
      savedMacrosOpen: resolve(value, state.savedMacrosOpen),
    })),
  setLayoutChooserMode: (value) =>
    set((state) => ({
      layoutChooserMode: resolve(value, state.layoutChooserMode),
    })),
});

const createAppSettingsSlice: AppSliceCreator<AppSettingsSlice> = (set) => ({
  savedMacros: [],
  savedMacrosLoaded: false,
  macroRecording: false,
  recordedCommandIds: [],
  lastMacro: null,
  productSettings: DEFAULT_PRODUCT_SETTINGS,
  toolWindowLayouts: [DEFAULT_NAMED_TOOL_WINDOW_LAYOUT],
  toolWindowLayoutsLoaded: false,
  newProjectSettings: DEFAULT_PRODUCT_SETTINGS,
  newProjectAppearancePreference: DEFAULT_APPEARANCE_PREFERENCE,
  runConfigurationTemplates: DEFAULT_RUN_CONFIGURATION_TEMPLATES,
  productSettingsLoaded: false,
  projectDefaultsLoaded: false,
  dirtyEditorCount: 0,
  repositoryChromeMode: "editor",
  setSavedMacros: (value) =>
    set((state) => ({ savedMacros: resolve(value, state.savedMacros) })),
  setSavedMacrosLoaded: (value) =>
    set((state) => ({
      savedMacrosLoaded: resolve(value, state.savedMacrosLoaded),
    })),
  setMacroRecording: (value) =>
    set((state) => ({
      macroRecording: resolve(value, state.macroRecording),
    })),
  setRecordedCommandIds: (value) =>
    set((state) => ({
      recordedCommandIds: resolve(value, state.recordedCommandIds),
    })),
  setLastMacro: (value) =>
    set((state) => ({ lastMacro: resolve(value, state.lastMacro) })),
  setProductSettings: (value) =>
    set((state) => ({
      productSettings: resolve(value, state.productSettings),
    })),
  setToolWindowLayouts: (value) =>
    set((state) => ({
      toolWindowLayouts: resolve(value, state.toolWindowLayouts),
    })),
  setToolWindowLayoutsLoaded: (value) =>
    set((state) => ({
      toolWindowLayoutsLoaded: resolve(value, state.toolWindowLayoutsLoaded),
    })),
  setNewProjectSettings: (value) =>
    set((state) => ({
      newProjectSettings: resolve(value, state.newProjectSettings),
    })),
  setNewProjectAppearancePreference: (value) =>
    set((state) => ({
      newProjectAppearancePreference: resolve(
        value,
        state.newProjectAppearancePreference,
      ),
    })),
  setRunConfigurationTemplates: (value) =>
    set((state) => ({
      runConfigurationTemplates: resolve(
        value,
        state.runConfigurationTemplates,
      ),
    })),
  setProductSettingsLoaded: (value) =>
    set((state) => ({
      productSettingsLoaded: resolve(value, state.productSettingsLoaded),
    })),
  setProjectDefaultsLoaded: (value) =>
    set((state) => ({
      projectDefaultsLoaded: resolve(value, state.projectDefaultsLoaded),
    })),
  setDirtyEditorCount: (value) =>
    set((state) => ({
      dirtyEditorCount: resolve(value, state.dirtyEditorCount),
    })),
  setRepositoryChromeMode: (value) =>
    set((state) => ({
      repositoryChromeMode: resolve(value, state.repositoryChromeMode),
    })),
});

export function createAppStore() {
  return createStore<AppStore>()((...arguments_) => ({
    ...createAppOverlaySlice(...arguments_),
    ...createAppSettingsSlice(...arguments_),
  }));
}

export type AppStoreApi = ReturnType<typeof createAppStore>;
