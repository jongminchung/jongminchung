import { defineConfig } from "vite";

export default defineConfig({
  build: {
    sourcemap: true,
    rollupOptions: {
      external: ["electron", "node-pty"],
      output: {
        entryFileNames: "terminal-utility.cjs",
        format: "cjs",
      },
    },
  },
});
