import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";

export const docsTheme = defineTheme({
  name: "jongmin-docs",
  extends: neutralTheme,
  color: {
    accent: "#7c3aed",
    neutralStyle: "cool",
    contrast: "standard",
  },
  typography: {
    scale: { base: 15, ratio: 1.2 },
    body: {
      family: "var(--font-inter)",
      fallbacks: "-apple-system, BlinkMacSystemFont, sans-serif",
      weight: "normal",
    },
    heading: {
      family: "var(--font-inter-tight)",
      fallbacks: "var(--font-inter), sans-serif",
      weight: "semibold",
      weights: { 1: "bold", 2: "semibold", 3: "semibold" },
    },
    code: {
      family: "var(--font-dm-mono)",
      fallbacks: '"SFMono-Regular", Consolas, monospace',
    },
  },
  radius: { base: 4, multiplier: 1 },
  motion: { fast: 120, medium: 300, slow: 600, ratio: 0.75 },
  tokens: {
    "--color-accent": ["#7c3aed", "#a78bfa"],
    "--color-accent-muted": ["#f1eafe", "#2c1f45"],
    "--color-background-body": ["#fbfbfd", "#0b0b10"],
    "--color-background-surface": ["#ffffff", "#12121a"],
    "--color-background-card": ["#ffffff", "#161620"],
    "--color-background-muted": ["#f5f4f8", "#1b1b26"],
    "--color-border": ["#e6e4ec", "#30303d"],
    "--color-border-emphasized": ["#cbc7d6", "#4b4b5c"],
    "--color-text-primary": ["#19171f", "#f5f3fa"],
    "--color-text-secondary": ["#666170", "#aaa5b8"],
    "--color-warning": ["#f2c94c", "#fdcf4f"],
    "--radius-inner": "4px",
    "--radius-element": "4px",
    "--radius-container": "4px",
  },
  components: {
    card: {
      base: {
        borderWidth: "1px",
        boxShadow: "none",
        transition: "border-color 300ms ease, transform 300ms ease",
      },
    },
  },
});
