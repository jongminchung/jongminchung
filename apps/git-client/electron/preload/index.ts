import { contextBridge } from "electron";
import { z } from "zod";
import type { DesktopApi } from "../../src/shared/contracts/desktop-api";
import { RPC_PROCEDURES } from "../../src/shared/contracts/desktop-rpc";
import { QA_FIXTURE_RENDERER_ARGUMENT } from "../../src/shared/contracts/ipc";
import type { JsonValue, NativeCommand, NativeCommandState } from "../../src/shared/contracts/ipc";
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
  JsonValueSchema,
  MaintenanceRelaunchRequestSchema,
  NativeCommandSchema,
  OfflineInspectionFilesSchema,
  PatchTextExportRequestSchema,
  RuntimeInfoSchema,
  WindowPresentationModeSchema,
} from "../../src/shared/contracts/ipc";
import { desktopStream } from "./desktop-stream-client";
import { createGitApi } from "./git-api";
import { createHostingApi } from "./hosting-api";
import { invokeDesktopRpc } from "./rpc-client";
import { createTerminalApi } from "./terminal-api";

const BooleanResultSchema = z.boolean();
const DiagnosticConfigurationTextSchema = z.string().max(1_048_576);
const DiagnosticPathResultSchema = z.string().min(1).max(32_768);

