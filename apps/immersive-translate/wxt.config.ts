import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

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
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Tobi Immersive Translate",
    description: "Translate webpages and video captions with a local endpoint.",
    permissions: ["storage", "tabs", "activeTab", "scripting"],
    host_permissions: ["http://*/*", "https://*/*"],
    action: {
      default_title: "Tobi Immersive Translate",
    },
  },
  vite: () => ({
    plugins: [replaceAstryxDevelopmentRuntime(), tailwindcss()],
  }),
});
