import { contextBridge } from "electron";
import type { DesktopApi } from "../../src/shared/contracts/desktop-api";
import { QA_FIXTURE_RENDERER_ARGUMENT } from "../../src/shared/contracts/ipc";
import type {
  JsonValue,
  NativeCommand,
  NativeCommandState,
} from "../../src/shared/contracts/ipc";
import {
  ClipboardWriteRequestSchema,
  DiagnosticConfigurationKindSchema,
  DiagnosticConfigurationWriteRequestSchema,
  DiagnosticDeleteLeftoverDirectoriesRequestSchema,
  DiagnosticPathKindSchema,
  DialogRequestSchema,
  ExternalUrlSchema,
  HtmlExportRequestSchema,
  MaintenanceRelaunchRequestSchema,
  NativeCommandSchema,
  NativeCommandStatesSchema,
  OfflineInspectionFilesSchema,
  PatchTextExportRequestSchema,
  SettingsDeleteRequestSchema,
  SettingsGetRequestSchema,
  SettingsSetRequestSchema,
  WindowPresentationModeSchema,
} from "../../src/shared/contracts/ipc";
import { desktopStream } from "./desktop-stream-client";
import { createGitApi } from "./git-api";
import { createHostingApi } from "./hosting-api";
import { desktopTrpc } from "./main-trpc-client";
import { createTerminalApi } from "./terminal-api";

const api: DesktopApi = {
  runtime: {
    qaFixture: process.argv.includes(QA_FIXTURE_RENDERER_ARGUMENT),
    async getInfo() {
      return desktopTrpc.platform.runtimeInfo.query();
    },
    async getCommandLineLauncherInfo() {
      return desktopTrpc.platform.runtimeLauncherInfo.query();
    },
  },
  window: {
    async getFullScreen(): Promise<boolean> {
      return desktopTrpc.platform.windowGetFullScreen.query();
    },
    async setFullScreen(value: boolean): Promise<void> {
      await desktopTrpc.platform.windowSetFullScreen.mutate(value === true);
    },
    async setPresentationMode(mode): Promise<void> {
      await desktopTrpc.platform.windowSetPresentationMode.mutate(
        WindowPresentationModeSchema.parse(mode),
      );
    },
  },
  maintenance: {
    async relaunch(invalidateCaches: boolean): Promise<void> {
      await desktopTrpc.platform.maintenanceRelaunch.mutate(
        MaintenanceRelaunchRequestSchema.parse({ invalidateCaches }),
      );
    },
  },
  diagnostics: {
    async snapshot() {
      return desktopTrpc.platform.diagnosticsSnapshot.query();
    },
    async reveal(kind): Promise<void> {
      await desktopTrpc.platform.diagnosticsReveal.mutate(
        DiagnosticPathKindSchema.parse(kind),
      );
    },
    async collectLogs(): Promise<boolean> {
      return desktopTrpc.platform.diagnosticsCollectLogs.mutate();
    },
    async dumpThreads(): Promise<string> {
      return desktopTrpc.platform.diagnosticsDumpThreads.mutate();
    },
    async readConfiguration(kind) {
      return desktopTrpc.platform.diagnosticsReadConfiguration.query(
        DiagnosticConfigurationKindSchema.parse(kind),
      );
    },
    async writeConfiguration(kind, content): Promise<void> {
      await desktopTrpc.platform.diagnosticsWriteConfiguration.mutate(
        DiagnosticConfigurationWriteRequestSchema.parse({
          kind,
          content,
        }),
      );
    },
    async openKeyboardShortcutsPdf(): Promise<void> {
      await desktopTrpc.platform.diagnosticsKeyboardShortcutsPdf.mutate();
    },
    async listLeftoverDirectories() {
      return desktopTrpc.platform.diagnosticsListLeftoverDirectories.query();
    },
    async deleteLeftoverDirectories(ids) {
      const request = DiagnosticDeleteLeftoverDirectoriesRequestSchema.parse({
        ids,
      });
      return desktopTrpc.platform.diagnosticsDeleteLeftoverDirectories.mutate(
        request,
      );
    },
  },
  export: {
    async html(request): Promise<boolean> {
      return desktopTrpc.platform.exportHtml.mutate(
        HtmlExportRequestSchema.parse(request),
      );
    },
    async patchText(request): Promise<boolean> {
      return desktopTrpc.platform.exportPatchText.mutate(
        PatchTextExportRequestSchema.parse(request),
      );
    },
  },
  analysis: {
    async openOfflineInspection() {
      const files =
        await desktopTrpc.platform.analysisOpenOfflineInspection.mutate();
      return files === null ? null : OfflineInspectionFilesSchema.parse(files);
    },
  },
  settings: {
    async get(key: string): Promise<JsonValue | null> {
      return desktopTrpc.platform.settingsGet.query(
        SettingsGetRequestSchema.parse({ key }),
      );
    },
    async set(key: string, value: JsonValue): Promise<void> {
      await desktopTrpc.platform.settingsSet.mutate(
        SettingsSetRequestSchema.parse({ key, value }),
      );
    },
    async delete(key: string): Promise<void> {
      await desktopTrpc.platform.settingsDelete.mutate(
        SettingsDeleteRequestSchema.parse({ key }),
      );
    },
    async exportArchive(): Promise<boolean> {
      return desktopTrpc.platform.settingsExport.mutate();
    },
    async importArchive(): Promise<boolean> {
      return desktopTrpc.platform.settingsImport.mutate();
    },
  },
  dialog: {
    async openDirectory(request) {
      return desktopTrpc.platform.dialogOpenDirectory.mutate(
        DialogRequestSchema.parse(request),
      );
    },
    async openFile(request) {
      return desktopTrpc.platform.dialogOpenFile.mutate(
        DialogRequestSchema.parse(request),
      );
    },
    async saveFile(request) {
      return desktopTrpc.platform.dialogSaveFile.mutate(
        DialogRequestSchema.parse(request),
      );
    },
  },
  shell: {
    async openExternal(url: string): Promise<void> {
      await desktopTrpc.platform.shellOpenExternal.mutate(
        ExternalUrlSchema.parse(url),
      );
    },
  },
  clipboard: {
    async readText(): Promise<string> {
      return desktopTrpc.platform.clipboardReadText.query();
    },
    async writeText(text: string): Promise<void> {
      await desktopTrpc.platform.clipboardWriteText.mutate(
        ClipboardWriteRequestSchema.parse({ text }),
      );
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
      await desktopTrpc.platform.menuSyncState.mutate(
        NativeCommandStatesSchema.parse(states),
      );
    },
  },
  git: createGitApi(),
  terminal: createTerminalApi(),
  hosting: createHostingApi(),
};

contextBridge.exposeInMainWorld("gitClient", api);
