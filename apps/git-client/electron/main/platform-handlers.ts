import {
    lstat,
    readFile,
    readdir,
    realpath,
    writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { app, BrowserWindow, clipboard, dialog, shell } from "electron";
import { strToU8, zipSync } from "fflate";
import {
    LOCAL_HISTORY_TRPC_PROCEDURE_KEYS,
    MAIN_DESKTOP_TRPC_PROCEDURE_KEYS,
    localHistoryDesktopTrpcRouter,
    mainDesktopTrpcRouter,
} from "../../src/shared/contracts/desktop-trpc";
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
    RuntimeInfo,
    WindowPresentationMode,
} from "../../src/shared/contracts/ipc";
import {
    localHistoryRequestRepositoryId,
    parseLocalHistoryRepositoryRequest,
} from "../../src/shared/contracts/local-history-ipc";
import type { ElectronHostingFoundation } from "../hosting";
import type { DesktopStreamPublisher } from "./desktop-stream-hub";
import { desktopTrpcRepositoryCapabilityIds } from "./desktop-trpc-authorization";
import { DesktopTrpcHost } from "./desktop-trpc-host";
import type { DiagnosticsService } from "./diagnostics-service";
import {
    registerGitHandlers,
    registerLocalHistoryGitHandler,
} from "./git-handlers";
import type { GitUtilityClient } from "./git-utility-client";
import { registerHostingHandlers } from "./hosting-handlers";
import {
    assertTrustedLocalHistorySender,
    assertTrustedSender,
} from "./ipc-security";
import type { NativeMenuService } from "./menu-service";
import {
    ensureExportDirectory,
    escapeHtml,
    exportedHtml,
    exportedPath,
    htmlLink,
} from "./platform-export";
import { createRepositoryCapabilityAssertions } from "./repository-capabilities";
import {
    parseImportedSettings,
    SETTINGS_CREDENTIAL_PREFIX,
    SETTINGS_ARCHIVE_SCHEMA_VERSION,
} from "./settings-archive";
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
    readonly stream?: DesktopStreamPublisher;
    readonly onWindowPresentationModeChange?: (
        mode: WindowPresentationMode,
    ) => void;
}

export interface PlatformHandlerRegistration {
    registerLocalHistoryWindow(
        window: BrowserWindow,
        repositoryId: RepositoryId,
    ): () => void;
    dispose(): void;
}

let currentRegistration: PlatformHandlerRegistration | null = null;

