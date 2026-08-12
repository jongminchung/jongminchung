import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const sourceRoot = join(packageRoot, "src");
const contractPath = join(sourceRoot, "styles", "tokens.css");
const defaultThemePath = join(sourceRoot, "styles", "theme.css");
const globalsPath = join(sourceRoot, "styles", "globals.css");
const packageManifestPath = join(packageRoot, "package.json");

const coreColorTokens = [
    "background",
    "foreground",
    "card",
    "card-foreground",
    "popover",
    "popover-foreground",
    "primary",
    "primary-foreground",
    "secondary",
    "secondary-foreground",
    "muted",
    "muted-foreground",
    "accent",
    "accent-foreground",
    "destructive",
    "destructive-foreground",
    "border",
    "input",
    "ring",
    "chart-1",
    "chart-2",
    "chart-3",
    "chart-4",
    "chart-5",
    "sidebar",
    "sidebar-foreground",
    "sidebar-primary",
    "sidebar-primary-foreground",
    "sidebar-accent",
    "sidebar-accent-foreground",
    "sidebar-border",
    "sidebar-ring",
    "overlay",
] as const;

interface ThemeScope {
    readonly body: string;
    readonly selector: string;
}

function capture(match: RegExpMatchArray, index: number): string {
    const value = match[index];
    if (value === undefined)
        throw new Error(`Missing regular expression capture ${index}`);
    return value;
}

function relativePath(path: string): string {
    return relative(packageRoot, path).split(sep).join("/");
}

function sourceFiles(directory: string): readonly string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        if (!new Set([".css", ".ts", ".tsx"]).has(extname(entry.name)))
            return [];
        return /\.test\.[^.]+$/u.test(entry.name) ? [] : [path];
    });
}

function declarations(contents: string): ReadonlySet<string> {
    return new Set(
        Array.from(contents.matchAll(/--([\w-]+)\s*:/g), (match) =>
            capture(match, 1),
        ),
    );
}

