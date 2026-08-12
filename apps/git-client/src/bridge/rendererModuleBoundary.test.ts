import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SOURCE_FILE = /\.(?:ts|tsx)$/u;
const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx)$/u;
const STATIC_IMPORT =
    /\b(?:import|export)\s+(?:type\s+)?(?:[^"'`;]*?\sfrom\s*)?["']([^"']+)["']/gmu;
const DYNAMIC_IMPORT = /\bimport\(\s*["']([^"']+)["']\s*\)/gmu;
const NODE_MODULES = new Set(
    builtinModules.flatMap((name) => [name, name.replace(/^node:/u, "")]),
);

function productionSources(directory: string): readonly string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return productionSources(path);
        return SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)
            ? [path]
            : [];
    });
}

function moduleSpecifiers(source: string): readonly string[] {
    return [
        ...source.matchAll(STATIC_IMPORT),
        ...source.matchAll(DYNAMIC_IMPORT),
    ].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
}

describe("production renderer module boundary", () => {
    it("does not import Electron or Node built-ins", () => {
        const violations = productionSources(SOURCE_ROOT).flatMap((path) =>
            moduleSpecifiers(readFileSync(path, "utf8")).flatMap(
                (specifier) => {
                    const root =
                        specifier.replace(/^node:/u, "").split("/")[0] ??
                        specifier;
                    return specifier === "electron" ||
                        specifier.startsWith("electron/") ||
                        specifier.startsWith("node:") ||
                        NODE_MODULES.has(root)
                        ? [`${relative(SOURCE_ROOT, path)} -> ${specifier}`]
                        : [];
                },
            ),
        );

        expect(violations).toEqual([]);
    });

    it("keeps Zustand slice internals behind their store composer", () => {
        const violations = productionSources(SOURCE_ROOT).flatMap((path) => {
            const sourcePath = relative(SOURCE_ROOT, path);
            return moduleSpecifiers(readFileSync(path, "utf8")).flatMap(
                (specifier) => {
                    if (!specifier.includes("/state/slices/")) return [];
                    const ownsStoreComposition =
                        sourcePath.includes("/state/") ||
                        sourcePath.endsWith("gitSessionStore.ts");
                    return ownsStoreComposition
                        ? []
                        : [`${sourcePath} -> ${specifier}`];
                },
            );
        });

        expect(violations).toEqual([]);
    });
});
