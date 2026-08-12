export type WorkspaceCommandContext = Pick<
    import("../state/appStore").AppStore,
    | "dirtyEditorCount"
    | "lastMacro"
    | "macroRecording"
    | "productSettings"
    | "recordedCommandIds"
    | "savedMacros"
    | "setActivityMonitorOpen"
    | "setCommandLineLauncherOpen"
    | "setDiagnosticConfiguration"
    | "setHelpOpen"
    | "setInvalidateCachesOpen"
    | "setLastMacro"
    | "setLayoutChooserMode"
    | "setLeftoverDirectoriesOpen"
    | "setMacroRecording"
    | "setNewProjectSettingsOpen"
    | "setProductSettings"
    | "setProjectSwitcherOpen"
    | "setQuickSwitchSchemeOpen"
    | "setRecordedCommandIds"
    | "setRepairIdeOpen"
    | "setRepositoryDialogMode"
    | "setRunConfigurationTemplatesOpen"
    | "setSavedMacros"
    | "setSavedMacrosOpen"
    | "setSettingsOpen"
    | "setShowRepositoryDialog"
    | "setSpecialFilesOpen"
    | "setToolWindowLayouts"
    | "setWhatsNewOpen"
    | "toolWindowLayouts"
> & {
    readonly activeProjectName: string;
    readonly applyToolWindowLayout: (
        layout: import("../../domain/toolWindowLayouts").ToolWindowLayout,
    ) => void;
    readonly captureToolWindowLayout: () =>
        | import("../../domain/toolWindowLayouts").ToolWindowLayout
        | null;
    readonly commands: ReturnType<
        typeof import("../../components/CommandProvider").useCommands
    >;
    readonly dialog: import("../../components/AppDialog").AppDialogController;
    readonly importSettingsArchive: () => Promise<void>;
    readonly openRepositoryFromPicker: () => Promise<void>;
    readonly presentationPreviousFullScreen: { current: boolean };
    readonly renameToolWindowLayout: (
        layout: import("../../domain/toolWindowLayouts").NamedToolWindowLayout,
    ) => Promise<void>;
    readonly saveToolWindowLayout: (
        layout: import("../../domain/toolWindowLayouts").NamedToolWindowLayout,
    ) => void;
    readonly session: import("../../git-session/useGitSessionController").GitSessionController;
    readonly setAppearancePreference: (
        preference: import("../../domain/appearance").AppearancePreference,
    ) => void;
    readonly zenPreviousFullScreen: { current: boolean };
};
