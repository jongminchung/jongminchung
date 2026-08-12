import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
    importSpecifiers,
    productionSourceFiles,
    workspacePath,
    workspaceRoot,
} from "./source-files";

const apps = [
    { name: "engineering-docs", sourceRoot: "apps/engineering-docs" },
    { name: "git-client", sourceRoot: "apps/git-client/src" },
    { name: "readme", sourceRoot: "apps/readme" },
] as const;

const appStyles = [
    {
        globals: "apps/engineering-docs/app/globals.css",
        theme: "apps/engineering-docs/app/theme.css",
    },
    {
        globals: "apps/git-client/src/styles/index.css",
        theme: "apps/git-client/src/styles/theme.css",
    },
    {
        globals: "apps/readme/app/globals.css",
        theme: "apps/readme/app/theme.css",
    },
] as const;

const excludedDirectories = new Set([
    ".next",
    ".output",
    ".vite",
    "__fixtures__",
    "coverage",
    "dist",
    "fixtures",
    "generated",
    "node_modules",
    "out",
    "test-results",
    "tests",
]);
const productPolicyExclusions = [
    "apps/engineering-docs/components/materials/",
] as const;
const literalColorBoundaries = new Set([
    "apps/engineering-docs/app/icon.svg",
    "apps/engineering-docs/app/og/[locale]/[...slug]/route.tsx",
    "apps/git-client/electron/main/static-color-boundary.ts",
    "apps/git-client/index.html",
    "apps/readme/app/icon.svg",
    "apps/readme/app/opengraph-image.tsx",
    "packages/icon/src/index.ts",
]);

function readJson(path: string): Record<string, unknown> {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function dependencyNames(manifest: Record<string, unknown>): readonly string[] {
    return [
        "dependencies",
        "devDependencies",
        "optionalDependencies",
        "peerDependencies",
    ].flatMap((section) =>
        Object.keys((manifest[section] ?? {}) as Record<string, unknown>),
    );
}

function productFiles(directory: string): readonly string[] {
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        if (entry.isDirectory() && excludedDirectories.has(entry.name))
            return [];
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) return productFiles(path);
        if (
            !new Set([".css", ".html", ".svg", ".ts", ".tsx"]).has(
                extname(path),
            )
        )
            return [];
        if (/\.(?:e2e|integration|spec|test)\.[^.]+$/u.test(path)) return [];
        const relativePath = workspacePath(path);
        return productPolicyExclusions.some((prefix) =>
            relativePath.startsWith(prefix),
        )
            ? []
            : [path];
    });
}

function captures(contents: string, pattern: RegExp): ReadonlySet<string> {
    return new Set(
        Array.from(contents.matchAll(pattern), (match) => match[1] ?? ""),
    );
}

function matchingLines(filePath: string, pattern: RegExp): readonly string[] {
    return readFileSync(filePath, "utf8")
        .split("\n")
        .flatMap((line, index) =>
            pattern.test(line)
                ? [`${workspacePath(filePath)}:${index + 1}`]
                : [],
        );
}

function jsxOpeningTags(contents: string, name: string): readonly string[] {
    const tags: string[] = [];
    for (const match of contents.matchAll(new RegExp(`<${name}\\b`, "gu"))) {
        const start = match.index;
        let braces = 0;
        let quote: '"' | "'" | "`" | null = null;
        let escaped = false;
        for (let index = start; index < contents.length; index += 1) {
            const character = contents[index];
            if (escaped) {
                escaped = false;
            } else if (quote !== null) {
                if (character === "\\") escaped = true;
                else if (character === quote) quote = null;
            } else if (
                character === '"' ||
                character === "'" ||
                character === "`"
            ) {
                quote = character;
            } else if (character === "{") {
                braces += 1;
            } else if (character === "}") {
                braces -= 1;
            } else if (character === ">" && braces === 0) {
                tags.push(contents.slice(start, index + 1));
                break;
            }
        }
    }
    return tags;
}

