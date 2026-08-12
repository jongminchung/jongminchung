import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
    app,
    BrowserWindow,
    dialog,
    net,
    safeStorage,
    session,
    type WebContents,
} from "electron";
import {
    RepositoryIdSchema,
    type RepositoryId,
} from "../../src/shared/contracts/git-utility";
import { QA_FIXTURE_RENDERER_ARGUMENT } from "../../src/shared/contracts/ipc";
import type { WindowPresentationMode } from "../../src/shared/contracts/ipc";
import { ElectronHostingFoundation, FetchHostingHttpClient } from "../hosting";
import { DesktopStreamHub } from "./desktop-stream-hub";
import { DiagnosticsService } from "./diagnostics-service";
import { GitUtilityClient } from "./git-utility-client";
import { SafeStorageHostingCredentialStore } from "./hosting-credential-store";
import { NativeMenuService } from "./menu-service";
import {
    registerPlatformHandlers,
    unregisterPlatformHandlers,
} from "./platform-handlers";
import type { PlatformHandlerRegistration } from "./platform-handlers";
import { registerAppProtocol, registerPrivilegedScheme } from "./protocol";
import { QaHostingSafeStorage } from "./qa-hosting-safe-storage";
import {
    resolveRuntimeProfile,
    trustsQaHostingCertificate,
} from "./runtime-profile";
import { monitorWindowRuntime } from "./runtime-recovery";
import { SettingsStore } from "./settings-store";
import { NATIVE_WINDOW_BACKGROUND } from "./static-color-boundary";
import { TerminalUtilityClient } from "./terminal-utility-client";
import {
    shouldQuitAfterLastWindow,
    shouldRequestProjectClose,
    WELCOME_TRAFFIC_LIGHT_POSITION,
} from "./window-lifecycle";
import {
    installDefaultDenyPermissionPolicy,
    isTrustedRendererNavigation,
} from "./window-security";

registerPrivilegedScheme();

const runtimeProfile = resolveRuntimeProfile(process.argv);
const { qaFixture, qaSmokeTest } = runtimeProfile;
const runtime = {
    kind: "electron",
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    platform: process.platform,
    architecture: process.arch,
    qaFixture,
} as const;

app.setName("Git Client");
app.setPath("userData", join(app.getPath("appData"), runtimeProfile.name));
app.setAppLogsPath(join(app.getPath("userData"), "logs"));

function applyRendererMemoryOption(): void {
    try {
        const content = readFileSync(
            join(app.getPath("userData"), "config", "git-client.vmoptions"),
            "utf8",
        );
        const values = [
            ...content.matchAll(/^--max-old-space-size=(\d{3,5})$/gmu),
        ];
        const raw = values.at(-1)?.[1];
        const memory = raw === undefined ? Number.NaN : Number(raw);
        if (!Number.isInteger(memory) || memory < 256 || memory > 32_768) {
            return;
        }
        app.commandLine.appendSwitch(
            "js-flags",
            `--max-old-space-size=${memory}`,
        );
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            console.error("[git-client] custom VM options are invalid", error);
        }
    }
}

applyRendererMemoryOption();

