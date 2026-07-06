import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Tobi Immersive Translate",
    description: "Translate webpages, captions, DOCX, and EPUB documents with a local endpoint.",
    permissions: ["storage", "tabs", "activeTab", "scripting"],
    host_permissions: [
      "http://127.0.0.1/*",
      "http://localhost/*",
      "https://local-translation.test/*",
      "https://go.dev/*",
      "https://www.youtube.com/*",
      "https://youtube.com/*",
      "https://m.youtube.com/*",
    ],
    action: {
      default_title: "Tobi Immersive Translate",
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
