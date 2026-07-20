import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { app, BrowserWindow, dialog, net, safeStorage, session } from "electron";
import { QA_FIXTURE_RENDERER_ARGUMENT } from "../../src/shared/contracts/ipc";
import type { WindowPresentationMode } from "../../src/shared/contracts/ipc";
import { ElectronHostingFoundation, FetchHostingHttpClient } from "../hosting";
import { DiagnosticsService } from "./diagnostics-service";
import { GitUtilityClient } from "./git-utility-client";
import { SafeStorageHostingCredentialStore } from "./hosting-credential-store";
import { NativeMenuService } from "./menu-service";
import { registerPlatformHandlers, unregisterPlatformHandlers } from "./platform-handlers";
import { registerAppProtocol, registerPrivilegedScheme } from "./protocol";
import { resolveRuntimeProfile, trustsQaHostingCertificate } from "./runtime-profile";
import { SettingsStore } from "./settings-store";
import { TerminalUtilityClient } from "./terminal-utility-client";
import {
  shouldQuitAfterLastWindow,
  shouldRequestProjectClose,
  WELCOME_TRAFFIC_LIGHT_POSITION,
} from "./window-lifecycle";

registerPrivilegedScheme();

const runtimeProfile = resolveRuntimeProfile(process.argv);
const { qaFixture, qaSmokeTest } = runtimeProfile;

app.setName("Git Client");
app.setPath("userData", join(app.getPath("appData"), runtimeProfile.name));
app.setAppLogsPath(join(app.getPath("userData"), "logs"));

function applyRendererMemoryOption(): void {
  try {
    const content = readFileSync(
      join(app.getPath("userData"), "config", "git-client.vmoptions"),
      "utf8",
    );
    const values = [...content.matchAll(/^--max-old-space-size=(\d{3,5})$/gmu)];
    const raw = values.at(-1)?.[1];
    const memory = raw === undefined ? Number.NaN : Number(raw);
    if (!Number.isInteger(memory) || memory < 256 || memory > 32_768) {
      return;
    }
    app.commandLine.appendSwitch("js-flags", `--max-old-space-size=${memory}`);
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
let finishingQuit = false;

function isLocalHistoryWindowUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.pathname !== "/local-history") return false;
    if (url.protocol === "app:" && url.host === "git-client") return true;
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL === undefined) return false;
    return url.origin === new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL).origin;
  } catch {
    return false;
  }
}

async function createMainWindow(
  utility: GitUtilityClient,
  terminal: TerminalUtilityClient,
): Promise<BrowserWindow> {
  let presentationMode: WindowPresentationMode = "welcome";
  const window = new BrowserWindow({
    width: 800,
    height: 650,
    minWidth: 800,
    minHeight: 650,
    show: false,
    backgroundColor: "#26282c",
    title: "Git Client",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: WELCOME_TRAFFIC_LIGHT_POSITION,
    webPreferences: {
      additionalArguments: qaFixture ? [QA_FIXTURE_RENDERER_ARGUMENT] : [],
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
    if (!isLocalHistoryWindowUrl(url)) return { action: "deny" };
    return {
      action: "allow",
      overrideBrowserWindowOptions: {
        parent: window,
        width: 1_080,
        height: 720,
        minWidth: 760,
        minHeight: 480,
        backgroundColor: "#26282c",
        titleBarStyle: "hiddenInset",
        trafficLightPosition: { x: 12, y: 14 },
        webPreferences: {
          additionalArguments: qaFixture ? [QA_FIXTURE_RENDERER_ARGUMENT] : [],
          preload: join(__dirname, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
          spellcheck: false,
        },
      },
    };
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
  window.webContents.on("will-navigate", (event, url) => {
    const trustedDevelopmentUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL ?? null;
    if (
      url.startsWith("app://git-client/") ||
      (trustedDevelopmentUrl !== null && url.startsWith(trustedDevelopmentUrl))
    )
      return;
    event.preventDefault();
  });

  const settings = await SettingsStore.of(join(app.getPath("userData"), "settings.json"));
  const runtime = {
    kind: "electron",
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    platform: process.platform,
    architecture: process.arch,
    qaFixture,
  } as const;
  const diagnostics = DiagnosticsService.create(runtime);
  await diagnostics.initialize();
  const menu = NativeMenuService.create(window);
  const hosting = ElectronHostingFoundation.of(
    FetchHostingHttpClient.of((input, init) =>
      net.fetch(input instanceof URL ? input.toString() : input, init),
    ),
    new SafeStorageHostingCredentialStore(safeStorage, settings),
  );
  registerPlatformHandlers({
    window,
    settings,
    menu,
    gitUtility: utility,
    terminalUtility: terminal,
    hosting,
    diagnostics,
    runtime,
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
    unregisterPlatformHandlers();
    if (mainWindow === window) mainWindow = null;
  });
  return window;
}

async function installQaHostingCertificate(): Promise<void> {
  const certificatePath = runtimeProfile.hostingCertificatePath;
  if (certificatePath === null) return;
  const certificate = new X509Certificate(await readFile(certificatePath));
  const expectedFingerprint = certificate.fingerprint256;
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    let fingerprint = "";
    try {
      fingerprint = new X509Certificate(request.certificate.data).fingerprint256;
    } catch {
      callback(-3);
      return;
    }
    callback(
      trustsQaHostingCertificate(request.hostname, fingerprint, expectedFingerprint) ? 0 : -3,
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
  await installQaHostingCertificate();
  installProductionCsp();
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL === undefined) await registerAppProtocol(rendererRoot);
  gitUtility = await GitUtilityClient.fork(join(__dirname, "git-utility.cjs"), {
    storageRoot: app.getPath("userData"),
  });
  terminalUtility = await TerminalUtilityClient.fork(join(__dirname, "terminal-utility.cjs"));
  mainWindow = await createMainWindow(gitUtility, terminalUtility);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length !== 0) return;
    const utility = gitUtility;
    const terminal = terminalUtility;
    if (utility === null || terminal === null) return;
    void createMainWindow(utility, terminal)
      .then((window) => {
        mainWindow = window;
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
        console.error("[git-client] window startup failed", message);
        dialog.showErrorBox("Git Client could not open a window", message);
      });
  });
}

async function disposeGitUtility(): Promise<void> {
  const utility = gitUtility;
  gitUtility = null;
  if (utility === null || utility.state === "disposed" || utility.state === "crashed") return;
  await utility.dispose();
}

async function disposeTerminalUtility(): Promise<void> {
  const utility = terminalUtility;
  terminalUtility = null;
  if (utility === null || utility.state === "disposed" || utility.state === "crashed") return;
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
        const detail = disposeError instanceof Error ? disposeError.message : String(disposeError);
        console.error("[git-client] Git utility shutdown failed", detail);
      }
      const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
      console.error("[git-client] startup failed", message);
      dialog.showErrorBox("Git Client could not start", message);
      app.exit(1);
    }
  };
  void run();
}

app.on("before-quit", (event) => {
  if (finishingQuit || (gitUtility === null && terminalUtility === null)) return;
  event.preventDefault();
  finishingQuit = true;
  const finish = async (): Promise<void> => {
    try {
      await disposeUtilities();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
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
