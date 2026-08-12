import { z } from "zod";

export const DESKTOP_RPC_CHANNELS = {
  platform: "git-client:rpc:platform",
  git: "git-client:rpc:git",
  terminal: "git-client:rpc:terminal",
  hosting: "git-client:rpc:hosting",
  localHistory: "git-client:rpc:local-history",
} as const;

export type DesktopRpcDomain = keyof typeof DESKTOP_RPC_CHANNELS;

export const RPC_PROCEDURES = {
  runtimeInfo: "runtime.info",
  runtimeLauncherInfo: "runtime.launcherInfo",
  windowGetFullScreen: "window.getFullScreen",
  windowSetFullScreen: "window.setFullScreen",
  windowSetPresentationMode: "window.setPresentationMode",
  maintenanceRelaunch: "maintenance.relaunch",
  diagnosticsSnapshot: "diagnostics.snapshot",
  diagnosticsReveal: "diagnostics.reveal",
  diagnosticsCollectLogs: "diagnostics.collectLogs",
  diagnosticsDumpThreads: "diagnostics.dumpThreads",
  diagnosticsReadConfiguration: "diagnostics.readConfiguration",
  diagnosticsWriteConfiguration: "diagnostics.writeConfiguration",
  diagnosticsKeyboardShortcutsPdf: "diagnostics.keyboardShortcutsPdf",
  diagnosticsListLeftoverDirectories: "diagnostics.listLeftoverDirectories",
  diagnosticsDeleteLeftoverDirectories: "diagnostics.deleteLeftoverDirectories",
  exportHtml: "export.html",
  exportPatchText: "export.patchText",
  analysisOpenOfflineInspection: "analysis.openOfflineInspection",
  settingsGet: "settings.get",
  settingsSet: "settings.set",
  settingsDelete: "settings.delete",
  settingsExport: "settings.export",
  settingsImport: "settings.import",
  dialogOpenDirectory: "dialog.openDirectory",
  dialogOpenFile: "dialog.openFile",
  dialogSaveFile: "dialog.saveFile",
  shellOpenExternal: "shell.openExternal",
  clipboardWriteText: "clipboard.writeText",
  clipboardReadText: "clipboard.readText",
  menuSyncState: "menu.syncState",
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
  hostingRestoreAccounts: "hosting.restoreAccounts",
  hostingDeleteAccount: "hosting.deleteAccount",
  hostingExecute: "hosting.execute",
  localHistoryRepositoryService: "localHistory.repositoryService",
} as const;

export const DesktopRpcProcedureSchema = z.enum(RPC_PROCEDURES);
export type DesktopRpcProcedure = z.infer<typeof DesktopRpcProcedureSchema>;

export const DesktopRpcRequestSchema = z
  .object({
    procedure: DesktopRpcProcedureSchema,
    payload: z.unknown().optional(),
  })
  .strict()
  .readonly();

export type DesktopRpcRequest = Readonly<z.infer<typeof DesktopRpcRequestSchema>>;

const PROCEDURE_DOMAINS: Readonly<Record<DesktopRpcProcedure, DesktopRpcDomain>> = {
  [RPC_PROCEDURES.runtimeInfo]: "platform",
  [RPC_PROCEDURES.runtimeLauncherInfo]: "platform",
  [RPC_PROCEDURES.windowGetFullScreen]: "platform",
  [RPC_PROCEDURES.windowSetFullScreen]: "platform",
  [RPC_PROCEDURES.windowSetPresentationMode]: "platform",
  [RPC_PROCEDURES.maintenanceRelaunch]: "platform",
  [RPC_PROCEDURES.diagnosticsSnapshot]: "platform",
  [RPC_PROCEDURES.diagnosticsReveal]: "platform",
  [RPC_PROCEDURES.diagnosticsCollectLogs]: "platform",
  [RPC_PROCEDURES.diagnosticsDumpThreads]: "platform",
  [RPC_PROCEDURES.diagnosticsReadConfiguration]: "platform",
  [RPC_PROCEDURES.diagnosticsWriteConfiguration]: "platform",
  [RPC_PROCEDURES.diagnosticsKeyboardShortcutsPdf]: "platform",
  [RPC_PROCEDURES.diagnosticsListLeftoverDirectories]: "platform",
  [RPC_PROCEDURES.diagnosticsDeleteLeftoverDirectories]: "platform",
  [RPC_PROCEDURES.exportHtml]: "platform",
  [RPC_PROCEDURES.exportPatchText]: "platform",
  [RPC_PROCEDURES.analysisOpenOfflineInspection]: "platform",
  [RPC_PROCEDURES.settingsGet]: "platform",
  [RPC_PROCEDURES.settingsSet]: "platform",
  [RPC_PROCEDURES.settingsDelete]: "platform",
  [RPC_PROCEDURES.settingsExport]: "platform",
  [RPC_PROCEDURES.settingsImport]: "platform",
  [RPC_PROCEDURES.dialogOpenDirectory]: "platform",
  [RPC_PROCEDURES.dialogOpenFile]: "platform",
  [RPC_PROCEDURES.dialogSaveFile]: "platform",
  [RPC_PROCEDURES.shellOpenExternal]: "platform",
  [RPC_PROCEDURES.clipboardWriteText]: "platform",
  [RPC_PROCEDURES.clipboardReadText]: "platform",
  [RPC_PROCEDURES.menuSyncState]: "platform",
  [RPC_PROCEDURES.gitOpenRepository]: "git",
  [RPC_PROCEDURES.gitInitializeRepository]: "git",
  [RPC_PROCEDURES.gitCloneRepository]: "git",
  [RPC_PROCEDURES.gitCloseRepository]: "git",
  [RPC_PROCEDURES.gitInspectSnapshot]: "git",
  [RPC_PROCEDURES.gitRepositoryService]: "git",
  [RPC_PROCEDURES.gitQuery]: "git",
  [RPC_PROCEDURES.gitCancelQuery]: "git",
  [RPC_PROCEDURES.gitReadFile]: "git",
  [RPC_PROCEDURES.gitReadFilePreview]: "git",
  [RPC_PROCEDURES.gitWriteWorkingTreeFile]: "git",
  [RPC_PROCEDURES.gitOpenWorkingTreeFile]: "git",
  [RPC_PROCEDURES.gitWatchRepository]: "git",
  [RPC_PROCEDURES.gitUnwatchRepository]: "git",
  [RPC_PROCEDURES.terminalCreate]: "terminal",
  [RPC_PROCEDURES.terminalListLaunchTargets]: "terminal",
  [RPC_PROCEDURES.terminalWrite]: "terminal",
  [RPC_PROCEDURES.terminalResize]: "terminal",
  [RPC_PROCEDURES.terminalClose]: "terminal",
  [RPC_PROCEDURES.terminalCloseRepository]: "terminal",
  [RPC_PROCEDURES.hostingSaveAccount]: "hosting",
  [RPC_PROCEDURES.hostingRestoreAccounts]: "hosting",
  [RPC_PROCEDURES.hostingDeleteAccount]: "hosting",
  [RPC_PROCEDURES.hostingExecute]: "hosting",
  [RPC_PROCEDURES.localHistoryRepositoryService]: "localHistory",
};

export function desktopRpcDomain(procedure: DesktopRpcProcedure): DesktopRpcDomain {
  return PROCEDURE_DOMAINS[procedure];
}

export function desktopRpcChannel(procedure: DesktopRpcProcedure): string {
  return DESKTOP_RPC_CHANNELS[desktopRpcDomain(procedure)];
}
