export interface RepositoryCommandContext {
    readonly setScratchFileChooserOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly setExportToHtmlOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly inspector:
        | import("../state/workspaceTypes").InspectorState
        | undefined;
    readonly projectFiles: readonly string[];
    readonly setRepositoryViewMode: (
        value: import("react").SetStateAction<
            import("../../domain/changeReview").RepositoryViewMode
        >,
    ) => void;
    readonly setBookmarksOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly setProjectOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly bookmarksOpen: boolean;
    readonly projectOpen: boolean;
    readonly repositoryViewMode: import("../../domain/changeReview").RepositoryViewMode;
    readonly logTabIds: readonly string[];
    readonly setLogTabIds: (
        value: import("react").SetStateAction<readonly string[]>,
    ) => void;
    readonly setLogOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly setActiveLogTabId: (
        value: import("react").SetStateAction<string>,
    ) => void;
    readonly setActiveInspectorKey: (
        value: import("react").SetStateAction<string | undefined>,
    ) => void;
    readonly logOpen: boolean;
    readonly openGitLogTab: () => void;
    readonly focusCurrentSearch: () => void;
    readonly dispatchEditorSearch: (
        action:
            | "find"
            | "replace"
            | "next"
            | "previous"
            | "nextWord"
            | "previousWord"
            | "selectionScope",
    ) => boolean;
    readonly dispatchEditorAction: (action: string) => boolean;
    readonly editorStatus:
        | import("../state/workspaceTypes").EditorStatus
        | undefined;
    readonly editorActionAvailability: (
        requiresEditable: boolean,
    ) => ReturnType<
        import("../../domain/commands").CommandDefinition["availability"]
    >;
    readonly activeToolWindow:
        | import("../state/workspaceTypes").RepositoryToolWindow
        | null;
    readonly setBottomCollapsed: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly setMaximizedToolWindow: (
        value: import("react").SetStateAction<
            import("../state/workspaceTypes").RepositoryToolWindow | null
        >,
    ) => void;
    readonly setActiveToolWindow: (
        value: import("react").SetStateAction<
            import("../state/workspaceTypes").RepositoryToolWindow | null
        >,
    ) => void;
    readonly bottomPanelTab: import("../../domain/workspacePersistence").WorkspaceBottomPanelTab;
    readonly terminalTabCount: number;
    readonly setSideToolWindowWidth: (
        value: import("react").SetStateAction<number>,
    ) => void;
    readonly setBottomPanelHeight: (
        value: import("react").SetStateAction<number>,
    ) => void;
    readonly notifications: readonly import("../../components/NotificationToolWindow").ProductNotification[];
    readonly setNotifications: (
        value: import("react").SetStateAction<
            readonly import("../../components/NotificationToolWindow").ProductNotification[]
        >,
    ) => void;
    readonly balloonId: string | undefined;
    readonly setBalloonId: (
        value: import("react").SetStateAction<string | undefined>,
    ) => void;
    readonly setNotificationOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly notificationOpen: boolean;
    readonly openPaletteFor: (
        scope: import("../../domain/commands").PaletteScope,
    ) => void;
    readonly setProjectSearchInitialQuery: (
        value: import("react").SetStateAction<string>,
    ) => void;
    readonly setProjectSearchSurface: (
        value: import("react").SetStateAction<
            | import("../../components/ProjectSearchDialog").ProjectSearchSurface
            | undefined
        >,
    ) => void;
    readonly navigateInspectorHistory: (offset: -1 | 1) => void;
    readonly navigationIndex: number;
    readonly navigationHistory: import("react").RefObject<
        readonly import("../state/workspaceTypes").InspectorState[]
    >;
    readonly setReplaceInFilesOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly setRecentFindUsagesOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly onOpenSettings: () => void;
    readonly setCodeAnalysisRequest: (
        value: import("react").SetStateAction<
            | {
                  readonly mode: "inspect" | "cleanup";
                  readonly inspectionId?: import("../../domain/codeAnalysis").CodeInspectionId;
              }
            | undefined
        >,
    ) => void;
    readonly runCodeCleanup: (
        scope: import("../../components/CodeAnalysisScopeDialog").CodeAnalysisScope,
    ) => Promise<void>;
    readonly setRunInspectionOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly setInspectionResults: (
        value: import("react").SetStateAction<
            | {
                  readonly title: string;
                  readonly issues: readonly import("../../domain/codeAnalysis").CodeIssue[];
              }
            | undefined
        >,
    ) => void;
    readonly setStackTraceOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly setBottomPanelTab: (
        value: import("react").SetStateAction<
            import("../../domain/workspacePersistence").WorkspaceBottomPanelTab
        >,
    ) => void;
    readonly toggleCurrentBookmark: () => void;
    readonly beginMnemonicBookmark: () => void;
    readonly bookmarks: import("../../domain/bookmarks").ProjectBookmarks;
    readonly openLineBookmark: (
        bookmark: import("../../domain/bookmarks").LineBookmark,
    ) => void;
    readonly setBookmarksPopupMode: (
        value: import("react").SetStateAction<
            | import("../../components/BookmarksPopup").BookmarksPopupMode
            | undefined
        >,
    ) => void;
    readonly productSettings: import("../../domain/productSettings").ProductSettings;
    readonly requestCloseInspector: (key: string) => Promise<void>;
    readonly editorTabAvailability: () => ReturnType<
        import("../../domain/commands").CommandDefinition["availability"]
    >;
    readonly activateRelativeInspector: (offset: -1 | 1) => void;
    readonly inspectorTabKeys: string[];
    readonly setPreviewInspectorKey: (
        value: import("react").SetStateAction<string | undefined>,
    ) => void;
    readonly previewInspectorKey: string | undefined;
    readonly activeInspectorKey: string | undefined;
    readonly requestCloseInspectors: (keys: readonly string[]) => Promise<void>;
    readonly dirtyInspectorKeys: ReadonlySet<string>;
    readonly pinnedInspectorKeys: ReadonlySet<string>;
    readonly activeInspectorIndex: number;
    readonly readOnlyInspectorKeys: string[];
    readonly dialog: import("../../components/AppDialog").AppDialogController;
    readonly session: import("../../git-session/useGitSessionController").GitSessionController;
    readonly repositoryAvailability: () => ReturnType<
        import("../../domain/commands").CommandDefinition["availability"]
    >;
    readonly jumpToLastToolWindow: () => void;
    readonly setProcessesOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly processesOpen: boolean;
    readonly changeSelection:
        | import("../../domain/changeReview").ChangeSelection
        | null;
    readonly historySelectedPath: string | null;
    readonly repository: import("../../domain/types").RepositoryView;
    readonly onOpenPush: (
        localRevision?: string,
        knownRewrite?: boolean,
    ) => void;
    readonly requestOpenRepositoryTool: (
        kind: import("../../components/RepositoryToolDialog").RepositoryToolKind,
    ) => Promise<void>;
    readonly primaryCommit: import("../../domain/types").Commit | undefined;
    readonly setToast: (
        value: import("react").SetStateAction<string | undefined>,
    ) => void;
    readonly workingEntries: readonly import("../../domain/changeReview").ChangeEntry[];
    readonly requestShareProject: (
        provider: "gitHub" | "gitLab",
    ) => Promise<void>;
    readonly createPatchFromLocalChanges: () => Promise<void>;
    readonly applyPatchFromFile: () => Promise<void>;
    readonly applyPatchFromClipboard: () => Promise<void>;
    readonly setVcsOperationsOpen: (
        value: import("react").SetStateAction<boolean>,
    ) => void;
    readonly untrackedPaths: string[];
    readonly hasTrackedWorkingChanges: boolean;
    readonly rollbackVcsFile: () => Promise<void>;
    readonly vcsFileChange: import("../../domain/types").FileChange | null;
    readonly showVcsFileChanges: () => void;
    readonly vcsFileEntry:
        | import("../../domain/changeReview").ChangeEntry
        | null;
    readonly vcsFilePath: string | null;
    readonly compareVcsFile: (selection: "revision" | "ref") => Promise<void>;
    readonly vcsFileVersioned: boolean;
    readonly openVcsFileTab: (tab: "history" | "blame") => void;
    readonly conflictedFile:
        | import("../../domain/types").FileChange
        | undefined;
    readonly openConflict: (
        file: import("../../domain/types").FileChange,
    ) => void;
    readonly runAction: (
        action: keyof import("../../domain/types").ActionAvailability,
    ) => Promise<void>;
    readonly availability: import("../../domain/types").ActionAvailability;
    readonly maximizedToolWindow:
        | import("../state/workspaceTypes").RepositoryToolWindow
        | null;
    readonly repositoryBusy: boolean;
}
