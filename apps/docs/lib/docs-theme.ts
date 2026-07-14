import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";

export const docsTheme = defineTheme({
  name: "jongmin-docs",
  extends: neutralTheme,
  typography: {
    scale: { base: 14, ratio: 1.2 },
    body: {
      family: "var(--font-inter)",
      fallbacks: "-apple-system, BlinkMacSystemFont, sans-serif",
      weight: "normal",
    },
    heading: {
      family: "var(--font-inter-tight)",
      fallbacks: "var(--font-inter), sans-serif",
      weight: "medium",
      weights: { 1: "medium", 2: "medium", 3: "medium" },
    },
    code: {
      family: "var(--font-dm-mono)",
      fallbacks: '"SFMono-Regular", Consolas, monospace',
    },
  },
  radius: { base: 4, multiplier: 1 },
  motion: { fast: 120, medium: 300, slow: 600, ratio: 0.75 },
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
