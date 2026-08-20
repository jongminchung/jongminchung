import type {
    DesktopTrpcDomain,
    DesktopTrpcOperationType,
} from "../../src/shared/contracts/desktop-trpc";

export const TEST_TRPC_PATHS = {
    runtimeInfo: "platform.runtimeInfo",
    runtimeLauncherInfo: "platform.runtimeLauncherInfo",
    windowGetFullScreen: "platform.windowGetFullScreen",
    windowSetFullScreen: "platform.windowSetFullScreen",
    windowSetPresentationMode: "platform.windowSetPresentationMode",
    maintenanceRelaunch: "platform.maintenanceRelaunch",
    diagnosticsSnapshot: "platform.diagnosticsSnapshot",
    diagnosticsReveal: "platform.diagnosticsReveal",
    diagnosticsCollectLogs: "platform.diagnosticsCollectLogs",
    diagnosticsDumpThreads: "platform.diagnosticsDumpThreads",
    diagnosticsReadConfiguration: "platform.diagnosticsReadConfiguration",
    diagnosticsWriteConfiguration: "platform.diagnosticsWriteConfiguration",
    diagnosticsKeyboardShortcutsPdf: "platform.diagnosticsKeyboardShortcutsPdf",
    diagnosticsListLeftoverDirectories:
        "platform.diagnosticsListLeftoverDirectories",
    diagnosticsDeleteLeftoverDirectories:
        "platform.diagnosticsDeleteLeftoverDirectories",
    exportHtml: "platform.exportHtml",
    exportPatchText: "platform.exportPatchText",
    analysisOpenOfflineInspection: "platform.analysisOpenOfflineInspection",
    settingsGet: "platform.settingsGet",
    settingsSet: "platform.settingsSet",
    settingsDelete: "platform.settingsDelete",
    settingsExport: "platform.settingsExport",
    settingsImport: "platform.settingsImport",
    dialogOpenDirectory: "platform.dialogOpenDirectory",
    dialogOpenFile: "platform.dialogOpenFile",
    dialogSaveFile: "platform.dialogSaveFile",
    shellOpenExternal: "platform.shellOpenExternal",
    clipboardWriteText: "platform.clipboardWriteText",
    clipboardReadText: "platform.clipboardReadText",
    menuSyncState: "platform.menuSyncState",
    gitOpenRepository: "git.openRepository",
    gitInitializeRepository: "git.initializeRepository",
    gitCloneRepository: "git.cloneRepository",
    gitCloseRepository: "git.closeRepository",
    gitInspectSnapshot: "git.inspectSnapshot",
    gitRepositoryService: "git.repositoryService",
    gitQuery: "git.query",
    gitCancelQuery: "git.cancelQuery",
    gitReadFile: "git.readFile",
    gitReadFilePreview: "git.readFilePreview",
    gitWriteWorkingTreeFile: "git.writeWorkingTreeFile",
    gitOpenWorkingTreeFile: "git.openWorkingTreeFile",
    gitWatchRepository: "git.watchRepository",
    gitUnwatchRepository: "git.unwatchRepository",
    terminalCreate: "terminal.create",
    terminalListLaunchTargets: "terminal.listLaunchTargets",
    terminalWrite: "terminal.write",
    terminalResize: "terminal.resize",
    terminalClose: "terminal.close",
    terminalCloseRepository: "terminal.closeRepository",
    hostingSaveAccount: "hosting.saveAccount",
    hostingBeginOAuth: "hosting.beginOAuth",
    hostingAwaitOAuth: "hosting.awaitOAuth",
    hostingCancelOAuth: "hosting.cancelOAuth",
    hostingRestoreAccounts: "hosting.restoreAccounts",
    hostingDeleteAccount: "hosting.deleteAccount",
    hostingExecute: "hosting.execute",
    localHistoryRepositoryService: "localHistory.repositoryService",
} as const;

export type TestDesktopTrpcPath =
    (typeof TEST_TRPC_PATHS)[keyof typeof TEST_TRPC_PATHS];

const QUERY_PATHS = new Set<TestDesktopTrpcPath>([
    TEST_TRPC_PATHS.runtimeInfo,
    TEST_TRPC_PATHS.runtimeLauncherInfo,
    TEST_TRPC_PATHS.windowGetFullScreen,
    TEST_TRPC_PATHS.diagnosticsSnapshot,
    TEST_TRPC_PATHS.diagnosticsReadConfiguration,
    TEST_TRPC_PATHS.diagnosticsListLeftoverDirectories,
    TEST_TRPC_PATHS.settingsGet,
    TEST_TRPC_PATHS.clipboardReadText,
    TEST_TRPC_PATHS.gitInspectSnapshot,
    TEST_TRPC_PATHS.gitReadFile,
    TEST_TRPC_PATHS.gitReadFilePreview,
    TEST_TRPC_PATHS.terminalListLaunchTargets,
]);

export function testTrpcDomain(path: TestDesktopTrpcPath): DesktopTrpcDomain {
    return path.slice(0, path.indexOf(".")) as DesktopTrpcDomain;
}

export function testTrpcOperationType(
    path: TestDesktopTrpcPath,
): DesktopTrpcOperationType {
    return QUERY_PATHS.has(path) ? "query" : "mutation";
}