describe("workspace design-system ownership", () => {
    test("routes every application through exported shared UI primitives", () => {
        for (const app of apps) {
            const appRoot = resolve(workspaceRoot, "apps", app.name);
            const manifest = readJson(resolve(appRoot, "package.json"));
            const dependencies = manifest.dependencies as Record<
                string,
                string
            >;
            const config = readJson(resolve(appRoot, "components.json"));
            const aliases = config.aliases as Record<string, string>;

            expect(dependencies["@jongminchung/ui"], app.name).toBe(
                "workspace:*",
            );
            expect(aliases.ui, app.name).toBe("@jongminchung/ui/components");
            expect(aliases.utils, app.name).toBe("@jongminchung/ui/lib/utils");
        }
    });

    test("keeps primitive implementations out of applications", () => {
        const forbiddenPackages = ["@base-ui/react", "cmdk"];
        const violations: string[] = [];
        for (const app of apps) {
            const appRoot = resolve(workspaceRoot, "apps", app.name);
            const manifest = readJson(resolve(appRoot, "package.json"));
            for (const dependency of dependencyNames(manifest)) {
                if (forbiddenPackages.includes(dependency))
                    violations.push(`${app.name} dependency: ${dependency}`);
            }
            for (const filePath of productionSourceFiles(
                resolve(workspaceRoot, app.sourceRoot),
            )) {
                for (const specifier of importSpecifiers(filePath)) {
                    if (
                        specifier === "@jongminchung/ui" ||
                        forbiddenPackages.some(
                            (name) =>
                                specifier === name ||
                                specifier.startsWith(`${name}/`),
                        )
                    ) {
                        violations.push(
                            `${workspacePath(filePath)}: ${specifier}`,
                        );
                    }
                }
            }
        }
        expect(violations).toEqual([]);
    });

    test("keeps application runtimes out of the shared UI package", () => {
        const manifest = readJson(
            resolve(workspaceRoot, "packages/ui/package.json"),
        );
        const runtimePrefixes = [
            "@electron/",
            "@electron-forge/",
            "@jongminchung/engineering-docs",
            "@jongminchung/git-client",
            "@jongminchung/readme",
        ];
        const runtimeNames = new Set(["electron", "next"]);
        expect(
            dependencyNames(manifest).filter(
                (dependency) =>
                    runtimeNames.has(dependency) ||
                    runtimePrefixes.some((prefix) =>
                        dependency.startsWith(prefix),
                    ),
            ),
        ).toEqual([]);
    });

    test("loads shared Tailwind input before complete app-owned themes", () => {
        const sharedProviders = captures(
            [
                "packages/ui/src/styles/tokens.css",
                "packages/ui/src/styles/theme.css",
            ]
                .map((path) =>
                    readFileSync(resolve(workspaceRoot, path), "utf8"),
                )
                .join("\n"),
            /--([\w-]+)\s*:/gu,
        );

        for (const style of appStyles) {
            const globals = readFileSync(
                resolve(workspaceRoot, style.globals),
                "utf8",
            );
            const theme = readFileSync(
                resolve(workspaceRoot, style.theme),
                "utf8",
            );
            expect(globals, style.globals).toContain(
                '@import "@jongminchung/ui/globals.css"',
            );
            expect(globals.indexOf('@import "./theme.css"')).toBeGreaterThan(
                globals.indexOf('@import "@jongminchung/ui/globals.css"'),
            );
            expect(globals, style.globals).toMatch(
                /@source\s+"\.\.\/\*\*\/\*\.\{ts,tsx(?:,mdx)?\}"/u,
            );
            expect(theme, style.theme).toContain(":root");
            expect(theme, style.theme).toContain("oklch(");
            expect(theme, style.theme).not.toMatch(/#[\da-f]{3,8}\b/iu);

            const appRoot = resolve(
                workspaceRoot,
                style.globals.split("/").slice(0, 2).join("/"),
            );
            const contents = productFiles(appRoot)
                .map((filePath) => readFileSync(filePath, "utf8"))
                .join("\n");
            const providers = new Set([
                ...sharedProviders,
                ...captures(contents, /--([\w-]+)\s*:/gu),
                ...captures(contents, /["']--([\w-]+)["']\s*:/gu),
                ...captures(contents, /\.setProperty\(\s*["']--([\w-]+)["']/gu),
                ...captures(contents, /\bvariable\s*:\s*["']--([\w-]+)["']/gu),
            ]);
            const consumers = captures(contents, /var\(--([\w-]+)/gu);
            expect(
                [...consumers].filter((token) => !providers.has(token)).sort(),
                `${style.globals} variable providers`,
            ).toEqual([]);
        }
    });

    test("keeps product sources on semantic colors and tokens", () => {
        const files = [
            ...productFiles(resolve(workspaceRoot, "apps")),
            ...productFiles(resolve(workspaceRoot, "packages")),
        ];
        const literalColor =
            /#[\da-f]{3,8}\b|(?:hsla?|lab|lch|oklab|rgba?)\s*\(/iu;
        const paletteUtility =
            /(?:^|[\s"'`])(?:[\w-]+:)*(?:accent|bg|border|caret|decoration|divide|fill|from|outline|placeholder|ring|shadow|stroke|text|to|via)-(?:amber|black|blue|cyan|emerald|fuchsia|gray|green|indigo|lime|neutral|orange|pink|purple|red|rose|sky|slate|stone|teal|violet|white|yellow|zinc)(?:-\d{2,3})?(?:\/\d{1,3})?\b/iu;
        const legacyToken =
            /--(?:blue(?:-dark)?|cyan|ink|muted-copy|on-dark(?:-accent|-muted)?|paper|pink|route-mid|rule|surface|color-background-(?:card|muted|purple|surface)|color-text-(?:primary|purple|secondary)|color-border(?:-emphasized)?|color-accent)\b/u;
        const literalViolations = files.flatMap((filePath) =>
            literalColorBoundaries.has(workspacePath(filePath)) ||
            appStyles.some(({ theme }) => theme === workspacePath(filePath)) ||
            workspacePath(filePath) === "packages/ui/src/styles/theme.css"
                ? []
                : matchingLines(filePath, literalColor),
        );

        expect(literalViolations, "literal colors").toEqual([]);
        expect(
            files.flatMap((filePath) =>
                matchingLines(filePath, paletteUtility),
            ),
            "Tailwind palette utilities",
        ).toEqual([]);
        expect(
            files.flatMap((filePath) =>
                workspacePath(filePath) === "packages/ui/src/styles/tokens.css"
                    ? []
                    : matchingLines(filePath, legacyToken),
            ),
            "legacy tokens",
        ).toEqual([]);
        expect(
            files.flatMap((filePath) =>
                matchingLines(filePath, /color-mix\(\s*in[_\s-]+srgb\b/iu),
            ),
            "sRGB color mixing",
        ).toEqual([]);
    });

    test("routes application buttons through explicit shared variants", () => {
        const violations: string[] = [];
        for (const filePath of productFiles(resolve(workspaceRoot, "apps"))) {
            if (extname(filePath) !== ".tsx") continue;
            const contents = readFileSync(filePath, "utf8");
            const importsSharedButton =
                /import\s*\{[^}]*\bButton\b[^}]*\}\s*from\s*["']@jongminchung\/ui\/components\/button["']/su.test(
                    contents,
                );
            if (/<button\b/u.test(contents))
                violations.push(`${workspacePath(filePath)}: raw button`);
            for (const tag of jsxOpeningTags(contents, "Button")) {
                if (!importsSharedButton)
                    violations.push(
                        `${workspacePath(filePath)}: non-shared Button`,
                    );
                if (!/\bvariant\s*=/u.test(tag) || !/\bsize\s*=/u.test(tag))
                    violations.push(
                        `${workspacePath(filePath)}: implicit Button variant`,
                    );
                if (
                    /\bsize\s*=\s*["']icon(?:-[a-z]+)?["']/u.test(tag) &&
                    !/\baria-label\s*=/u.test(tag)
                ) {
                    violations.push(
                        `${workspacePath(filePath)}: unnamed icon Button`,
                    );
                }
            }
        }
        expect(violations).toEqual([]);
    });
});
