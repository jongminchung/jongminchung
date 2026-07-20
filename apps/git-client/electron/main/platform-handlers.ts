import { lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  GitCloneRepositoryRequestSchema,
  GitCreationEventSchema,
  GitInitializeRepositoryRequestSchema,
  FileContentSchema,
  FilePreviewSchema,
  GitReadFileRequestSchema,
  GitRepositoryServiceRequestSchema,
  GitRepositoryServiceResultSchema,
  GitExecutionRequestSchema,
  GitRequestEventSchema,
  OpenRepositoryRequestSchema,
  GitWatchRepositoryRequestSchema,
  GitWorkingTreeFileRequestSchema,
  GitWriteWorkingTreeFileRequestSchema,
  RepositoryChangedEventSchema,
  RepositoryRecordSchema,
  RepositorySnapshotSchema,
} from "../../src/shared/contracts/git-utility";
import type {
  GitCreationEventListener,
  GitCreationTerminalEvent,
  GitTerminalEvent,
  RepositoryRecord,
} from "../../src/shared/contracts/git-utility";
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
  GitCancelQueryRequestSchema,
  GitCloseRepositoryRequestSchema,
  GitRepositoryRequestSchema,
  GitTerminalResultSchema,
  HtmlExportRequestSchema,
  HostingDeleteAccountRequestSchema,
  HostingExecuteRequestSchema,
  HostingRestoreAccountsRequestSchema,
  HostingSaveAccountRequestSchema,
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
import type {
  JsonValue,
  RuntimeInfo,
  WindowPresentationMode,
} from "../../src/shared/contracts/ipc";
import {
  TerminalCloseRepositoryRequestSchema,
  TerminalCloseRequestSchema,
  TerminalCreateRequestSchema,
  TerminalCreateResultSchema,
  TerminalEventEnvelopeSchema,
  TerminalLaunchTargetsSchema,
  TerminalListLaunchTargetsRequestSchema,
  TerminalResizeRequestSchema,
  TerminalWriteRequestSchema,
} from "../../src/shared/contracts/terminal";
import {
  HostingAccountSchema,
  HostingResponseKindByRequest,
  HostingResponseSchema,
  type ElectronHostingFoundation,
} from "../hosting";
import { safeHostingErrorMessage } from "../hosting/hosting-redaction";
import type { DiagnosticsService } from "./diagnostics-service";
import type { GitUtilityClient } from "./git-utility-client";
import type { NativeMenuService } from "./menu-service";
import type { SettingsStore } from "./settings-store";
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
  readonly onWindowPresentationModeChange?: (mode: WindowPresentationMode) => void;
}

const SETTINGS_ARCHIVE_MAX_BYTES = 1_048_576;
const SETTINGS_ARCHIVE_MAX_EXPANDED_BYTES = 4_194_304;
const SETTINGS_CREDENTIAL_PREFIX = "hostingCredential:";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function exportedHtml(path: string, content: string, lineNumbers: boolean): string {
  const lines = content.split("\n");
  const body = lineNumbers
    ? lines
        .map(
          (line, index) =>
            `<span class="line"><span class="number">${index + 1}</span><span class="source">${escapeHtml(line)}</span></span>`,
        )
        .join("\n")
    : escapeHtml(content);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(path)}</title><style>