function usedVariables(contents: string): ReadonlySet<string> {
    return new Set(
        Array.from(contents.matchAll(/var\(--([\w-]+)/g), (match) =>
            capture(match, 1),
        ),
    );
}

function assignedVariables(contents: string): ReadonlySet<string> {
    return new Set([
        ...declarations(contents),
        ...Array.from(contents.matchAll(/["']--([\w-]+)["']\s*:/g), (match) =>
            capture(match, 1),
        ),
    ]);
}

function themeScopes(contents: string): readonly ThemeScope[] {
    return Array.from(
        contents.matchAll(
            /(:where\(:root(?:\[data-theme=["'][^"']+["']\])?\))\s*\{([^}]*)\}/g,
        ),
        (match) => ({ selector: capture(match, 1), body: capture(match, 2) }),
    );
}

function violations(
    pattern: RegExp,
    files: readonly string[],
): readonly string[] {
    return files.flatMap((file) =>
        readFileSync(file, "utf8")
            .split("\n")
            .flatMap((line, index) =>
                pattern.test(line)
                    ? [`${relativePath(file)}:${index + 1}`]
                    : [],
            ),
    );
}

describe("@jongminchung/ui theme contract", () => {
    test("maps the complete semantic vocabulary without owning theme values", () => {
        const contract = readFileSync(contractPath, "utf8");
        const packageManifest = JSON.parse(
            readFileSync(packageManifestPath, "utf8"),
        );
        const colorMappings = Array.from(
            contract.matchAll(/--color-([\w-]+):\s*var\(--([\w-]+)\)/g),
            (match) => [capture(match, 1), capture(match, 2)],
        );

        expect(colorMappings).toEqual(
            coreColorTokens.map((token) => [token, token]),
        );
        expect(contract).toContain("--font-sans: var(--font-family-body)");
        expect(contract).toContain("--font-mono: var(--font-family-code)");
        expect(contract).toContain("--radius-xs: calc(var(--radius) * 0.4)");
        expect(contract).toContain("--radius-full: 9999px");
        expect(contract).toContain("--shadow-xs: var(--elevation-low)");
        expect(contract).toContain("--shadow-md: var(--elevation-medium)");
        expect(contract).toContain("--shadow-xl: var(--elevation-high)");
        expect(contract).not.toContain(":root");
        expect(packageManifest).toMatchObject({
            exports: {
                "./globals.css": "./src/styles/globals.css",
                "./theme.css": "./src/styles/theme.css",
                "./tokens.css": "./src/styles/tokens.css",
            },
        });
    });

    test("provides complete low-specificity light and dark defaults", () => {
        const defaultTheme = readFileSync(defaultThemePath, "utf8");
        const scopes = themeScopes(defaultTheme);
        const light = scopes.find(
            ({ selector }) => selector === ":where(:root)",
        );
        const dark = scopes.find(
            ({ selector }) => selector === ':where(:root[data-theme="dark"])',
        );

        expect(light).toBeDefined();
        expect(dark).toBeDefined();
        expect(defaultTheme).not.toContain("!important");
        expect(defaultTheme).not.toMatch(/#[\da-f]{3,8}\b/iu);

        for (const scope of [light, dark]) {
            const definedTokens = declarations(scope?.body ?? "");
            expect(
                coreColorTokens.filter((token) => !definedTokens.has(token)),
                scope?.selector,
            ).toEqual([]);
        }

        const lightTokens = declarations(light?.body ?? "");
        expect(
            [
                "radius",
                "font-family-body",
                "font-family-code",
                "elevation-low",
                "elevation-medium",
                "elevation-high",
            ].filter((token) => !lightTokens.has(token)),
        ).toEqual([]);
    });

    test("keeps the Tailwind entry point declarative and accessible", () => {
        const globals = readFileSync(globalsPath, "utf8");

        expect(globals).toContain('@import "tailwindcss"');
        expect(globals).toContain('@import "tw-animate-css"');
        expect(globals).toContain('@import "./theme.css"');
        expect(globals).toContain('@import "./tokens.css"');
        expect(globals.indexOf('@import "./theme.css"')).toBeLessThan(
            globals.indexOf('@import "./tokens.css"'),
        );
        for (const variant of [
            "data-open",
            "data-closed",
            "data-checked",
            "data-selected",
            "data-disabled",
            "data-active",
            "data-horizontal",
            "data-vertical",
        ]) {
            expect(globals).toContain(`@custom-variant ${variant}`);
        }
        expect(globals).toContain("@utility no-scrollbar");
        expect(globals).toContain('@source "../**/*.{ts,tsx}"');
        expect(globals).toContain("@apply border-border outline-ring/50");
        expect(globals).toContain("@apply bg-background text-foreground");
        expect(globals).toContain("@media (prefers-reduced-motion: reduce)");
    });

    test("provides every CSS variable consumed by package source", () => {
        const files = sourceFiles(sourceRoot);
        const providers = new Set(
            files.flatMap((file) => [
                ...assignedVariables(readFileSync(file, "utf8")),
            ]),
        );
        const consumers = new Set(
            files.flatMap((file) => [
                ...usedVariables(readFileSync(file, "utf8")),
            ]),
        );

        expect(
            [...consumers].filter((token) => !providers.has(token)).sort(),
        ).toEqual([]);
    });

    test("keeps shared UI on semantic colors and radii", () => {
        const files = sourceFiles(sourceRoot);
        const themeValueFiles = files.filter(
            (file) => file !== defaultThemePath,
        );
        const literalColor =
            /#[\da-f]{3,8}\b|(?:hsla?|lab|lch|oklab|oklch|rgba?)\s*\(/iu;
        const paletteUtility =
            /(?:^|[\s"'`])(?:[\w-]+:)*(?:accent|bg|border|caret|decoration|divide|fill|from|outline|placeholder|ring|shadow|stroke|text|to|via)-(?:amber|black|blue|cyan|emerald|fuchsia|gray|green|indigo|lime|neutral|orange|pink|purple|red|rose|sky|slate|stone|teal|violet|white|yellow|zinc)(?:-\d{2,3})?(?:\/\d{1,3})?\b/iu;
        const legacyToken =
            /--(?:blue(?:-dark)?|cyan|ink|muted-copy|on-dark(?:-accent|-muted)?|paper|pink|route-mid|rule|surface|color-background-(?:card|muted|purple|surface)|color-text-(?:primary|purple|secondary)|color-border(?:-emphasized)?|color-accent)\b/u;
        const arbitraryRadii = files.flatMap((file) =>
            readFileSync(file, "utf8")
                .split("\n")
                .flatMap((line, index) => {
                    if (!/rounded-\[[^\]]+\]/u.test(line)) return [];
                    if (
                        line.includes("var(--radius") ||
                        line.includes("rounded-[inherit]") ||
                        (relativePath(file) === "src/components/tooltip.tsx" &&
                            line.includes("rounded-[2px]"))
                    ) {
                        return [];
                    }
                    return [`${relativePath(file)}:${index + 1}`];
                }),
        );

        expect(violations(literalColor, themeValueFiles)).toEqual([]);
        expect(violations(paletteUtility, files)).toEqual([]);
        expect(violations(/color-mix\(\s*in[_\s-]+srgb\b/iu, files)).toEqual(
            [],
        );
        expect(
            violations(
                legacyToken,
                files.filter((file) => file !== contractPath),
            ),
        ).toEqual([]);
        expect(arbitraryRadii).toEqual([]);
    });
});
