import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const packageRoot = dirname(fileURLToPath(import.meta.url));

interface PackageManifest {
    readonly dependencies: Readonly<Record<string, string>>;
    readonly exports: Readonly<Record<string, unknown>>;
    readonly imports: Readonly<Record<string, string>>;
    readonly name: string;
    readonly private?: boolean;
    readonly version: string;
}

describe("@jongminchung/ui package contract", () => {
    test("publishes source-first explicit subpaths without a root barrel", () => {
        const manifest = JSON.parse(
            readFileSync(join(packageRoot, "package.json"), "utf8"),
        ) as PackageManifest;

        expect(manifest.name).toBe("@jongminchung/ui");
        expect(manifest.version).toBe("1.0.0");
        expect(manifest.private).toBeUndefined();
        expect(manifest.imports).toEqual({
            "#components/*": "./src/components/*.tsx",
            "#lib/*": "./src/lib/*.ts",
        });
        expect(manifest.exports).toEqual({
            "./globals.css": "./src/styles/globals.css",
            "./theme.css": "./src/styles/theme.css",
            "./tokens.css": "./src/styles/tokens.css",
            "./lib/*": {
                source: "./src/lib/*.ts",
                types: "./dist/lib/*.d.ts",
                import: "./dist/lib/*.js",
            },
            "./components/*": {
                source: "./src/components/*.tsx",
                types: "./dist/components/*.d.ts",
                import: "./dist/components/*.js",
            },
            "./package.json": "./package.json",
        });
        expect(existsSync(join(packageRoot, "src", "index.ts"))).toBe(false);
    });

    test("keeps application and scaffolding dependencies out of the runtime package", () => {
        const manifest = JSON.parse(
            readFileSync(join(packageRoot, "package.json"), "utf8"),
        ) as PackageManifest;
        const internalDependencies = Object.entries(
            manifest.dependencies,
        ).filter(
            ([name, version]) =>
                name.startsWith("@jongminchung/") ||
                version.startsWith("workspace:"),
        );

        expect(manifest.dependencies.shadcn).toBeUndefined();
        expect(internalDependencies).toEqual([]);
    });
});
