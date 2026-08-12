import { TooltipProvider } from "@jongminchung/ui/components/tooltip";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { RendererErrorBoundary } from "./components/RendererErrorBoundary";
import { AppearanceStorage, resolveAppearance } from "./domain/appearance";
import LocalHistoryWindow from "./LocalHistoryWindow";
import "./styles/index.css";

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

const Root =
    window.location.pathname === "/local-history" ? LocalHistoryWindow : App;
const rootElement = document.getElementById("root");
if (rootElement === null) throw new Error("Git Client root element is missing");

createRoot(rootElement).render(
    <StrictMode>
        <RendererErrorBoundary>
            <TooltipProvider>
                <Root />
            </TooltipProvider>
        </RendererErrorBoundary>
    </StrictMode>,
);
