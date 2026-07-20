import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [{ find: "@", replacement: resolve(import.meta.dirname, "src") }],
    preserveSymlinks: false,
  },
  server: {
    host: false,
    port: 1420,
    strictPort: true,
  },
});
