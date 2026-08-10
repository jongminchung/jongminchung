import { lstat, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { strToU8, zipSync } from "fflate";
import type { RepositoryId } from "../../src/shared/contracts/git-utility";
import {
  ClipboardWriteRequestSchema,
  ClipboardTextSchema,
  CommandLineLauncherInfoSchema,
  DialogRequestSchema,
  DialogSelectionSchema,
  DiagnosticConfigurationKindSchema,
  DiagnosticConfigurationWriteRequestSchema,
  DiagnosticDeleteLeftoverDirectoriesRequestSchema,
  DiagnosticDeletedLeftoverDirectoryIdsSchema,
  DiagnosticLeftoverDirectoriesSchema,
  DiagnosticPathKindSchema,
  DiagnosticSnapshotSchema,
  ExternalUrlSchema,
  HtmlExportRequestSchema,
  IPC_CHANNELS,
  JsonValueSchema,
  MaintenanceRelaunchRequestSchema,
  NativeCommandStatesSchema,
  OfflineInspectionFilesSchema,
  PatchTextExportRequestSchema,
  RuntimeInfoSchema,
  SettingsDeleteRequestSchema,
  SettingsGetRequestSchema,
  SettingsSetRequestSchema,
  WindowPresentationModeSchema,
} from "../../src/shared/contracts/ipc";
import type { RuntimeInfo, WindowPresentationMode } from "../../src/shared/contracts/ipc";
import type { ElectronHostingFoundation } from "../hosting";
import type { DiagnosticsService } from "./diagnostics-service";
import { registerGitHandlers } from "./git-handlers";
import type { GitUtilityClient } from "./git-utility-client";
import { registerHostingHandlers } from "./hosting-handlers";
import { assertTrustedSender } from "./ipc-security";
import type { NativeMenuService } from "./menu-service";
import {
  ensureExportDirectory,
  escapeHtml,
  exportedHtml,
  exportedPath,
  htmlLink,
} from "./platform-export";
import { createRepositoryCapabilityAssertions } from "./repository-capabilities";
import { parseImportedSettings, SETTINGS_CREDENTIAL_PREFIX } from "./settings-archive";
import type { SettingsStore } from "./settings-store";
import { registerTerminalHandlers } from "./terminal-handlers";
import type { TerminalUtilityClient } from "./terminal-utility-client";

interface PlatformHandlerDependencies {
  readonly window: BrowserWindow;
  readonly settings: SettingsStore;
  readonly menu: NativeMenuService;
  readonly gitUtility: GitUtilityClient;
  readonly terminalUtility: TerminalUtilityClient;
  readonly hosting: ElectronHostingFoundation;
  readonly diagnostics?: DiagnosticsService;
  readonly runtime: RuntimeInfo;
  readonly localHistoryRepositoryFor?: (
    sender: IpcMainInvokeEvent["sender"],
  ) => RepositoryId | null;
  readonly onWindowPresentationModeChange?: (mode: WindowPresentationMode) => void;
}

export function registerPlatformHandlers(dependencies: PlatformHandlerDependencies): void {
  const {
    window,
    settings,
    menu,
    gitUtility,
    terminalUtility,
    hosting,
    diagnostics: providedDiagnostics,
    runtime,
    localHistoryRepositoryFor,
    onWindowPresentationModeChange,
  } = dependencies;
  const repositoryPaths = new Map<string, string>();
  const repositoryAccessModes = new Map<string, "trusted" | "safe">();
  const { assertRepositoryCapability, assertActiveCapability } =
    createRepositoryCapabilityAssertions({
      settings,
      repositoryPaths,
      repositoryAccessModes,
    });

  ipcMain.handle(IPC_CHANNELS.runtimeInfo, (event) => {
    assertTrustedSender(event, window);
    return RuntimeInfoSchema.parse(runtime);
  });
  ipcMain.handle(IPC_CHANNELS.runtimeLauncherInfo, (event) => {
    assertTrustedSender(event, window);
    return CommandLineLauncherInfoSchema.parse({
      directory: dirname(process.execPath),
      command: basename(process.execPath),
    });
  });
  ipcMain.handle(IPC_CHANNELS.windowGetFullScreen, (event): boolean => {
    assertTrustedSender(event, window);
    return window.isFullScreen();
  });
  ipcMain.handle(IPC_CHANNELS.windowSetFullScreen, (event, raw: unknown): void => {
    assertTrustedSender(event, window);
    if (typeof raw !== "boolean") throw new Error("Full-screen state must be a boolean.");
    window.setFullScreen(raw);
  });
  ipcMain.handle(IPC_CHANNELS.windowSetPresentationMode, (event, raw: unknown): void => {
    assertTrustedSender(event, window);
    const mode = WindowPresentationModeSchema.parse(raw);
    onWindowPresentationModeChange?.(mode);
    const bounds =
      mode === "welcome"
        ? { width: 800, height: 650, minWidth: 800, minHeight: 650 }
        : {
            width: 1184,
            height: 768,
            minWidth: 960,
            minHeight: 640,
          };
    window.setMinimumSize(bounds.minWidth, bounds.minHeight);
    const [width = 0, height = 0] = window.getSize();
    if (mode === "welcome" || width < bounds.minWidth || height < bounds.minHeight) {
      window.setSize(bounds.width, bounds.height, true);
      window.center();
    }
  });
  ipcMain.handle(IPC_CHANNELS.maintenanceRelaunch, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    const request = MaintenanceRelaunchRequestSchema.parse(raw);
    if (request.invalidateCaches) {
      await window.webContents.session.clearCache();
    }
    app.relaunch();
    app.exit(0);
  });
  if (providedDiagnostics !== undefined) {
    const diagnostics = providedDiagnostics;
    ipcMain.handle(IPC_CHANNELS.diagnosticsSnapshot, async (event) => {
      assertTrustedSender(event, window);
      return DiagnosticSnapshotSchema.parse(await diagnostics.snapshot());
    });
    ipcMain.handle(IPC_CHANNELS.diagnosticsReveal, async (event, raw: unknown): Promise<void> => {
      assertTrustedSender(event, window);
      const kind = DiagnosticPathKindSchema.parse(raw);
      const path = await diagnostics.preparePath(kind);
      const metadata = await lstat(path);
      if (metadata.isSymbolicLink()) {
        throw new Error("Diagnostic paths cannot be symbolic links.");
      }
      if (metadata.isFile()) {
        shell.showItemInFolder(path);
        return;
      }
      if (!metadata.isDirectory()) {
        throw new Error("Diagnostic target must be a file or directory.");
      }
      const error = await shell.openPath(path);
      if (error) throw new Error(error);
    });
    ipcMain.handle(IPC_CHANNELS.diagnosticsCollectLogs, async (event): Promise<boolean> => {
      assertTrustedSender(event, window);
      const selection = await dialog.showSaveDialog(window, {
        title: "Collect Logs and Diagnostic Data",
        defaultPath: `git-client-diagnostics-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: "ZIP archive", extensions: ["zip"] }],
      });
      if (selection.canceled || selection.filePath === undefined) {
        return false;
      }
      const parent = await realpath(dirname(selection.filePath));
      const target = resolve(parent, basename(selection.filePath));
      try {
        const metadata = await lstat(target);
        if (metadata.isSymbolicLink() || !metadata.isFile()) {
          throw new Error("Diagnostic export refuses symbolic-link and non-file targets.");
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
      await writeFile(target, await diagnostics.createLogArchive(settings.createSnapshot()), {
        mode: 0o600,
      });
      return true;
    });
    ipcMain.handle(IPC_CHANNELS.diagnosticsDumpThreads, async (event): Promise<string> => {
      assertTrustedSender(event, window);
      const path = await diagnostics.dumpThreads();
      shell.showItemInFolder(path);
      return path;
    });
    ipcMain.handle(
      IPC_CHANNELS.diagnosticsReadConfiguration,
      async (event, raw: unknown): Promise<string> => {
        assertTrustedSender(event, window);
        return diagnostics.readConfiguration(DiagnosticConfigurationKindSchema.parse(raw));
      },
    );
    ipcMain.handle(
      IPC_CHANNELS.diagnosticsWriteConfiguration,
      async (event, raw: unknown): Promise<void> => {
        assertTrustedSender(event, window);
        const request = DiagnosticConfigurationWriteRequestSchema.parse(raw);
        await diagnostics.writeConfiguration(request.kind, request.content);
      },
    );
    ipcMain.handle(IPC_CHANNELS.diagnosticsKeyboardShortcutsPdf, async (event): Promise<void> => {
      assertTrustedSender(event, window);
      const path = await diagnostics.createKeyboardShortcutsPdf();
      const error = await shell.openPath(path);
      if (error) throw new Error(error);
    });
    ipcMain.handle(IPC_CHANNELS.diagnosticsListLeftoverDirectories, async (event) => {
      assertTrustedSender(event, window);
      return DiagnosticLeftoverDirectoriesSchema.parse(await diagnostics.listLeftoverDirectories());
    });
    ipcMain.handle(
      IPC_CHANNELS.diagnosticsDeleteLeftoverDirectories,
      async (event, raw: unknown) => {
        assertTrustedSender(event, window);
        const request = DiagnosticDeleteLeftoverDirectoriesRequestSchema.parse(raw);
        return DiagnosticDeletedLeftoverDirectoryIdsSchema.parse(
          await diagnostics.deleteLeftoverDirectories(request.ids),
        );
      },
    );
  }
  ipcMain.handle(IPC_CHANNELS.exportHtml, async (event, raw: unknown): Promise<boolean> => {
    assertTrustedSender(event, window);
    const request = HtmlExportRequestSchema.parse(raw);
    const selection = await dialog.showOpenDialog(window, {
      title: "Select Output Directory",
      message: "HTML files will be exported to this directory",
      properties: ["openDirectory", "createDirectory"],
    });
    const outputDirectory = selection.filePaths[0];
    if (selection.canceled || outputDirectory === undefined) return false;
    const canonicalRoot = await realpath(outputDirectory);
    const outputs: string[] = [];
    for (const file of request.files) {
      const relativeTarget = exportedPath(file.path);
      const parent = await ensureExportDirectory(
        canonicalRoot,
        dirname(relativeTarget) === "." ? "" : dirname(relativeTarget),
      );
      const target = resolve(parent, relativeTarget.split("/").at(-1) ?? "export.html");
      try {
        const metadata = await lstat(target);
        if (metadata.isSymbolicLink() || !metadata.isFile()) {
          throw new Error("HTML export refuses symbolic-link and non-file targets.");
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await writeFile(target, exportedHtml(file.path, file.content, request.includeLineNumbers), {
        encoding: "utf8",
        mode: 0o600,
      });
      outputs.push(target);
    }
    let pathToOpen = outputs[0];
    if (request.files.length > 1) {
      const links = request.files
        .map((file) => {
          const href = htmlLink(exportedPath(file.path));
          return `<li><a href="${escapeHtml(href)}">${escapeHtml(file.path)}</a></li>`;
        })
        .join("");
      pathToOpen = resolve(canonicalRoot, "index.html");
      await writeFile(
        pathToOpen,
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Exported Project Files</title></head><body><h1>Exported Project Files</h1><ul>${links}</ul></body></html>`,
        { encoding: "utf8", mode: 0o600 },
      );
    }
    if (request.openInBrowser && pathToOpen !== undefined) {
      await shell.openPath(pathToOpen);
    }
    return true;
  });
  ipcMain.handle(IPC_CHANNELS.analysisOpenOfflineInspection, async (event) => {
    assertTrustedSender(event, window);
    const selection = await dialog.showOpenDialog(window, {
      title: "Select Path",
      message: "Select directory which contains exported inspection results",
      filters: [{ name: "Inspection Results", extensions: ["xml"] }],
      properties: ["openFile", "openDirectory"],
    });
    const selectedPath = selection.filePaths[0];
    if (selection.canceled || selectedPath === undefined) return null;
    const metadata = await lstat(selectedPath);
    if (metadata.isSymbolicLink()) {
      throw new Error("Offline inspection import refuses symbolic links.");
    }
    if (!metadata.isFile() && !metadata.isDirectory()) {
      throw new Error("Offline inspection results must be an XML file or directory.");
    }
    if (metadata.isFile() && extname(selectedPath).toLocaleLowerCase() !== ".xml") {
      throw new Error("Offline inspection results must use the .xml extension.");
    }
    const candidates = metadata.isDirectory()
      ? (
          await readdir(await realpath(selectedPath), {
            withFileTypes: true,
          })
        )
          .filter((entry) => entry.isFile() && extname(entry.name).toLocaleLowerCase() === ".xml")
          .slice(0, 100)
          .map((entry) => join(selectedPath, entry.name))
      : [selectedPath];
    const files: Array<{
      readonly name: string;
      readonly content: string;
    }> = [];
    let totalBytes = 0;
    for (const path of candidates) {
      const fileMetadata = await lstat(path);
      if (fileMetadata.isSymbolicLink() || !fileMetadata.isFile()) continue;
      if (fileMetadata.size > 5_242_880) {
        throw new Error(`${basename(path)} is larger than 5 MiB.`);
      }
      totalBytes += fileMetadata.size;
      if (totalBytes > 20_971_520) {
        throw new Error("Offline inspection results exceed 20 MiB.");
      }
      files.push({
        name: basename(path),
        content: await readFile(path, "utf8"),
      });
    }
    return OfflineInspectionFilesSchema.parse(files);
  });
  ipcMain.handle(IPC_CHANNELS.exportPatchText, async (event, raw: unknown): Promise<boolean> => {
    assertTrustedSender(event, window);
    const request = PatchTextExportRequestSchema.parse(raw);
    const selection = await dialog.showSaveDialog(window, {
      title: "Create Patch from Local Changes",
      defaultPath: request.defaultName,
      filters: [{ name: "Git patch", extensions: ["patch", "diff"] }],
    });
    if (selection.canceled || !selection.filePath) return false;
    const canonicalParent = await realpath(dirname(selection.filePath));
    const target = resolve(canonicalParent, basename(selection.filePath));
    try {
      const metadata = await lstat(target);
      if (metadata.isSymbolicLink() || !metadata.isFile()) {
        throw new Error("Patch export refuses symbolic-link and non-file targets.");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await writeFile(target, request.content, {
      encoding: "utf8",
      mode: 0o600,
    });
    return true;
  });
  ipcMain.handle(IPC_CHANNELS.settingsGet, (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = SettingsGetRequestSchema.parse(raw);
    return settings.get(request.key);
  });
  ipcMain.handle(IPC_CHANNELS.settingsSet, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    const request = SettingsSetRequestSchema.parse(raw);
    await settings.set(request.key, JsonValueSchema.parse(request.value));
  });
  ipcMain.handle(IPC_CHANNELS.settingsDelete, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    const request = SettingsDeleteRequestSchema.parse(raw);
    await settings.delete(request.key);
  });
  ipcMain.handle(IPC_CHANNELS.settingsExport, async (event): Promise<boolean> => {
    assertTrustedSender(event, window);
    const selection = await dialog.showSaveDialog(window, {
      title: "Export Settings",
      defaultPath: "git-client-settings.zip",
      filters: [{ name: "Settings Archive", extensions: ["zip"] }],
    });
    if (selection.canceled || !selection.filePath) return false;
    const values = Object.fromEntries(
      Object.entries(settings.createSnapshot()).filter(
        ([key]) => !key.startsWith(SETTINGS_CREDENTIAL_PREFIX),
      ),
    );
    const payload = strToU8(
      JSON.stringify({
        format: "git-client-settings",
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        values,
      }),
    );
    const archive = zipSync({ "settings.json": payload }, { level: 6 });
    await writeFile(selection.filePath, archive, { mode: 0o600 });
    return true;
  });
  ipcMain.handle(IPC_CHANNELS.settingsImport, async (event): Promise<boolean> => {
    assertTrustedSender(event, window);
    const selection = await dialog.showOpenDialog(window, {
      title: "Import Settings",
      filters: [{ name: "Settings Archive", extensions: ["zip"] }],
      properties: ["openFile"],
    });
    if (selection.canceled || !selection.filePaths[0]) return false;
    const imported = parseImportedSettings(await readFile(selection.filePaths[0]));
    const credentials = Object.fromEntries(
      Object.entries(settings.createSnapshot()).filter(([key]) =>
        key.startsWith(SETTINGS_CREDENTIAL_PREFIX),
      ),
    );
    await settings.replace({ ...imported, ...credentials });
    return true;
  });
  ipcMain.handle(IPC_CHANNELS.dialogOpenDirectory, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = DialogRequestSchema.parse(raw);
    const result = await dialog.showOpenDialog(window, {
      title: request.title,
      defaultPath: request.defaultPath ?? undefined,
      properties: ["openDirectory", "createDirectory"],
    });
    return DialogSelectionSchema.parse(result.canceled ? null : (result.filePaths[0] ?? null));
  });
  ipcMain.handle(IPC_CHANNELS.dialogOpenFile, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = DialogRequestSchema.parse(raw);
    const result = await dialog.showOpenDialog(window, {
      title: request.title,
      defaultPath: request.defaultPath ?? undefined,
      filters: request.filters,
      properties: ["openFile"],
    });
    return DialogSelectionSchema.parse(result.canceled ? null : (result.filePaths[0] ?? null));
  });
  ipcMain.handle(IPC_CHANNELS.dialogSaveFile, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = DialogRequestSchema.parse(raw);
    const result = await dialog.showSaveDialog(window, {
      title: request.title,
      defaultPath: request.defaultPath ?? undefined,
      filters: request.filters,
    });
    return DialogSelectionSchema.parse(result.canceled ? null : (result.filePath ?? null));
  });
  ipcMain.handle(IPC_CHANNELS.shellOpenExternal, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    const url = ExternalUrlSchema.parse(raw);
    await shell.openExternal(url, { activate: true });
  });
  ipcMain.handle(IPC_CHANNELS.clipboardWriteText, (event, raw: unknown): void => {
    assertTrustedSender(event, window);
    const request = ClipboardWriteRequestSchema.parse(raw);
    clipboard.writeText(request.text);
  });
  ipcMain.handle(IPC_CHANNELS.clipboardReadText, (event): string => {
    assertTrustedSender(event, window);
    return ClipboardTextSchema.parse(clipboard.readText());
  });
  ipcMain.handle(IPC_CHANNELS.menuSyncState, (event, raw: unknown): void => {
    assertTrustedSender(event, window);
    menu.sync(NativeCommandStatesSchema.parse(raw));
  });
  registerGitHandlers({
    window,
    settings,
    gitUtility,
    terminalUtility,
    repositoryPaths,
    repositoryAccessModes,
    assertRepositoryCapability,
    assertActiveCapability,
    localHistoryRepositoryFor,
  });
  registerTerminalHandlers({
    window,
    terminalUtility,
    repositoryPaths,
    assertRepositoryCapability,
    assertActiveCapability,
  });
  registerHostingHandlers({ window, hosting, assertActiveCapability });
}