const rendererRoot = join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`);
let mainWindow: BrowserWindow | null = null;
let gitUtility: GitUtilityClient | null = null;
let terminalUtility: TerminalUtilityClient | null = null;
let diagnosticsService: DiagnosticsService | null = null;
let finishingQuit = false;
let utilityCrashPromptOpen = false;

function localHistoryRepositoryFromUrl(value: string): RepositoryId | null {
    try {
        const url = new URL(value);
        if (url.pathname !== "/local-history" || url.hash.length > 0)
            return null;
        if (
            !isTrustedRendererNavigation(value, MAIN_WINDOW_VITE_DEV_SERVER_URL)
        )
            return null;
        return RepositoryIdSchema.parse(url.searchParams.get("repositoryId"));
    } catch {
        return null;
    }
}

function preventUntrustedNavigation(contents: WebContents): void {
    contents.on("will-navigate", (event, url) => {
        if (isTrustedRendererNavigation(url, MAIN_WINDOW_VITE_DEV_SERVER_URL))
            return;
        event.preventDefault();
    });
}

async function createMainWindow(
    utility: GitUtilityClient,
    terminal: TerminalUtilityClient,
    diagnostics: DiagnosticsService,
): Promise<BrowserWindow> {
    let presentationMode: WindowPresentationMode = "welcome";
    let platformHandlers: PlatformHandlerRegistration | null = null;
    const window = new BrowserWindow({
        width: 800,
        height: 650,
        minWidth: 800,
        minHeight: 650,
        show: false,
        backgroundColor: NATIVE_WINDOW_BACKGROUND,
        title: "Git Client",
        titleBarStyle: "hiddenInset",
        trafficLightPosition: WELCOME_TRAFFIC_LIGHT_POSITION,
        webPreferences: {
            additionalArguments: qaFixture
                ? [QA_FIXTURE_RENDERER_ARGUMENT]
                : [],
            preload: join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            spellcheck: false,
        },
    });

    window.once("ready-to-show", () => window.show());

    window.webContents.setWindowOpenHandler(({ url }) => {
        if (localHistoryRepositoryFromUrl(url) === null)
            return { action: "deny" };
        return {
            action: "allow",
            overrideBrowserWindowOptions: {
                parent: window,
                width: 1_080,
                height: 720,
                minWidth: 760,
                minHeight: 480,
                backgroundColor: NATIVE_WINDOW_BACKGROUND,
                titleBarStyle: "hiddenInset",
                trafficLightPosition: { x: 12, y: 14 },
                webPreferences: {
                    additionalArguments: qaFixture
                        ? [QA_FIXTURE_RENDERER_ARGUMENT]
                        : [],
                    preload: join(__dirname, "local-history-preload.cjs"),
                    contextIsolation: true,
                    nodeIntegration: false,
                    sandbox: true,
                    webSecurity: true,
                    spellcheck: false,
                },
            },
        };
    });
    window.webContents.on("did-create-window", (childWindow, details) => {
        const repositoryId = localHistoryRepositoryFromUrl(details.url);
        if (repositoryId === null) {
            childWindow.close();
            return;
        }
        const childContents = childWindow.webContents;
        preventUntrustedNavigation(childContents);
        platformHandlers?.registerLocalHistoryWindow(childWindow, repositoryId);
        monitorWindowRuntime(childWindow, {
            diagnostics,
            showMessageBox: (target, options) =>
                dialog.showMessageBox(target, options),
            relaunch: () => app.relaunch(),
            quit: () => app.quit(),
        });
    });
    window.webContents.on(
        "did-fail-load",
        (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
            if (!isMainFrame) return;
            console.error("[git-client] renderer load failed", {
                errorCode,
                errorDescription,
                validatedUrl,
            });
        },
    );
    window.webContents.once("did-finish-load", () => {
        if (!qaSmokeTest) return;
        console.info("[git-client] packaged-smoke-ready");
        setTimeout(() => app.quit(), 1_000);
    });
    preventUntrustedNavigation(window.webContents);

    const settings = await SettingsStore.of(
        join(app.getPath("userData"), "settings.json"),
    );
    monitorWindowRuntime(window, {
        diagnostics,
        showMessageBox: (target, options) =>
            dialog.showMessageBox(target, options),
        relaunch: () => app.relaunch(),
        quit: () => app.quit(),
    });
    const stream = new DesktopStreamHub(window);
    const menu = NativeMenuService.create(window, (command) => {
        stream.publish({ kind: "menu.command", command });
    });
    const hostingSafeStorage =
        runtimeProfile.hostingCertificatePath === null
            ? safeStorage
            : QaHostingSafeStorage.fromSeed(
                  readFileSync(runtimeProfile.hostingCertificatePath),
              );
    const hosting = ElectronHostingFoundation.of(
        FetchHostingHttpClient.of((input, init) =>
            net.fetch(input instanceof URL ? input.toString() : input, init),
        ),
        new SafeStorageHostingCredentialStore(hostingSafeStorage, settings),
    );
    platformHandlers = registerPlatformHandlers({
        window,
        settings,
        menu,
        gitUtility: utility,
        terminalUtility: terminal,
        hosting,
        diagnostics,
        runtime,
        stream,
        onWindowPresentationModeChange: (mode) => {
            presentationMode = mode;
        },
    });

    window.on("close", (event) => {
        if (!shouldRequestProjectClose(presentationMode, finishingQuit)) return;
        event.preventDefault();
        menu.dispatch({ id: "workspace.close" });
    });

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL !== undefined) {
        const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
        await window.loadURL(url.toString());
    } else {
        const url = new URL("app://git-client/");
        await window.loadURL(url.toString());
    }

    if (!window.isVisible()) window.show();

    window.on("closed", () => {
        stream.dispose();
        unregisterPlatformHandlers();
        if (mainWindow === window) mainWindow = null;
    });
    return window;
}

function reportUtilityCrash(
    kind: "gitUtilityCrash" | "terminalUtilityCrash",
    error: Error,
): void {
    const diagnostics = diagnosticsService;
    if (diagnostics !== null) {
        void diagnostics
            .recordRuntimeFailure({ kind, message: error.message })
            .catch((recordError: unknown) => {
                console.error(
                    "[git-client] failed to record utility crash",
                    recordError,
                );
            });
    }
    const window = mainWindow;
    if (
        finishingQuit ||
        utilityCrashPromptOpen ||
        window === null ||
        window.isDestroyed()
    )
        return;
    utilityCrashPromptOpen = true;
    void dialog
        .showMessageBox(window, {
            type: "error",
            title: "Git Client service stopped",
            message:
                kind === "gitUtilityCrash"
                    ? "The Git service stopped unexpectedly."
                    : "The terminal service stopped unexpectedly.",
            detail: "Pending operations were cancelled and will not be retried automatically.",
            buttons: ["Restart Git Client", "Quit"],
            defaultId: 0,
            cancelId: 1,
            noLink: true,
        })
        .then(({ response }) => {
            if (response === 0) app.relaunch();
            app.quit();
        })
        .catch((dialogError: unknown) => {
            console.error(
                "[git-client] utility crash dialog failed",
                dialogError,
            );
        })
        .finally(() => {
            utilityCrashPromptOpen = false;
        });
}

async function installQaHostingCertificate(): Promise<void> {
    const certificatePath = runtimeProfile.hostingCertificatePath;
    if (certificatePath === null) return;
    const certificate = new X509Certificate(await readFile(certificatePath));
    const expectedFingerprint = certificate.fingerprint256;
    session.defaultSession.setCertificateVerifyProc((request, callback) => {
        let fingerprint = "";
        try {
            fingerprint = new X509Certificate(request.certificate.data)
                .fingerprint256;
        } catch {
            callback(-3);
            return;
        }
        callback(
            trustsQaHostingCertificate(
                request.hostname,
                fingerprint,
                expectedFingerprint,
            )
                ? 0
                : -3,
        );
    });
}

function installProductionCsp(): void {
    if (!app.isPackaged) return;
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                "Content-Security-Policy": [
                    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
                ],
            },
        });
    });
}

async function start(): Promise<void> {
    if (!app.requestSingleInstanceLock()) {
        app.quit();
        return;
    }

    app.on("second-instance", () => {
        if (mainWindow === null) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    });

    await app.whenReady();
    installDefaultDenyPermissionPolicy(session.defaultSession);
    await installQaHostingCertificate();
    installProductionCsp();
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL === undefined)
        await registerAppProtocol(rendererRoot);
    const diagnostics = DiagnosticsService.create(runtime);
    await diagnostics.initialize();
    diagnosticsService = diagnostics;
    gitUtility = await GitUtilityClient.fork(
        join(__dirname, "git-utility.cjs"),
        {
            storageRoot: app.getPath("userData"),
            onCrash: (error) => reportUtilityCrash("gitUtilityCrash", error),
        },
    );
    terminalUtility = await TerminalUtilityClient.fork(
        join(__dirname, "terminal-utility.cjs"),
        {
            onCrash: (error) =>
                reportUtilityCrash("terminalUtilityCrash", error),
        },
    );
    mainWindow = await createMainWindow(
        gitUtility,
        terminalUtility,
        diagnostics,
    );

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length !== 0) return;
        const utility = gitUtility;
        const terminal = terminalUtility;
        const diagnostics = diagnosticsService;
        if (utility === null || terminal === null || diagnostics === null)
            return;
        void createMainWindow(utility, terminal, diagnostics)
            .then((window) => {
                mainWindow = window;
            })
            .catch((error: unknown) => {
                const message =
                    error instanceof Error
                        ? (error.stack ?? error.message)
                        : String(error);
                console.error("[git-client] window startup failed", message);
                dialog.showErrorBox(
                    "Git Client could not open a window",
                    message,
                );
            });
    });
}

async function disposeGitUtility(): Promise<void> {
    const utility = gitUtility;
    gitUtility = null;
    if (
        utility === null ||
        utility.state === "disposed" ||
        utility.state === "crashed"
    )
        return;
    await utility.dispose();
}

async function disposeTerminalUtility(): Promise<void> {
    const utility = terminalUtility;
    terminalUtility = null;
    if (
        utility === null ||
        utility.state === "disposed" ||
        utility.state === "crashed"
    )
        return;
    await utility.dispose();
}

async function disposeUtilities(): Promise<void> {
    await Promise.all([disposeGitUtility(), disposeTerminalUtility()]);
}

function launch(): void {
    const run = async (): Promise<void> => {
        try {
            await start();
        } catch (error) {
            try {
                await disposeUtilities();
            } catch (disposeError) {
                const detail =
                    disposeError instanceof Error
                        ? disposeError.message
                        : String(disposeError);
                console.error(
                    "[git-client] Git utility shutdown failed",
                    detail,
                );
            }
            const message =
                error instanceof Error
                    ? (error.stack ?? error.message)
                    : String(error);
            console.error("[git-client] startup failed", message);
            dialog.showErrorBox("Git Client could not start", message);
            app.exit(1);
        }
    };
    void run();
}

app.on("before-quit", (event) => {
    if (finishingQuit || (gitUtility === null && terminalUtility === null))
        return;
    event.preventDefault();
    finishingQuit = true;
    const finish = async (): Promise<void> => {
        try {
            await disposeUtilities();
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            console.error("[git-client] Git utility shutdown failed", message);
        } finally {
            app.quit();
        }
    };
    void finish();
});

app.on("window-all-closed", () => {
    if (shouldQuitAfterLastWindow(process.platform)) app.quit();
});
launch();
