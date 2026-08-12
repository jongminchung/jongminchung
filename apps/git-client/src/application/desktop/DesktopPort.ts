import type {
    HtmlExportRequest,
    OfflineInspectionFile,
    PatchTextExportRequest,
} from "../../shared/contracts/ipc";

export interface DesktopPort {
    readonly electronRuntime: boolean;
    exportHtmlFiles(request: HtmlExportRequest): Promise<boolean>;
    exportPatchText(request: PatchTextExportRequest): Promise<boolean>;
    openExternalUrl(url: string): Promise<void>;
    readClipboardText(): Promise<string>;
    readSetting(key: string): Promise<unknown>;
    selectOfflineInspectionFiles(): Promise<
        readonly OfflineInspectionFile[] | null
    >;
    selectPatchExportPath(defaultPath: string): Promise<string | null>;
    selectPatchImportPath(): Promise<string | null>;
    writeClipboardText(text: string): Promise<void>;
    writeSettings(values: Readonly<Record<string, unknown>>): Promise<void>;
}

const inertDesktopPort: DesktopPort = {
    electronRuntime: false,
    exportHtmlFiles: async () => false,
    exportPatchText: async () => false,
    openExternalUrl: async () => undefined,
    readClipboardText: async () => "",
    readSetting: async () => null,
    selectOfflineInspectionFiles: async () => null,
    selectPatchExportPath: async () => null,
    selectPatchImportPath: async () => null,
    writeClipboardText: async () => undefined,
    writeSettings: async () => undefined,
};

let activePort = inertDesktopPort;

export function setDesktopPort(port: DesktopPort): () => void {
    const previous = activePort;
    activePort = port;
    return () => {
        if (activePort === port) activePort = previous;
    };
}

export const isElectronRuntime = (): boolean => activePort.electronRuntime;
export const exportHtmlFiles: DesktopPort["exportHtmlFiles"] = (request) =>
    activePort.exportHtmlFiles(request);
export const exportPatchText: DesktopPort["exportPatchText"] = (request) =>
    activePort.exportPatchText(request);
export const openExternalUrl: DesktopPort["openExternalUrl"] = (url) =>
    activePort.openExternalUrl(url);
export const readClipboardText: DesktopPort["readClipboardText"] = () =>
    activePort.readClipboardText();
export const readDesktopSetting: DesktopPort["readSetting"] = (key) =>
    activePort.readSetting(key);
export const selectOfflineInspectionFiles: DesktopPort["selectOfflineInspectionFiles"] =
    () => activePort.selectOfflineInspectionFiles();
export const selectPatchExportPath: DesktopPort["selectPatchExportPath"] = (
    defaultPath,
) => activePort.selectPatchExportPath(defaultPath);
export const selectPatchImportPath: DesktopPort["selectPatchImportPath"] = () =>
    activePort.selectPatchImportPath();
export const writeClipboardText: DesktopPort["writeClipboardText"] = (text) =>
    activePort.writeClipboardText(text);
export const writeDesktopSettings: DesktopPort["writeSettings"] = (values) =>
    activePort.writeSettings(values);
