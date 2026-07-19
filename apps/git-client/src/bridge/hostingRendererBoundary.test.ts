import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const STATIC_IMPORT =
    /\b(?:import|export)\s+(?:type\s+)?(?:[^"'`;]*?\sfrom\s*)?["']([^"']+)["']/gmu;
const DYNAMIC_IMPORT = /\bimport\(\s*["']([^"']+)["']\s*\)/gmu;

function relativeModule(sourcePath: string, specifier: string): string | null {
    if (!specifier.startsWith(".")) return null;
    const unresolved = resolve(dirname(sourcePath), specifier);
    for (const candidate of [
        `${unresolved}.ts`,
        `${unresolved}.tsx`,
        join(unresolved, "index.ts"),
        join(unresolved, "index.tsx"),
    ]) {
        if (existsSync(candidate)) return candidate;
    }
    throw new Error(
        `Could not resolve renderer import ${specifier} from ${sourcePath}`,
    );
}

function moduleSpecifiers(source: string): readonly string[] {
    return [
        ...source.matchAll(STATIC_IMPORT),
        ...source.matchAll(DYNAMIC_IMPORT),
    ].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
}

function rendererGraph(
    entryPaths: readonly string[],
): ReadonlyMap<string, string> {
    const sources = new Map<string, string>();
    const pending = [...entryPaths];
    while (pending.length > 0) {
        const path = pending.pop();
        if (path === undefined || sources.has(path)) continue;
        const source = readFileSync(path, "utf8");
        sources.set(path, source);
        for (const specifier of moduleSpecifiers(source)) {
            if (specifier.startsWith("node:")) {
                throw new Error(`Renderer module ${path} imports ${specifier}`);
            }
            const dependency = relativeModule(path, specifier);
            if (dependency !== null && dependency.startsWith(APP_ROOT))
                pending.push(dependency);
        }
    }
    return sources;
}

describe("hosting renderer and preload boundaries", () => {
    it("does not reach Electron's main-only hosting barrel or node built-ins", () => {
        const sources = rendererGraph([
            join(APP_ROOT, "electron/preload/index.ts"),
            join(APP_ROOT, "src/bridge/createHostingBridge.ts"),
            join(APP_ROOT, "src/components/hosting-persistence.ts"),
        ]);

        expect([...sources.keys()]).not.toContain(
            join(APP_ROOT, "electron/hosting/index.ts"),
        );
    });
});
