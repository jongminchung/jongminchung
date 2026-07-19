import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppearanceStorage, resolveAppearance } from "./domain/appearance";
import "./styles/index.css";

const initialMode = AppearanceStorage.of(window.localStorage).load();
const initialColorScheme = resolveAppearance(
  initialMode,
  window.matchMedia("(prefers-color-scheme: dark)").matches,
);
document.documentElement.dataset.theme = initialColorScheme;
document.documentElement.style.colorScheme = initialColorScheme;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
