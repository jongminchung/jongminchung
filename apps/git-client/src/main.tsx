import { TooltipProvider } from "@jongminchung/ui/components/tooltip";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installDesktopPort } from "./adapters/electron/installDesktopPort";
import { installElectronTerminalService } from "./adapters/electron/installTerminalService";
import { createGitSessionComposition } from "./adapters/git-session/createGitSessionComposition";
import { installBrowserWorkbenchEventPort } from "./adapters/workbench-events/workbenchEvents";
import App from "./App";
import { installGitSessionBackend } from "./application/git-session/ports/activeGitSessionBackend";
import { RendererErrorBoundary } from "./components/RendererErrorBoundary";
import { AppearanceStorage, resolveAppearance } from "./domain/appearance";
import LocalHistoryWindow from "./LocalHistoryWindow";
import "./styles/index.css";

installBrowserWorkbenchEventPort();
installDesktopPort();
installElectronTerminalService();
const gitSession = createGitSessionComposition();
installGitSessionBackend(gitSession.backend);

const initialPreference = AppearanceStorage.of(window.localStorage).load();
const initialColorScheme = resolveAppearance(
    initialPreference,
    window.matchMedia("(prefers-color-scheme: dark)").matches,
);
document.documentElement.dataset.appearanceMode = initialPreference.syncWithOs
    ? "system"
    : initialPreference.theme;
document.documentElement.dataset.theme = initialColorScheme;
document.documentElement.style.colorScheme = initialColorScheme;

const rootElement = document.getElementById("root");
if (rootElement === null) throw new Error("Git Client root element is missing");

createRoot(rootElement).render(
    <StrictMode>
        <RendererErrorBoundary>
            <TooltipProvider>
                {window.location.pathname === "/local-history" ? (
                    <LocalHistoryWindow />
                ) : (
                    <App gitSession={gitSession} />
                )}
            </TooltipProvider>
        </RendererErrorBoundary>
    </StrictMode>,
);
