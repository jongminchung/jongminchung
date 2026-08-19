import { resolve } from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";

export default defineConfig({
    clearScreen: false,
    plugins: [
        react(),
        babel({
            presets: [reactCompilerPreset({ compilationMode: "annotation" })],
        }),
        tailwindcss(),
    ],
    resolve: {
        alias: [
            { find: "@", replacement: resolve(import.meta.dirname, "src") },
        ],
        conditions: ["source", ...defaultClientConditions],
        dedupe: ["react", "react-dom"],
        preserveSymlinks: false,
    },
    server: {
        host: false,
        port: 1420,
        strictPort: true,
    },
});