:root{color-scheme:light dark}body{margin:0;background:#1e1f22;color:#bcbec4;font:13px/1.55 "JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace}header{position:sticky;top:0;padding:9px 14px;background:#2b2d30;border-bottom:1px solid #393b40;color:#dfe1e5}pre{margin:0;padding:12px 0;tab-size:4}.line{display:grid;grid-template-columns:52px minmax(0,1fr);min-height:20px}.number{box-sizing:border-box;padding-right:12px;color:#6f737a;text-align:right;user-select:none}.source{padding-right:16px;white-space:pre-wrap}@media(prefers-color-scheme:light){body{background:#fff;color:#1f2328}header{background:#f2f3f5;border-color:#d8dadd}.number{color:#8c8f94}}</style></head>
<body><header>${escapeHtml(path)}</header><pre>${body}</pre></body></html>`;
}

function exportedPath(path: string): string {
  return `${path}.html`;
}

async function ensureExportDirectory(
  canonicalRoot: string,
  relativeDirectory: string,
): Promise<string> {
  let current = canonicalRoot;
  for (const segment of relativeDirectory.split("/").filter(Boolean)) {
    current = resolve(current, segment);
    const relation = relative(canonicalRoot, current);
    if (relation.startsWith("..") || relation === "") {
      throw new Error("HTML export path escaped the selected directory.");
    }
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw new Error("HTML export refuses symbolic-link and non-directory parents.");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await mkdir(current, { mode: 0o700 });
    }
  }
  return current;
}

function htmlLink(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function validateSettingsArchiveEnvelope(bytes: Uint8Array): void {
  if (bytes.byteLength > SETTINGS_ARCHIVE_MAX_BYTES) {
    throw new Error("Settings archive is larger than 1 MiB.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const searchStart = Math.max(0, bytes.byteLength - 65_557);
  let end = -1;
  for (let offset = bytes.byteLength - 22; offset >= searchStart; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new Error("Settings archive is not a valid ZIP file.");
  const entryCount = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true);
  const directoryEnd = offset + directorySize;
  if (entryCount !== 1 || directoryEnd > end) {
    throw new Error("Settings archive must contain exactly settings.json.");
  }
  let expandedBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > directoryEnd || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("Settings archive directory is invalid.");
    }
    expandedBytes += view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > directoryEnd) {
      throw new Error("Settings archive entry name is invalid.");
    }
    if (strFromU8(bytes.subarray(nameStart, nameEnd)) !== "settings.json") {
      throw new Error("Settings archive contains an unexpected entry.");
    }
    offset = nameEnd + extraLength + commentLength;
  }
  if (expandedBytes > SETTINGS_ARCHIVE_MAX_EXPANDED_BYTES || offset !== directoryEnd) {
    throw new Error("Settings archive expands beyond the allowed size.");
  }
}

function parseImportedSettings(bytes: Uint8Array): Readonly<Record<string, JsonValue>> {
  validateSettingsArchiveEnvelope(bytes);
  const entry = unzipSync(bytes)["settings.json"];
  if (entry === undefined) throw new Error("settings.json is missing from the archive.");
  const raw = JSON.parse(strFromU8(entry)) as unknown;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Imported settings are invalid.");
  }
  if (
    Reflect.get(raw, "format") !== "git-client-settings" ||
    Reflect.get(raw, "schemaVersion") !== 1
  ) {
    throw new Error("Imported settings use an unsupported format.");
  }
  const rawValues = Reflect.get(raw, "values");
  if (typeof rawValues !== "object" || rawValues === null || Array.isArray(rawValues)) {
    throw new Error("Imported settings values are invalid.");
  }
  return Object.fromEntries(
    Object.entries(rawValues).flatMap(([key, value]) =>
      key.startsWith(SETTINGS_CREDENTIAL_PREFIX)
        ? []
        : [[key, JsonValueSchema.parse(value)] as const],
    ),
  );
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
    onWindowPresentationModeChange,
  } = dependencies;
  const repositoryPaths = new Map<string, string>();
  const creationListener: GitCreationEventListener = (creationEvent) => {
    if (window.isDestroyed() || window.webContents.isDestroyed()) return;
    window.webContents.send(
      IPC_CHANNELS.gitCreationEvent,
      GitCreationEventSchema.parse(creationEvent),
    );
  };
  const createdRepository = (terminal: GitCreationTerminalEvent): RepositoryRecord => {
    if (terminal.kind === "completed") return terminal.repository;
    if (terminal.kind === "failed") throw new Error(terminal.message);
    throw new Error("Repository creation was cancelled");
  };

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
  ipcMain.handle(
    IPC_CHANNELS.gitOpenRepository,
    async (event, raw: unknown): Promise<RepositoryRecord> => {
      assertTrustedSender(event, window);
      const request = OpenRepositoryRequestSchema.parse(raw);
      const repository = await gitUtility.openRepository(request.path);
      repositoryPaths.set(repository.id, repository.path);
      return RepositoryRecordSchema.parse(repository);
    },
  );
  ipcMain.handle(
    IPC_CHANNELS.gitInitializeRepository,
    async (event, raw: unknown): Promise<RepositoryRecord> => {
      assertTrustedSender(event, window);
      const request = GitInitializeRepositoryRequestSchema.parse(raw);
      const terminal = await gitUtility.initializeRepository(request, creationListener);
      const repository = RepositoryRecordSchema.parse(createdRepository(terminal));
      repositoryPaths.set(repository.id, repository.path);
      return repository;
    },
  );
  ipcMain.handle(
    IPC_CHANNELS.gitCloneRepository,
    async (event, raw: unknown): Promise<RepositoryRecord> => {
      assertTrustedSender(event, window);
      const request = GitCloneRepositoryRequestSchema.parse(raw);
      const terminal = await gitUtility.cloneRepository(request, creationListener);
      const repository = RepositoryRecordSchema.parse(createdRepository(terminal));
      repositoryPaths.set(repository.id, repository.path);
      return repository;
    },
  );
  ipcMain.handle(IPC_CHANNELS.gitCloseRepository, async (event, raw: unknown): Promise<boolean> => {
    assertTrustedSender(event, window);
    const request = GitCloseRepositoryRequestSchema.parse(raw);
    await terminalUtility.closeRepository(request);
    const closed = await gitUtility.closeRepository(request.repositoryId);
    repositoryPaths.delete(request.repositoryId);
    return closed;
  });
  ipcMain.handle(IPC_CHANNELS.gitInspectSnapshot, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = GitRepositoryRequestSchema.parse(raw);
    return RepositorySnapshotSchema.parse(await gitUtility.inspectSnapshot(request.repositoryId));
  });
  ipcMain.handle(IPC_CHANNELS.gitRepositoryService, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = GitRepositoryServiceRequestSchema.parse(raw);
    return GitRepositoryServiceResultSchema.parse(
      await gitUtility.executeRepositoryService(request),
    );
  });
  ipcMain.handle(IPC_CHANNELS.gitQuery, async (event, raw: unknown): Promise<GitTerminalEvent> => {
    assertTrustedSender(event, window);
    const request = GitExecutionRequestSchema.parse(raw);
    const terminal = await gitUtility.executeQuery(request, (gitEvent) => {
      if (window.isDestroyed() || window.webContents.isDestroyed()) return;
      window.webContents.send(IPC_CHANNELS.gitQueryEvent, GitRequestEventSchema.parse(gitEvent));
    });
    return GitTerminalResultSchema.parse(terminal);
  });
  ipcMain.handle(IPC_CHANNELS.gitCancelQuery, async (event, raw: unknown): Promise<boolean> => {
    assertTrustedSender(event, window);
    const request = GitCancelQueryRequestSchema.parse(raw);
    return gitUtility.cancelQuery(request.requestId);
  });
  ipcMain.handle(IPC_CHANNELS.gitReadFile, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = GitReadFileRequestSchema.parse(raw);
    return FileContentSchema.parse(
      await gitUtility.readFile(request.repositoryId, request.source, request.path),
    );
  });
  ipcMain.handle(IPC_CHANNELS.gitReadFilePreview, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = GitReadFileRequestSchema.parse(raw);
    return FilePreviewSchema.parse(
      await gitUtility.readFilePreview(request.repositoryId, request.source, request.path),
    );
  });
  ipcMain.handle(
    IPC_CHANNELS.gitWriteWorkingTreeFile,
    async (event, raw: unknown): Promise<void> => {
      assertTrustedSender(event, window);
      const request = GitWriteWorkingTreeFileRequestSchema.parse(raw);
      await gitUtility.writeWorkingTreeFile(
        request.repositoryId,
        request.path,
        request.content,
        request.activityName ?? undefined,
      );
    },
  );
  ipcMain.handle(
    IPC_CHANNELS.gitOpenWorkingTreeFile,
    async (event, raw: unknown): Promise<void> => {
      assertTrustedSender(event, window);
      const request = GitWorkingTreeFileRequestSchema.parse(raw);
      const canonicalPath = await gitUtility.resolveWorkingTreeFile(
        request.repositoryId,
        request.path,
      );
      const error = await shell.openPath(canonicalPath);
      if (error.length > 0) {
        throw new Error(`Could not open working-tree file: ${error}`);
      }
    },
  );
  ipcMain.handle(IPC_CHANNELS.gitWatchRepository, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    const request = GitWatchRepositoryRequestSchema.parse(raw);
    await gitUtility.watchRepository(request.repositoryId, (repositoryEvent) => {
      if (window.isDestroyed() || window.webContents.isDestroyed()) return;
      window.webContents.send(
        IPC_CHANNELS.gitRepositoryChanged,
        RepositoryChangedEventSchema.parse(repositoryEvent),
      );
    });
  });
  ipcMain.handle(IPC_CHANNELS.gitUnwatchRepository, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    const request = GitWatchRepositoryRequestSchema.parse(raw);
    await gitUtility.unwatchRepository(request.repositoryId);
  });
  ipcMain.handle(IPC_CHANNELS.terminalCreate, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = TerminalCreateRequestSchema.parse(raw);
    const cwd = repositoryPaths.get(request.repositoryId);
    if (cwd === undefined) throw new Error("Repository is not open for terminal access");
    const result = await terminalUtility.create({ ...request, cwd }, (terminalEvent) => {
      if (window.isDestroyed() || window.webContents.isDestroyed()) return;
      window.webContents.send(
        IPC_CHANNELS.terminalEvent,
        TerminalEventEnvelopeSchema.parse(terminalEvent),
      );
    });
    return TerminalCreateResultSchema.parse(result);
  });
  ipcMain.handle(IPC_CHANNELS.terminalListLaunchTargets, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    TerminalListLaunchTargetsRequestSchema.parse(raw);
    return TerminalLaunchTargetsSchema.parse(await terminalUtility.listLaunchTargets());
  });
  ipcMain.handle(IPC_CHANNELS.terminalWrite, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    await terminalUtility.write(TerminalWriteRequestSchema.parse(raw));
  });
  ipcMain.handle(IPC_CHANNELS.terminalResize, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    await terminalUtility.resize(TerminalResizeRequestSchema.parse(raw));
  });
  ipcMain.handle(IPC_CHANNELS.terminalClose, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    await terminalUtility.close(TerminalCloseRequestSchema.parse(raw));
  });
  ipcMain.handle(
    IPC_CHANNELS.terminalCloseRepository,
    async (event, raw: unknown): Promise<void> => {
      assertTrustedSender(event, window);
      await terminalUtility.closeRepository(TerminalCloseRepositoryRequestSchema.parse(raw));
    },
  );
  ipcMain.handle(IPC_CHANNELS.hostingSaveAccount, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const token = hostingToken(raw);
    try {
      const request = HostingSaveAccountRequestSchema.parse(raw);
      return HostingAccountSchema.parse(
        await hosting.saveAccount(request.provider, request.baseUrl, request.token),
      );
    } catch (error) {
      throw hostingIpcError(error, token === null ? [] : [token]);
    }
  });
  ipcMain.handle(IPC_CHANNELS.hostingRestoreAccounts, (event, raw: unknown): void => {
    assertTrustedSender(event, window);
    try {
      const request = HostingRestoreAccountsRequestSchema.parse(raw);
      hosting.restoreAccounts(request.accounts);
    } catch (error) {
      throw hostingIpcError(error);
    }
  });
  ipcMain.handle(IPC_CHANNELS.hostingDeleteAccount, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    try {
      const request = HostingDeleteAccountRequestSchema.parse(raw);
      await hosting.deleteAccount(request.accountId);
    } catch (error) {
      throw hostingIpcError(error);
    }
  });
  ipcMain.handle(IPC_CHANNELS.hostingExecute, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    try {
      const request = HostingExecuteRequestSchema.parse(raw);
      const response = HostingResponseSchema.parse(
        await hosting.execute(request.accountId, request.request),
      );
      if (response.kind !== HostingResponseKindByRequest[request.request.kind]) {
        throw new Error("Hosting response did not match its request");
      }
      return response;
    } catch (error) {
      throw hostingIpcError(error);
    }
  });
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

function hostingToken(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const token = Reflect.get(raw, "token");
  return typeof token === "string" && token.length <= 16_384 ? token : null;
}

function hostingIpcError(error: unknown, secrets: readonly string[] = []): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(safeHostingErrorMessage(message, secrets));
}

function assertTrustedSender(event: IpcMainInvokeEvent, window: BrowserWindow): void {
  const senderWindow =
    event.sender === window.webContents ? window : BrowserWindow.fromWebContents(event.sender);
  if (
    senderWindow === null ||
    (senderWindow !== window && senderWindow.getParentWindow() !== window)
  ) {
    throw new Error("IPC sender is not the main window.");
  }
  if (event.senderFrame !== senderWindow.webContents.mainFrame) {
    throw new Error("IPC sender is not the main frame.");
  }
  const frameUrl = event.senderFrame?.url ?? "";
  const isProduction = frameUrl.startsWith("app://git-client/");
  const isDevelopment = /^http:\/\/(127\.0\.0\.1|localhost):\d+\//u.test(frameUrl);
  if (!isProduction && !isDevelopment) throw new Error("IPC sender origin is not trusted.");
}
