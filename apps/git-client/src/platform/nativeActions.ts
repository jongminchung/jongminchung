import {
    DialogRequestSchema,
    ExternalUrlSchema,
    HtmlExportRequestSchema,
    PatchTextExportRequestSchema,
    type HtmlExportRequest,
    type PatchTextExportRequest,
    type DialogRequest,
    type DiagnosticConfigurationKind,
    type DiagnosticLeftoverDirectory,
    type CommandLineLauncherInfo,
    type DiagnosticPathKind,
    type DiagnosticSnapshot,
} from "../shared/contracts/ipc";
import { electronApi } from "./electron";

const PATCH_EXPORT_REQUEST: DialogRequest = DialogRequestSchema.parse({
    title: "Export Git patch",
    defaultPath: "change.patch",
    filters: [{ name: "Git patch", extensions: ["patch", "mbox"] }],
});

const PATCH_IMPORT_REQUEST: DialogRequest = DialogRequestSchema.parse({
    title: "Import Git patch",
    defaultPath: null,
    filters: [{ name: "Git patch", extensions: ["patch", "diff", "mbox"] }],
});

export async function selectPatchExportPath(
    defaultPath: string,
): Promise<string | null> {
    const request = DialogRequestSchema.parse({
        ...PATCH_EXPORT_REQUEST,
        defaultPath,
    });
    const api = electronApi();
    if (api !== null) return api.dialog.saveFile(request);
    return null;
}

export async function selectPatchImportPath(): Promise<string | null> {
    const api = electronApi();
    if (api !== null) return api.dialog.openFile(PATCH_IMPORT_REQUEST);
    return null;
}

export async function openExternalUrl(url: string): Promise<void> {
    const safeUrl = ExternalUrlSchema.parse(url);
    const api = electronApi();
    if (api !== null) {
        await api.shell.openExternal(safeUrl);
        return;
    }
    window.open(safeUrl, "_blank", "noopener,noreferrer");
}

export async function setNativeFullScreen(value: boolean): Promise<void> {
    const api = electronApi();
    if (api !== null) {
        await api.window.setFullScreen(value);
        return;
    }
    if (value) await document.documentElement.requestFullscreen?.();
    else if (document.fullscreenElement !== null) await document.exitFullscreen?.();
}

export function loadCommandLineLauncherInfo(): Promise<CommandLineLauncherInfo> {
    const api = electronApi();
    if (api === null) {
        return Promise.reject(
            new Error("Command-line launcher information requires Electron."),
        );
    }
    return api.runtime.getCommandLineLauncherInfo();
}

export async function getNativeFullScreen(): Promise<boolean> {
    const api = electronApi();
    if (api !== null) return api.window.getFullScreen();
    return document.fullscreenElement !== null;
}

export async function relaunchNativeApp(invalidateCaches: boolean): Promise<void> {
    const api = electronApi();
    if (api !== null) {
        await api.maintenance.relaunch(invalidateCaches);
        return;
    }
    window.location.reload();
}

function requireDiagnosticsApi() {
    const api = electronApi();
    if (api === null) {
        throw new Error("Diagnostics require the Electron application.");
    }
    return api.diagnostics;
}

export function loadDiagnosticSnapshot(): Promise<DiagnosticSnapshot> {
    return requireDiagnosticsApi().snapshot();
}

export function revealDiagnosticPath(kind: DiagnosticPathKind): Promise<void> {
    return requireDiagnosticsApi().reveal(kind);
}

export function collectDiagnosticLogs(): Promise<boolean> {
    return requireDiagnosticsApi().collectLogs();
}

export function dumpDiagnosticThreads(): Promise<string> {
    return requireDiagnosticsApi().dumpThreads();
}

export function readDiagnosticConfiguration(
    kind: DiagnosticConfigurationKind,
): Promise<string> {
    return requireDiagnosticsApi().readConfiguration(kind);
}

export function writeDiagnosticConfiguration(
    kind: DiagnosticConfigurationKind,
    content: string,
): Promise<void> {
    return requireDiagnosticsApi().writeConfiguration(kind, content);
}

export function openKeyboardShortcutsPdf(): Promise<void> {
    return requireDiagnosticsApi().openKeyboardShortcutsPdf();
}

export function listLeftoverDirectories(): Promise<
    readonly DiagnosticLeftoverDirectory[]
> {
    return requireDiagnosticsApi().listLeftoverDirectories();
}

export function deleteLeftoverDirectories(
    ids: readonly string[],
): Promise<readonly string[]> {
    return requireDiagnosticsApi().deleteLeftoverDirectories(ids);
}

export async function exportHtmlFiles(request: HtmlExportRequest): Promise<boolean> {
    const validated = HtmlExportRequestSchema.parse(request);
    return (await electronApi()?.export.html(validated)) ?? false;
}

export async function writeClipboardText(text: string): Promise<void> {
    const value = text.slice(0, 1_000_000);
    const api = electronApi();
    if (api !== null) {
        await api.clipboard.writeText(value);
        return;
    }
    await navigator.clipboard.writeText(value);
}

export async function readClipboardText(): Promise<string> {
    const api = electronApi();
    if (api !== null) return api.clipboard.readText();
    return navigator.clipboard.readText();
}

export async function exportPatchText(
    request: PatchTextExportRequest,
): Promise<boolean> {
    const validated = PatchTextExportRequestSchema.parse(request);
    return (await electronApi()?.export.patchText(validated)) ?? false;
}