const api: DesktopApi = {
  runtime: {
    qaFixture: process.argv.includes(QA_FIXTURE_RENDERER_ARGUMENT),
    async getInfo() {
      const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.runtimeInfo);
      return RuntimeInfoSchema.parse(raw);
    },
    async getCommandLineLauncherInfo() {
      const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.runtimeLauncherInfo);
      return CommandLineLauncherInfoSchema.parse(raw);
    },
  },
  window: {
    async getFullScreen(): Promise<boolean> {
      return (await invokeDesktopRpc(RPC_PROCEDURES.windowGetFullScreen)) === true;
    },
    async setFullScreen(value: boolean): Promise<void> {
      await invokeDesktopRpc(RPC_PROCEDURES.windowSetFullScreen, value === true);
    },
    async setPresentationMode(mode): Promise<void> {
      await invokeDesktopRpc(
        RPC_PROCEDURES.windowSetPresentationMode,
        WindowPresentationModeSchema.parse(mode),
      );
    },
  },
  maintenance: {
    async relaunch(invalidateCaches: boolean): Promise<void> {
      await invokeDesktopRpc(
        RPC_PROCEDURES.maintenanceRelaunch,
        MaintenanceRelaunchRequestSchema.parse({ invalidateCaches }),
      );
    },
  },
  diagnostics: {
    async snapshot() {
      const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.diagnosticsSnapshot);
      return DiagnosticSnapshotSchema.parse(raw);
    },
    async reveal(kind): Promise<void> {
      await invokeDesktopRpc(
        RPC_PROCEDURES.diagnosticsReveal,
        DiagnosticPathKindSchema.parse(kind),
      );
    },
    async collectLogs(): Promise<boolean> {
      const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.diagnosticsCollectLogs);
      return BooleanResultSchema.parse(raw);
    },
    async dumpThreads(): Promise<string> {
      const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.diagnosticsDumpThreads);
      return DiagnosticPathResultSchema.parse(raw);
    },
    async readConfiguration(kind) {
      const raw: unknown = await invokeDesktopRpc(
        RPC_PROCEDURES.diagnosticsReadConfiguration,
        DiagnosticConfigurationKindSchema.parse(kind),
      );
      return DiagnosticConfigurationTextSchema.parse(raw);
    },
    async writeConfiguration(kind, content): Promise<void> {
      await invokeDesktopRpc(
        RPC_PROCEDURES.diagnosticsWriteConfiguration,
        DiagnosticConfigurationWriteRequestSchema.parse({
          kind,
          content,
        }),
      );
    },
    async openKeyboardShortcutsPdf(): Promise<void> {
      await invokeDesktopRpc(RPC_PROCEDURES.diagnosticsKeyboardShortcutsPdf);
    },
    async listLeftoverDirectories() {
      const raw: unknown = await invokeDesktopRpc(
        RPC_PROCEDURES.diagnosticsListLeftoverDirectories,
      );
      return DiagnosticLeftoverDirectoriesSchema.parse(raw);
    },
    async deleteLeftoverDirectories(ids) {
      const request = DiagnosticDeleteLeftoverDirectoriesRequestSchema.parse({ ids });
      const raw: unknown = await invokeDesktopRpc(
        RPC_PROCEDURES.diagnosticsDeleteLeftoverDirectories,
        request,
      );
      return DiagnosticDeletedLeftoverDirectoryIdsSchema.parse(raw);
    },
  },
  export: {
    async html(request): Promise<boolean> {
      const raw: unknown = await invokeDesktopRpc(
        RPC_PROCEDURES.exportHtml,
        HtmlExportRequestSchema.parse(request),
      );
      return BooleanResultSchema.parse(raw);
    },
    async patchText(request): Promise<boolean> {
      const raw: unknown = await invokeDesktopRpc(
        RPC_PROCEDURES.exportPatchText,
        PatchTextExportRequestSchema.parse(request),
      );
      return BooleanResultSchema.parse(raw);
    },
  },
  analysis: {
    async openOfflineInspection() {
      const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.analysisOpenOfflineInspection);
      return raw === null ? null : OfflineInspectionFilesSchema.parse(raw);
    },
  },
  settings: {
    async get(key: string): Promise<JsonValue | null> {
      const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.settingsGet, { key });
      if (raw === null) return null;
      return JsonValueSchema.parse(raw);
    },
    async set(key: string, value: JsonValue): Promise<void> {
      await invokeDesktopRpc(RPC_PROCEDURES.settingsSet, { key, value });
    },
    async delete(key: string): Promise<void> {
      await invokeDesktopRpc(RPC_PROCEDURES.settingsDelete, { key });
    },
    async exportArchive(): Promise<boolean> {
      return (await invokeDesktopRpc(RPC_PROCEDURES.settingsExport)) === true;
    },
    async importArchive(): Promise<boolean> {
      return (await invokeDesktopRpc(RPC_PROCEDURES.settingsImport)) === true;
    },
  },
  dialog: {
    async openDirectory(request) {
      const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.dialogOpenDirectory, request);
      return DialogSelectionSchema.parse(raw);
    },
    async openFile(request) {
      const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.dialogOpenFile, request);
      return DialogSelectionSchema.parse(raw);
    },
    async saveFile(request) {
      const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.dialogSaveFile, request);
      return DialogSelectionSchema.parse(raw);
    },
  },
  shell: {
    async openExternal(url: string): Promise<void> {
      await invokeDesktopRpc(RPC_PROCEDURES.shellOpenExternal, ExternalUrlSchema.parse(url));
    },
  },
  clipboard: {
    async readText(): Promise<string> {
      const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.clipboardReadText);
      return ClipboardTextSchema.parse(raw);
    },
    async writeText(text: string): Promise<void> {
      await invokeDesktopRpc(RPC_PROCEDURES.clipboardWriteText, { text });
    },
  },
  menu: {
    onCommand(listener: (command: NativeCommand) => void): () => void {
      return desktopStream.subscribe((envelope) => {
        if (envelope.kind === "menu.command") {
          listener(NativeCommandSchema.parse(envelope.command));
        }
      });
    },
    async syncState(states: readonly NativeCommandState[]): Promise<void> {
      await invokeDesktopRpc(RPC_PROCEDURES.menuSyncState, states);
    },
  },
  git: createGitApi(),
  terminal: createTerminalApi(),
  hosting: createHostingApi(),
};

contextBridge.exposeInMainWorld("gitClient", api);
