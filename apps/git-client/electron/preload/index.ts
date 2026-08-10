import { contextBridge, ipcRenderer } from "electron";
import { z } from "zod";
import { QA_FIXTURE_RENDERER_ARGUMENT } from "../../src/shared/contracts/ipc";
import type {
  DesktopApi,
  JsonValue,
  NativeCommand,
  NativeCommandState,
} from "../../src/shared/contracts/ipc";
import {
  DialogSelectionSchema,
  ClipboardTextSchema,
  CommandLineLauncherInfoSchema,
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
  NativeCommandSchema,
  OfflineInspectionFilesSchema,
  PatchTextExportRequestSchema,
  RuntimeInfoSchema,
  WindowPresentationModeSchema,
} from "../../src/shared/contracts/ipc";
import { createGitApi } from "./git-api";
import { createHostingApi } from "./hosting-api";
import { createTerminalApi } from "./terminal-api";

const BooleanResultSchema = z.boolean();
const DiagnosticConfigurationTextSchema = z.string().max(1_048_576);
const DiagnosticPathResultSchema = z.string().min(1).max(32_768);

const api: DesktopApi = {
  runtime: {
    qaFixture: process.argv.includes(QA_FIXTURE_RENDERER_ARGUMENT),
    async getInfo() {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.runtimeInfo);
      return RuntimeInfoSchema.parse(raw);
    },
    async getCommandLineLauncherInfo() {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.runtimeLauncherInfo);
      return CommandLineLauncherInfoSchema.parse(raw);
    },
  },
  window: {
    async getFullScreen(): Promise<boolean> {
      return (await ipcRenderer.invoke(IPC_CHANNELS.windowGetFullScreen)) === true;
    },
    async setFullScreen(value: boolean): Promise<void> {
      await ipcRenderer.invoke(IPC_CHANNELS.windowSetFullScreen, value === true);
    },
    async setPresentationMode(mode): Promise<void> {
      await ipcRenderer.invoke(
        IPC_CHANNELS.windowSetPresentationMode,
        WindowPresentationModeSchema.parse(mode),
      );
    },
  },
  maintenance: {
    async relaunch(invalidateCaches: boolean): Promise<void> {
      await ipcRenderer.invoke(
        IPC_CHANNELS.maintenanceRelaunch,
        MaintenanceRelaunchRequestSchema.parse({ invalidateCaches }),
      );
    },
  },
  diagnostics: {
    async snapshot() {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.diagnosticsSnapshot);
      return DiagnosticSnapshotSchema.parse(raw);
    },
    async reveal(kind): Promise<void> {
      await ipcRenderer.invoke(
        IPC_CHANNELS.diagnosticsReveal,
        DiagnosticPathKindSchema.parse(kind),
      );
    },
    async collectLogs(): Promise<boolean> {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.diagnosticsCollectLogs);
      return BooleanResultSchema.parse(raw);
    },
    async dumpThreads(): Promise<string> {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.diagnosticsDumpThreads);
      return DiagnosticPathResultSchema.parse(raw);
    },
    async readConfiguration(kind) {
      const raw: unknown = await ipcRenderer.invoke(
        IPC_CHANNELS.diagnosticsReadConfiguration,
        DiagnosticConfigurationKindSchema.parse(kind),
      );
      return DiagnosticConfigurationTextSchema.parse(raw);
    },
    async writeConfiguration(kind, content): Promise<void> {
      await ipcRenderer.invoke(
        IPC_CHANNELS.diagnosticsWriteConfiguration,
        DiagnosticConfigurationWriteRequestSchema.parse({
          kind,
          content,
        }),
      );
    },
    async openKeyboardShortcutsPdf(): Promise<void> {
      await ipcRenderer.invoke(IPC_CHANNELS.diagnosticsKeyboardShortcutsPdf);
    },
    async listLeftoverDirectories() {
      const raw: unknown = await ipcRenderer.invoke(
        IPC_CHANNELS.diagnosticsListLeftoverDirectories,
      );
      return DiagnosticLeftoverDirectoriesSchema.parse(raw);
    },
    async deleteLeftoverDirectories(ids) {
      const request = DiagnosticDeleteLeftoverDirectoriesRequestSchema.parse({ ids });
      const raw: unknown = await ipcRenderer.invoke(
        IPC_CHANNELS.diagnosticsDeleteLeftoverDirectories,
        request,
      );
      return DiagnosticDeletedLeftoverDirectoryIdsSchema.parse(raw);
    },
  },
  export: {
    async html(request): Promise<boolean> {
      const raw: unknown = await ipcRenderer.invoke(
        IPC_CHANNELS.exportHtml,
        HtmlExportRequestSchema.parse(request),
      );
      return BooleanResultSchema.parse(raw);
    },
    async patchText(request): Promise<boolean> {
      const raw: unknown = await ipcRenderer.invoke(
        IPC_CHANNELS.exportPatchText,
        PatchTextExportRequestSchema.parse(request),
      );
      return BooleanResultSchema.parse(raw);
    },
  },
  analysis: {
    async openOfflineInspection() {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.analysisOpenOfflineInspection);
      return raw === null ? null : OfflineInspectionFilesSchema.parse(raw);
    },
  },
  settings: {
    async get(key: string): Promise<JsonValue | null> {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.settingsGet, { key });
      if (raw === null) return null;
      return JsonValueSchema.parse(raw);
    },
    async set(key: string, value: JsonValue): Promise<void> {
      await ipcRenderer.invoke(IPC_CHANNELS.settingsSet, { key, value });
    },
    async delete(key: string): Promise<void> {
      await ipcRenderer.invoke(IPC_CHANNELS.settingsDelete, { key });
    },
    async exportArchive(): Promise<boolean> {
      return (await ipcRenderer.invoke(IPC_CHANNELS.settingsExport)) === true;
    },
    async importArchive(): Promise<boolean> {
      return (await ipcRenderer.invoke(IPC_CHANNELS.settingsImport)) === true;
    },
  },
  dialog: {
    async openDirectory(request) {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.dialogOpenDirectory, request);
      return DialogSelectionSchema.parse(raw);
    },
    async openFile(request) {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.dialogOpenFile, request);
      return DialogSelectionSchema.parse(raw);
    },
    async saveFile(request) {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.dialogSaveFile, request);
      return DialogSelectionSchema.parse(raw);
    },
  },
  shell: {
    async openExternal(url: string): Promise<void> {
      await ipcRenderer.invoke(IPC_CHANNELS.shellOpenExternal, ExternalUrlSchema.parse(url));
    },
  },
  clipboard: {
    async readText(): Promise<string> {
      const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.clipboardReadText);
      return ClipboardTextSchema.parse(raw);
    },
    async writeText(text: string): Promise<void> {
      await ipcRenderer.invoke(IPC_CHANNELS.clipboardWriteText, { text });
    },
  },
  menu: {
    onCommand(listener: (command: NativeCommand) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, raw: unknown): void => {
        listener(NativeCommandSchema.parse(raw));
      };
      ipcRenderer.on(IPC_CHANNELS.menuCommand, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.menuCommand, handler);
    },
    async syncState(states: readonly NativeCommandState[]): Promise<void> {
      await ipcRenderer.invoke(IPC_CHANNELS.menuSyncState, states);
    },
  },
  git: createGitApi(),
  terminal: createTerminalApi(),
  hosting: createHostingApi(),
};

contextBridge.exposeInMainWorld("gitClient", api);