export function registerPlatformHandlers(
    dependencies: PlatformHandlerDependencies,
): PlatformHandlerRegistration {
    const {
        window,
        settings,
        menu,
        gitUtility,
        terminalUtility,
        hosting,
        diagnostics: providedDiagnostics,
        runtime,
        stream: providedStream,
        onWindowPresentationModeChange,
    } = dependencies;
    const stream = providedStream ?? { publish: (): void => undefined };
    currentRegistration?.dispose();
    const repositoryPaths = new Map<string, string>();
    const repositoryAccessModes = new Map<string, "trusted" | "safe">();
    const { assertRepositoryCapability, assertActiveCapability } =
        createRepositoryCapabilityAssertions({
            settings,
            repositoryPaths,
            repositoryAccessModes,
        });
    const router = new DesktopTrpcHost({
        router: mainDesktopTrpcRouter,
        contents: window.webContents,
        procedureKeys: MAIN_DESKTOP_TRPC_PROCEDURE_KEYS,
        authorize: (_event, authorization, domain, procedure, input) => {
            assertTrustedSender(_event, window);
            if (authorization.kind === "activeCapability") {
                assertActiveCapability(authorization.capability);
            }
            if (authorization.kind === "repositoryCapability") {
                for (const repositoryId of desktopTrpcRepositoryCapabilityIds(
                    domain,
                    procedure,
                    input,
                )) {
                    assertRepositoryCapability(
                        repositoryId,
                        authorization.capability,
                    );
                }
            }
        },
    });

    router.handle("platform", "runtimeInfo", (_event) => {
        return RuntimeInfoSchema.parse(runtime);
    });
    router.handle("platform", "runtimeLauncherInfo", (_event) => {
        return CommandLineLauncherInfoSchema.parse({
            directory: dirname(process.execPath),
            command: basename(process.execPath),
        });
    });
    router.handle("platform", "windowGetFullScreen", (_event): boolean => {
        return window.isFullScreen();
    });
    router.handle("platform", "windowSetFullScreen", (_event, raw): void => {
        if (typeof raw !== "boolean")
            throw new Error("Full-screen state must be a boolean.");
        window.setFullScreen(raw);
    });
    router.handle(
        "platform",
        "windowSetPresentationMode",
        (_event, raw): void => {
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
            if (
                mode === "welcome" ||
                width < bounds.minWidth ||
                height < bounds.minHeight
            ) {
                window.setSize(bounds.width, bounds.height, true);
                window.center();
            }
        },
    );
    router.handle(
        "platform",
        "maintenanceRelaunch",
        async (_event, raw): Promise<void> => {
            const request = MaintenanceRelaunchRequestSchema.parse(raw);
            if (request.invalidateCaches) {
                await window.webContents.session.clearCache();
            }
            app.relaunch();
            app.exit(0);
        },
    );
    if (providedDiagnostics !== undefined) {
        const diagnostics = providedDiagnostics;
        router.handle("platform", "diagnosticsSnapshot", async (_event) => {
            return DiagnosticSnapshotSchema.parse(await diagnostics.snapshot());
        });
        router.handle(
            "platform",
            "diagnosticsReveal",
            async (_event, raw): Promise<void> => {
                const kind = DiagnosticPathKindSchema.parse(raw);
                const path = await diagnostics.preparePath(kind);
                const metadata = await lstat(path);
                if (metadata.isSymbolicLink()) {
                    throw new Error(
                        "Diagnostic paths cannot be symbolic links.",
                    );
                }
                if (metadata.isFile()) {
                    shell.showItemInFolder(path);
                    return;
                }
                if (!metadata.isDirectory()) {
                    throw new Error(
                        "Diagnostic target must be a file or directory.",
                    );
                }
                const error = await shell.openPath(path);
                if (error) throw new Error(error);
            },
        );
        router.handle(
            "platform",
            "diagnosticsCollectLogs",
            async (_event): Promise<boolean> => {
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
                        throw new Error(
                            "Diagnostic export refuses symbolic-link and non-file targets.",
                        );
                    }
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                        throw error;
                    }
                }
                await writeFile(
                    target,
                    await diagnostics.createLogArchive(
                        settings.createSnapshot(),
                    ),
                    {
                        mode: 0o600,
                    },
                );
                return true;
            },
        );
        router.handle(
            "platform",
            "diagnosticsDumpThreads",
            async (_event): Promise<string> => {
                const path = await diagnostics.dumpThreads();
                shell.showItemInFolder(path);
                return path;
            },
        );
        router.handle(
            "platform",
            "diagnosticsReadConfiguration",
            async (_event, raw): Promise<string> => {
                return diagnostics.readConfiguration(
                    DiagnosticConfigurationKindSchema.parse(raw),
                );
            },
        );
        router.handle(
            "platform",
            "diagnosticsWriteConfiguration",
            async (_event, raw): Promise<void> => {
                const request =
                    DiagnosticConfigurationWriteRequestSchema.parse(raw);
                await diagnostics.writeConfiguration(
                    request.kind,
                    request.content,
                );
            },
        );
        router.handle(
            "platform",
            "diagnosticsKeyboardShortcutsPdf",
            async (_event): Promise<void> => {
                const path = await diagnostics.createKeyboardShortcutsPdf();
                const error = await shell.openPath(path);
                if (error) throw new Error(error);
            },
        );
        router.handle(
            "platform",
            "diagnosticsListLeftoverDirectories",
            async (_event) => {
                return DiagnosticLeftoverDirectoriesSchema.parse(
                    await diagnostics.listLeftoverDirectories(),
                );
            },
        );
        router.handle(
            "platform",
            "diagnosticsDeleteLeftoverDirectories",
            async (_event, raw) => {
                const request =
                    DiagnosticDeleteLeftoverDirectoriesRequestSchema.parse(raw);
                return DiagnosticDeletedLeftoverDirectoryIdsSchema.parse(
                    await diagnostics.deleteLeftoverDirectories(request.ids),
                );
            },
        );
    }
    router.handle(
        "platform",
        "exportHtml",
        async (_event, raw): Promise<boolean> => {
            const request = HtmlExportRequestSchema.parse(raw);
            const selection = await dialog.showOpenDialog(window, {
                title: "Select Output Directory",
                message: "HTML files will be exported to this directory",
                properties: ["openDirectory", "createDirectory"],
            });
            const outputDirectory = selection.filePaths[0];
            if (selection.canceled || outputDirectory === undefined)
                return false;
            const canonicalRoot = await realpath(outputDirectory);
            const outputs: string[] = [];
            for (const file of request.files) {
                const relativeTarget = exportedPath(file.path);
                const parent = await ensureExportDirectory(
                    canonicalRoot,
                    dirname(relativeTarget) === "."
                        ? ""
                        : dirname(relativeTarget),
                );
                const target = resolve(
                    parent,
                    relativeTarget.split("/").at(-1) ?? "export.html",
                );
                try {
                    const metadata = await lstat(target);
                    if (metadata.isSymbolicLink() || !metadata.isFile()) {
                        throw new Error(
                            "HTML export refuses symbolic-link and non-file targets.",
                        );
                    }
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
                        throw error;
                }
                await writeFile(
                    target,
                    exportedHtml(
                        file.path,
                        file.content,
                        request.includeLineNumbers,
                    ),
                    {
                        encoding: "utf8",
                        mode: 0o600,
                    },
                );
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
        },
    );
    router.handle(
        "platform",
        "analysisOpenOfflineInspection",
        async (_event) => {
            const selection = await dialog.showOpenDialog(window, {
                title: "Select Path",
                message:
                    "Select directory which contains exported inspection results",
                filters: [{ name: "Inspection Results", extensions: ["xml"] }],
                properties: ["openFile", "openDirectory"],
            });
            const selectedPath = selection.filePaths[0];
            if (selection.canceled || selectedPath === undefined) return null;
            const metadata = await lstat(selectedPath);
            if (metadata.isSymbolicLink()) {
                throw new Error(
                    "Offline inspection import refuses symbolic links.",
                );
            }
            if (!metadata.isFile() && !metadata.isDirectory()) {
                throw new Error(
                    "Offline inspection results must be an XML file or directory.",
                );
            }
            if (
                metadata.isFile() &&
                extname(selectedPath).toLocaleLowerCase() !== ".xml"
            ) {
                throw new Error(
                    "Offline inspection results must use the .xml extension.",
                );
            }
            const candidates = metadata.isDirectory()
                ? (
                      await readdir(await realpath(selectedPath), {
                          withFileTypes: true,
                      })
                  )
                      .filter(
                          (entry) =>
                              entry.isFile() &&
                              extname(entry.name).toLocaleLowerCase() ===
                                  ".xml",
                      )
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
                if (fileMetadata.isSymbolicLink() || !fileMetadata.isFile())
                    continue;
                if (fileMetadata.size > 5_242_880) {
                    throw new Error(`${basename(path)} is larger than 5 MiB.`);
                }
                totalBytes += fileMetadata.size;
                if (totalBytes > 20_971_520) {
                    throw new Error(
                        "Offline inspection results exceed 20 MiB.",
                    );
                }
                files.push({
                    name: basename(path),
                    content: await readFile(path, "utf8"),
                });
            }
            return OfflineInspectionFilesSchema.parse(files);
        },
    );
    router.handle(
        "platform",
        "exportPatchText",
        async (_event, raw): Promise<boolean> => {
            const request = PatchTextExportRequestSchema.parse(raw);
            const selection = await dialog.showSaveDialog(window, {
                title: "Create Patch from Local Changes",
                defaultPath: request.defaultName,
                filters: [{ name: "Git patch", extensions: ["patch", "diff"] }],
            });
            if (selection.canceled || !selection.filePath) return false;
            const canonicalParent = await realpath(dirname(selection.filePath));
            const target = resolve(
                canonicalParent,
                basename(selection.filePath),
            );
            try {
                const metadata = await lstat(target);
                if (metadata.isSymbolicLink() || !metadata.isFile()) {
                    throw new Error(
                        "Patch export refuses symbolic-link and non-file targets.",
                    );
                }
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== "ENOENT")
                    throw error;
            }
            await writeFile(target, request.content, {
                encoding: "utf8",
                mode: 0o600,
            });
            return true;
        },
    );
    router.handle("platform", "settingsGet", (_event, raw) => {
        const request = SettingsGetRequestSchema.parse(raw);
        return settings.get(request.key);
    });
    router.handle(
        "platform",
        "settingsSet",
        async (_event, raw): Promise<void> => {
            const request = SettingsSetRequestSchema.parse(raw);
            await settings.set(
                request.key,
                JsonValueSchema.parse(request.value),
            );
        },
    );
    router.handle(
        "platform",
        "settingsDelete",
        async (_event, raw): Promise<void> => {
            const request = SettingsDeleteRequestSchema.parse(raw);
            await settings.delete(request.key);
        },
    );
    router.handle(
        "platform",
        "settingsExport",
        async (_event): Promise<boolean> => {
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
                    schemaVersion: SETTINGS_ARCHIVE_SCHEMA_VERSION,
                    exportedAt: new Date().toISOString(),
                    values,
                }),
            );
            const archive = zipSync({ "settings.json": payload }, { level: 6 });
            await writeFile(selection.filePath, archive, { mode: 0o600 });
            return true;
        },
    );
    router.handle(
        "platform",
        "settingsImport",
        async (_event): Promise<boolean> => {
            const selection = await dialog.showOpenDialog(window, {
                title: "Import Settings",
                filters: [{ name: "Settings Archive", extensions: ["zip"] }],
                properties: ["openFile"],
            });
            if (selection.canceled || !selection.filePaths[0]) return false;
            const imported = parseImportedSettings(
                await readFile(selection.filePaths[0]),
            );
            const credentials = Object.fromEntries(
                Object.entries(settings.createSnapshot()).filter(([key]) =>
                    key.startsWith(SETTINGS_CREDENTIAL_PREFIX),
                ),
            );
            await settings.replace({ ...imported, ...credentials });
            return true;
        },
    );
    router.handle("platform", "dialogOpenDirectory", async (_event, raw) => {
        const request = DialogRequestSchema.parse(raw);
        const result = await dialog.showOpenDialog(window, {
            title: request.title,
            defaultPath: request.defaultPath ?? undefined,
            properties: ["openDirectory", "createDirectory"],
        });
        return DialogSelectionSchema.parse(
            result.canceled ? null : (result.filePaths[0] ?? null),
        );
    });
    router.handle("platform", "dialogOpenFile", async (_event, raw) => {
        const request = DialogRequestSchema.parse(raw);
        const result = await dialog.showOpenDialog(window, {
            title: request.title,
            defaultPath: request.defaultPath ?? undefined,
            filters: request.filters,
            properties: ["openFile"],
        });
        return DialogSelectionSchema.parse(
            result.canceled ? null : (result.filePaths[0] ?? null),
        );
    });
    router.handle("platform", "dialogSaveFile", async (_event, raw) => {
        const request = DialogRequestSchema.parse(raw);
        const result = await dialog.showSaveDialog(window, {
            title: request.title,
            defaultPath: request.defaultPath ?? undefined,
            filters: request.filters,
        });
        return DialogSelectionSchema.parse(
            result.canceled ? null : (result.filePath ?? null),
        );
    });
    router.handle(
        "platform",
        "shellOpenExternal",
        async (_event, raw): Promise<void> => {
            const url = ExternalUrlSchema.parse(raw);
            await shell.openExternal(url, { activate: true });
        },
    );
    router.handle("platform", "clipboardWriteText", (_event, raw): void => {
        const request = ClipboardWriteRequestSchema.parse(raw);
        clipboard.writeText(request.text);
    });
    router.handle("platform", "clipboardReadText", (_event): string => {
        return ClipboardTextSchema.parse(clipboard.readText());
    });
    router.handle("platform", "menuSyncState", (_event, raw): void => {
        menu.sync(NativeCommandStatesSchema.parse(raw));
    });
    const disposeGitHandlers = registerGitHandlers({
        router,
        stream,
        window,
        settings,
        gitUtility,
        terminalUtility,
        repositoryPaths,
        repositoryAccessModes,
    });
    const disposeTerminalHandlers = registerTerminalHandlers({
        router,
        stream,
        window,
        terminalUtility,
        repositoryPaths,
    });
    registerHostingHandlers({
        router,
        hosting,
    });

    const localHistoryRouters = new Set<
        DesktopTrpcHost<typeof localHistoryDesktopTrpcRouter>
    >();
    const registration: PlatformHandlerRegistration = {
        registerLocalHistoryWindow(localHistoryWindow, repositoryId) {
            const localHistoryRouter = new DesktopTrpcHost({
                router: localHistoryDesktopTrpcRouter,
                contents: localHistoryWindow.webContents,
                procedureKeys: LOCAL_HISTORY_TRPC_PROCEDURE_KEYS,
                authorize: (
                    _event,
                    authorization,
                    domain,
                    procedure,
                    input,
                ) => {
                    assertTrustedLocalHistorySender(
                        _event,
                        window,
                        repositoryId,
                    );
                    const request = parseLocalHistoryRepositoryRequest(input);
                    if (
                        localHistoryRequestRepositoryId(request) !==
                        repositoryId
                    ) {
                        throw new Error(
                            "Local History cannot access a different repository.",
                        );
                    }
                    if (authorization.kind === "repositoryCapability") {
                        for (const authorizedRepositoryId of desktopTrpcRepositoryCapabilityIds(
                            domain,
                            procedure,
                            request,
                        )) {
                            assertRepositoryCapability(
                                authorizedRepositoryId,
                                authorization.capability,
                            );
                        }
                    }
                },
            });
            localHistoryRouters.add(localHistoryRouter);
            registerLocalHistoryGitHandler({
                router: localHistoryRouter,
                gitUtility,
            });
            const dispose = (): void => {
                localHistoryRouter.dispose();
                localHistoryRouters.delete(localHistoryRouter);
            };
            localHistoryWindow.once("closed", dispose);
            return dispose;
        },
        dispose() {
            disposeGitHandlers();
            disposeTerminalHandlers();
            router.dispose();
            for (const localHistoryRouter of localHistoryRouters)
                localHistoryRouter.dispose();
            localHistoryRouters.clear();
            if (currentRegistration === registration)
                currentRegistration = null;
        },
    };
    currentRegistration = registration;
    return registration;
}

export function unregisterPlatformHandlers(): void {
    currentRegistration?.dispose();
}