export function unregisterPlatformHandlers(): void {
  for (const channel of [
    IPC_CHANNELS.runtimeInfo,
    IPC_CHANNELS.runtimeLauncherInfo,
    IPC_CHANNELS.windowGetFullScreen,
    IPC_CHANNELS.windowSetFullScreen,
    IPC_CHANNELS.windowSetPresentationMode,
    IPC_CHANNELS.maintenanceRelaunch,
    IPC_CHANNELS.diagnosticsSnapshot,
    IPC_CHANNELS.diagnosticsReveal,
    IPC_CHANNELS.diagnosticsCollectLogs,
    IPC_CHANNELS.diagnosticsDumpThreads,
    IPC_CHANNELS.diagnosticsReadConfiguration,
    IPC_CHANNELS.diagnosticsWriteConfiguration,
    IPC_CHANNELS.diagnosticsKeyboardShortcutsPdf,
    IPC_CHANNELS.diagnosticsListLeftoverDirectories,
    IPC_CHANNELS.diagnosticsDeleteLeftoverDirectories,
    IPC_CHANNELS.exportHtml,
    IPC_CHANNELS.exportPatchText,
    IPC_CHANNELS.analysisOpenOfflineInspection,
    IPC_CHANNELS.settingsGet,
    IPC_CHANNELS.settingsSet,
    IPC_CHANNELS.settingsDelete,
    IPC_CHANNELS.settingsExport,
    IPC_CHANNELS.settingsImport,
    IPC_CHANNELS.dialogOpenDirectory,
    IPC_CHANNELS.dialogOpenFile,
    IPC_CHANNELS.dialogSaveFile,
    IPC_CHANNELS.shellOpenExternal,
    IPC_CHANNELS.clipboardWriteText,
    IPC_CHANNELS.clipboardReadText,
    IPC_CHANNELS.menuSyncState,
    IPC_CHANNELS.gitOpenRepository,
    IPC_CHANNELS.gitInitializeRepository,
    IPC_CHANNELS.gitCloneRepository,
    IPC_CHANNELS.gitCloseRepository,
    IPC_CHANNELS.gitInspectSnapshot,
    IPC_CHANNELS.gitRepositoryService,
    IPC_CHANNELS.localHistoryRepositoryService,
    IPC_CHANNELS.gitQuery,
    IPC_CHANNELS.gitCancelQuery,
    IPC_CHANNELS.gitReadFile,
    IPC_CHANNELS.gitReadFilePreview,
    IPC_CHANNELS.gitWriteWorkingTreeFile,
    IPC_CHANNELS.gitOpenWorkingTreeFile,
    IPC_CHANNELS.gitWatchRepository,
    IPC_CHANNELS.gitUnwatchRepository,
    IPC_CHANNELS.terminalCreate,
    IPC_CHANNELS.terminalListLaunchTargets,
    IPC_CHANNELS.terminalWrite,
    IPC_CHANNELS.terminalResize,
    IPC_CHANNELS.terminalClose,
    IPC_CHANNELS.terminalCloseRepository,
    IPC_CHANNELS.hostingSaveAccount,
    IPC_CHANNELS.hostingRestoreAccounts,
    IPC_CHANNELS.hostingDeleteAccount,
    IPC_CHANNELS.hostingExecute,
  ]) {
    ipcMain.removeHandler(channel);
  }
}
