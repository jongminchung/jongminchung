import { defineConfig } from "vite";

export default defineConfig({
    define: {
        "process.env.GIT_CLIENT_GITHUB_OAUTH_CLIENT_ID": JSON.stringify(
            process.env.GIT_CLIENT_GITHUB_OAUTH_CLIENT_ID?.trim() ?? "",
        ),
        "process.env.GIT_CLIENT_GITLAB_OAUTH_CLIENT_ID": JSON.stringify(
            process.env.GIT_CLIENT_GITLAB_OAUTH_CLIENT_ID?.trim() ?? "",
        ),
        "process.env.GIT_CLIENT_GITLAB_OAUTH_REDIRECT_URI": JSON.stringify(
            process.env.GIT_CLIENT_GITLAB_OAUTH_REDIRECT_URI?.trim() ?? "",
        ),
    },
    build: {
        sourcemap: true,
        rollupOptions: {
            external: ["electron", "node-pty"],
            output: {
                entryFileNames: "main.cjs",
                format: "cjs",
            },
        },
    },
});
