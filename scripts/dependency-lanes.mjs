import { spawnSync } from "node:child_process";
import { glob, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const lanes = {
  framework: [
    "@mdx-js/mdx",
    "@mdx-js/react",
    "@next/mdx",
    "@tanstack/react-query",
    "babel-plugin-react-compiler",
    "fumadocs-core",
    "fumadocs-mdx",
    "fumadocs-ui",
    "next",
    "next-intl",
    "next-themes",
    "react",
    "react-dom",
    "zod",
  ],
  ui: [
    "@base-ui/react",
    "@excalidraw/excalidraw",
    "@tailwindcss/postcss",
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
  test: [
    "@axe-core/playwright",
    "@playwright/test",
    "@vitest/coverage-v8",
    "happy-dom",
    "vitest",
  ],
  tooling: [
    "@types/mdast",
    "@types/mdx",
    "@types/node",
    "@types/react",
    "@types/react-dom",
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
  ],
};

const arguments_ = process.argv.slice(2);
const update = arguments_.includes("--update");
const inventoryOnly = arguments_.includes("--inventory");
const lane = arguments_.find((argument) => !argument.startsWith("--"));

const rootManifest = JSON.parse(
  await readFile(resolve("package.json"), "utf8"),
);
const workspacePackageFiles = new Set();
for (const workspacePattern of rootManifest.workspaces ?? []) {
  for await (const packageFile of glob(`${workspacePattern}/package.json`))
    workspacePackageFiles.add(packageFile);
}
const packageFiles = ["package.json", ...workspacePackageFiles].sort(
  (left, right) => left.localeCompare(right),
);
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
