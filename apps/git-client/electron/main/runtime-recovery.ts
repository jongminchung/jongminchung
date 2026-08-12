import type { BrowserWindow, MessageBoxOptions } from "electron";
import type { DiagnosticsService, RuntimeFailure } from "./diagnostics-service";

interface RuntimeRecoveryDependencies {
    readonly diagnostics: Pick<DiagnosticsService, "recordRuntimeFailure">;
    readonly showMessageBox: (
        window: BrowserWindow,
        options: MessageBoxOptions,
    ) => Promise<{ readonly response: number }>;
    readonly quit: () => void;
    readonly relaunch: () => void;
}

export function monitorWindowRuntime(
    window: BrowserWindow,
    dependencies: RuntimeRecoveryDependencies,
): void {
    let promptOpen = false;

    const record = (failure: RuntimeFailure): void => {
        void dependencies.diagnostics
            .recordRuntimeFailure(failure)
            .catch((error: unknown) => {
                console.error(
                    "[git-client] failed to record runtime failure",
                    error,
                );
            });
    };
    const prompt = async (
        failure: RuntimeFailure,
        options: MessageBoxOptions,
    ): Promise<void> => {
        record(failure);
        if (promptOpen || window.isDestroyed()) return;
        promptOpen = true;
        try {
            const { response } = await dependencies.showMessageBox(
                window,
                options,
            );
            if (failure.kind === "rendererUnresponsive" && response === 0)
                return;
            if (response === 0 && failure.kind === "rendererGone") {
                if (!window.isDestroyed()) window.webContents.reload();
                return;
            }
            const restart =
                (failure.kind === "rendererGone" && response === 1) ||
                (failure.kind === "preloadError" && response === 0) ||
                (failure.kind === "rendererUnresponsive" && response === 1);
            if (restart) {
                dependencies.relaunch();
                dependencies.quit();
                return;
            }
            if (!window.isDestroyed()) window.close();
        } finally {
            promptOpen = false;
        }
    };

    window.webContents.on("render-process-gone", (_event, details) => {
        void prompt(
            {
                kind: "rendererGone",
                message: "Renderer process exited unexpectedly.",
                details: {
                    reason: details.reason,
                    exitCode: details.exitCode,
                },
            },
            {
                type: "error",
                title: "Git Client window stopped",
                message: "This window stopped unexpectedly.",
                detail: "No pending Git operation will be retried automatically.",
                buttons: [
                    "Reload Window",
                    "Restart Git Client",
                    "Close Window",
                ],
                defaultId: 0,
                cancelId: 2,
                noLink: true,
            },
        );
    });

    window.webContents.on("preload-error", (_event, preloadPath, error) => {
        void prompt(
            {
                kind: "preloadError",
                message: error.message,
                details: { preload: preloadPath },
            },
            {
                type: "error",
                title: "Git Client failed to initialize",
                message: "The secure window bridge could not be loaded.",
                detail: "Restart the application or close this window.",
                buttons: ["Restart Git Client", "Close Window"],
                defaultId: 0,
                cancelId: 1,
                noLink: true,
            },
        );
    });

    window.on("unresponsive", () => {
        void prompt(
            {
                kind: "rendererUnresponsive",
                message: "Renderer window became unresponsive.",
            },
            {
                type: "warning",
                title: "Git Client is not responding",
                message: "This window is not responding.",
                detail: "Wait for it to recover or restart the application explicitly.",
                buttons: ["Wait", "Restart Git Client", "Close Window"],
                defaultId: 0,
                cancelId: 0,
                noLink: true,
            },
        );
    });
}
