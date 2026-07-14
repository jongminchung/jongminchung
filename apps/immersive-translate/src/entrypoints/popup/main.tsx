import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";

const immersiveTheme = Object.freeze({ ...neutralTheme, icons: {} });

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Theme theme={immersiveTheme} mode="system">
      <App />
    </Theme>
  </React.StrictMode>,
);
