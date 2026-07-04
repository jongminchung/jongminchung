import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LocalSourceAlias } from "./package-map.js";
import {
  createPackageExportAliases,
  createTsconfigPaths,
  createViteResolveAliases,
  loadWorkspacePackageMap,
} from "./package-map.js";

const websiteSourceAlias = [
  {
    find: /^@\//,
    replacementPath: "website/src",
    tsconfigKey: "@/*",
    tsconfigTarget: "./website/src/*",
  },
] satisfies readonly LocalSourceAlias[];

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function withWorkspace<T>(callback: (rootDir: string) => Promise<T>): Promise<T> {
  const rootDir = await mkdtemp(join(tmpdir(), "package-map-"));
  try {
    mkdirSync(join(rootDir, "packages", "tooling"), { recursive: true });
    mkdirSync(join(rootDir, "packages", "ui"), { recursive: true });
    mkdirSync(join(rootDir, "website"), { recursive: true });

    writeJson(join(rootDir, "package.json"), {
      private: true,
      workspaces: ["website", "packages/*"],
    });
    writeJson(join(rootDir, "packages", "tooling", "package.json"), {
      name: "@scope/tooling",
      exports: {
        "./oxfmt": {
          source: "./src/oxfmt/index.ts",
          types: "./dist/oxfmt/index.d.ts",
          default: "./dist/oxfmt/index.js",
        },
        "./package.json": "./package.json",
      },
    });
    writeJson(join(rootDir, "packages", "ui", "package.json"), {
      name: "@scope/ui",
      exports: {
        ".": {
          source: "./src/index.ts",
          types: "./dist/index.d.ts",
          default: "./dist/index.js",
        },
        "./button": {
          source: "./src/button.tsx",
          types: "./dist/button.d.ts",
          default: "./dist/button.js",
        },
        "./styles.css": "./src/styles.css",
        "./package.json": "./package.json",
      },
    });
    writeJson(join(rootDir, "website", "package.json"), {
      name: "@scope/website",
      private: true,
    });

    return await callback(rootDir);
  } finally {
    await rm(rootDir, { force: true, recursive: true });
  }
}

describe("workspace package map", () => {
  it("loads package identities from workspace package manifests", async () => {
    await withWorkspace(async (rootDir) => {
      const packageMap = loadWorkspacePackageMap({ rootDir });

      expect(
        packageMap.packages.map((workspacePackage: { name: string }) => workspacePackage.name),
      ).toEqual(["@scope/website", "@scope/tooling", "@scope/ui"]);
    });
  });

  it("derives TypeScript paths from exported package subpaths", async () => {
    await withWorkspace(async (rootDir) => {
      expect(createTsconfigPaths({ rootDir })).toEqual({
        "@scope/tooling/oxfmt": ["./packages/tooling/src/oxfmt/index.ts"],
        "@scope/ui": ["./packages/ui/src/index.ts"],
        "@scope/ui/button": ["./packages/ui/src/button.tsx"],
        "@scope/ui/styles.css": ["./packages/ui/src/styles.css"],
      });
    });
  });

  it("uses the current working directory as the default workspace root", async () => {
    await withWorkspace(async (rootDir) => {
      const previousCwd = process.cwd();
      try {
        process.chdir(rootDir);

        expect(createTsconfigPaths()).toEqual({
          "@scope/tooling/oxfmt": ["./packages/tooling/src/oxfmt/index.ts"],
          "@scope/ui": ["./packages/ui/src/index.ts"],
          "@scope/ui/button": ["./packages/ui/src/button.tsx"],
          "@scope/ui/styles.css": ["./packages/ui/src/styles.css"],
        });
      } finally {
        process.chdir(previousCwd);
      }
    });
  });

  it("keeps Vite aliases exact to manifest exports", async () => {
    await withWorkspace(async (rootDir) => {
      const aliases = createViteResolveAliases({ rootDir }).map((alias) => ({
        find: String(alias.find),
        replacement: alias.replacement.replace(rootDir, "<root>"),
      }));

      expect(aliases).toEqual([
        {
          find: "/^@scope\\/tooling\\/oxfmt$/",
          replacement: "<root>/packages/tooling/src/oxfmt/index.ts",
        },
        { find: "/^@scope\\/ui$/", replacement: "<root>/packages/ui/src/index.ts" },
        {
          find: "/^@scope\\/ui\\/button$/",
          replacement: "<root>/packages/ui/src/button.tsx",
        },
        {
          find: "/^@scope\\/ui\\/styles\\.css$/",
          replacement: "<root>/packages/ui/src/styles.css",
        },
      ]);
    });
  });

  it("adds repo-local aliases only when the consuming repo provides them", async () => {
    await withWorkspace(async (rootDir) => {
      expect(createTsconfigPaths({ rootDir, localSourceAliases: websiteSourceAlias })).toEqual({
        "@/*": ["./website/src/*"],
        "@scope/tooling/oxfmt": ["./packages/tooling/src/oxfmt/index.ts"],
        "@scope/ui": ["./packages/ui/src/index.ts"],
        "@scope/ui/button": ["./packages/ui/src/button.tsx"],
        "@scope/ui/styles.css": ["./packages/ui/src/styles.css"],
      });

      const aliases = createViteResolveAliases({
        rootDir,
        localSourceAliases: websiteSourceAlias,
      }).map((alias) => ({
        find: String(alias.find),
        replacement: alias.replacement.replace(rootDir, "<root>"),
      }));

      expect(aliases[0]).toEqual({ find: "/^@\\//", replacement: "<root>/website/src/" });
    });
  });

  it("exposes only package manifest exports as package aliases", async () => {
    await withWorkspace(async (rootDir) => {
      const specifiers = createPackageExportAliases({ rootDir }).map(
        (alias: { specifier: string }) => alias.specifier,
      );

      expect(specifiers).toContain("@scope/ui");
      expect(specifiers).toContain("@scope/ui/button");
      expect(specifiers).not.toContain("@scope/ui/internal");
      expect(specifiers).not.toContain("@scope/ui/package.json");
      expect(specifiers).not.toContain("@scope/website");
    });
  });
});
