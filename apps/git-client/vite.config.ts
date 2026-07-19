import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

function replaceAstryxDevelopmentRuntime() {
  return {
    name: "astryx-production-jsx-runtime",
    apply: "build" as const,
    enforce: "pre" as const,
    transform(source: string, id: string) {
      if (!/[\\/]@astryxdesign[\\/]core[\\/]dist[\\/].*\.js$/.test(id)) return null;
      if (!source.includes("react/jsx-dev-runtime")) return null;
      return {
        code: source
          .replaceAll("jsxDEV as _jsxDEV", "jsx as _jsxDEV")
          .replaceAll("react/jsx-dev-runtime", "react/jsx-runtime"),
        map: null,
      };
    },
  };
}

export default defineConfig({
  clearScreen: false,
  plugins: [replaceAstryxDevelopmentRuntime(), react(), tailwindcss()],
  resolve: {
    preserveSymlinks: false,
  },
  server: {
    host: false,
    port: 1420,
    strictPort: true,
  },
});
