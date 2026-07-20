import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
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

const Root = window.location.pathname === "/local-history" ? LocalHistoryWindow : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
