import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

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
    plugins: [tailwindcss()],
  }),
});
