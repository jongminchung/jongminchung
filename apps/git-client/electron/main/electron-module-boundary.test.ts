import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ELECTRON_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SOURCE_ROOT = resolve(ELECTRON_ROOT, "../src");
const SHARED_CONTRACTS_ROOT = join(SOURCE_ROOT, "shared/contracts");
const COMMAND_MANIFEST = join(SOURCE_ROOT, "command-manifest.json");
const SOURCE_FILE = /\.ts$/u;
const TEST_FILE = /\.test\.ts$/u;
const STATIC_IMPORT =
    /\b(?:import|export)\s+(?:type\s+)?(?:[^"'`;]*?\sfrom\s*)?["']([^"']+)["']/gmu;

function productionSources(directory: string): readonly string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return productionSources(path);
        return SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)
            ? [path]
            : [];
    });
}

describe("Electron module 경계", () => {
    it("[실패] renderer 구현에 의존하지 않음", () => {
        const violations = productionSources(ELECTRON_ROOT).flatMap((path) =>
            [...readFileSync(path, "utf8").matchAll(STATIC_IMPORT)].flatMap(
                (match) => {
                    const specifier = match[1];
                    if (specifier === undefined || !specifier.startsWith("."))
                        return [];
                    const target = resolve(dirname(path), specifier);
                    const entersRenderer =
                        target === SOURCE_ROOT ||
                        target.startsWith(`${SOURCE_ROOT}/`);
                    const allowed =
                        target === COMMAND_MANIFEST ||
                        target === SHARED_CONTRACTS_ROOT ||
                        target.startsWith(`${SHARED_CONTRACTS_ROOT}/`);
                    return entersRenderer && !allowed
                        ? [`${relative(ELECTRON_ROOT, path)} -> ${specifier}`]
                        : [];
                },
            ),
        );

        expect(violations).toEqual([]);
    });
});
