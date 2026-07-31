import { defineConfig } from "vite";
import { rejectNodeBuiltinsInSandboxedPreload } from "./vite.preload.config";

export default defineConfig({
  plugins: [rejectNodeBuiltinsInSandboxedPreload()],
  build: {
    sourcemap: true,
    rollupOptions: {
      external: ["electron"],
      output: {
        entryFileNames: "local-history-preload.cjs",
        format: "cjs",
      },
    },
  },
});
