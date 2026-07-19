import { defineConfig } from "vite";

export default defineConfig({
  build: {
    sourcemap: true,
    rollupOptions: {
      external: ["electron", "node-pty", "@vscode/ripgrep"],
      output: {
        entryFileNames: "main.cjs",
        format: "cjs",
      },
    },
  },
});
