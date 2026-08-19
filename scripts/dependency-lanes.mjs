import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const lanes = {
    framework: [
        "@mdx-js/mdx",
        "@mdx-js/react",
        "@next/mdx",
        "@tanstack/react-query",
        "next",
        "react",
        "react-dom",
    ],
    ui: [
        "@base-ui/react",
        "@excalidraw/excalidraw",
        "@tailwindcss/postcss",
        "@tailwindcss/vite",
        "@tanstack/react-virtual",
        "class-variance-authority",
        "clsx",
        "cmdk",
        "lucide-react",
        "motion",
        "shadcn",
        "tailwind-merge",
        "tailwindcss",
        "tw-animate-css",
    ],
    desktop: [
        "@codemirror/commands",
        "@codemirror/lang-css",
        "@codemirror/lang-html",
        "@codemirror/lang-java",
        "@codemirror/lang-javascript",
        "@codemirror/lang-json",
        "@codemirror/lang-python",
        "@codemirror/language",
        "@codemirror/merge",
        "@codemirror/search",
        "@codemirror/state",
        "@codemirror/view",
        "@electron-forge/cli",
        "@electron-forge/plugin-fuses",
        "@electron-forge/plugin-vite",
        "@electron-forge/shared-types",
        "@electron/fuses",
        "@trpc/client",
        "@trpc/server",
        "@xterm/addon-fit",
        "@xterm/xterm",
        "ds-store",
        "electron",
        "fflate",
        "macos-alias",
        "node-gyp",
        "node-pty",
        "uuid",
        "zod",
        "zustand",
    ],
    test: [
        "@axe-core/playwright",
        "@playwright/test",
        "@vitest/coverage-v8",
        "vitest",
    ],
    tooling: [
        "@types/mdx",
        "@types/node",
        "@types/react",
        "@types/react-dom",
        "@vitejs/plugin-react",
        "esbuild",
        "gray-matter",
        "hast-util-to-string",
        "npm-check-updates",
        "oxfmt",
        "oxlint",
        "oxlint-tsgolint",
        "postcss",
        "rehype-slug",
        "remark-frontmatter",
        "remark-gfm",
        "remark-kroki",
        "remark-mdx-frontmatter",
        "typescript",
        "unist-util-visit",
        "vite",
    ],
};

const arguments_ = process.argv.slice(2);
const update = arguments_.includes("--update");
const inventoryOnly = arguments_.includes("--inventory");
const lane = arguments_.find((argument) => !argument.startsWith("--"));

const packageFiles = [
    "package.json",
    "apps/git-client/package.json",
    "apps/web/package.json",
    "packages/tooling/package.json",
    "packages/ui/package.json",
];
const directDependencies = new Set();
for (const packageFile of packageFiles) {
    const manifest = JSON.parse(await readFile(resolve(packageFile), "utf8"));
    for (const section of [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
    ]) {
        for (const dependency of Object.keys(manifest[section] ?? {})) {
            if (!dependency.startsWith("@jongminchung/"))
                directDependencies.add(dependency);
        }
    }
}

const owners = new Map();
for (const [laneName, dependencies] of Object.entries(lanes)) {
    for (const dependency of dependencies) {
        const previous = owners.get(dependency);
        if (previous)
            throw new Error(
                `${dependency} is assigned to both ${previous} and ${laneName}`,
            );
        owners.set(dependency, laneName);
    }
}
const unmapped = [...directDependencies].filter(
    (dependency) => !owners.has(dependency),
);
if (unmapped.length > 0)
    throw new Error(`Unmapped direct dependencies: ${unmapped.join(", ")}`);

if (inventoryOnly) {
    process.stdout.write(`${JSON.stringify(lanes, null, 2)}\n`);
    process.exit(0);
}
if (!lane || !lanes[lane]) {
    throw new Error(
        `Choose one dependency lane: ${Object.keys(lanes).join(", ")}`,
    );
}

const ncuArguments = [
    "exec",
    "npm-check-updates",
    "--workspaces",
    "--target",
    "latest",
    "--packageManager",
    "pnpm",
    "--filter",
    lanes[lane].join(","),
];
if (update) ncuArguments.push("--upgrade");

process.stdout.write(
    `Dependency lane: ${lane}\nPackages: ${lanes[lane].join(", ")}\n`,
);
const ncu = spawnSync("pnpm", ncuArguments, { stdio: "inherit" });
if (ncu.status !== 0) process.exit(ncu.status ?? 1);
if (update) {
    const install = spawnSync("pnpm", ["install"], { stdio: "inherit" });
    process.exit(install.status ?? 1);
}
