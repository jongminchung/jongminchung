import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(packageRoot, "..", "..");
const contractPath = join(packageRoot, "src", "tokens.css");
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
  "overlay",
] as const;
const coreColorTokenSet = new Set<string>(coreColorTokens);

const appThemes = [
  "apps/engineering-docs/app/theme.css",
  "apps/git-client/src/styles/theme.css",
  "apps/readme/app/theme.css",
] as const;
const oklchLiteralBoundaries = new Set<string>([
  ...appThemes,
  "packages/remark-plantuml/src/styles.css",
]);

const productionExtensions = new Set([".css", ".html", ".svg", ".ts", ".tsx"]);
const excludedDirectories = new Set([
  ".next",
  ".output",
  ".vite",
  "__fixtures__",
  "__snapshots__",
  "coverage",
  "dist",
  "fixtures",
  "generated",
  "node_modules",
  "out",
  "parity",
  "test-results",
  "tests",
]);
const excludedFile = /\.(?:e2e|integration|spec|test)\.[^.]+$|\.stories\.[^.]+$/;

const literalColorBoundaries = new Map<string, string>([
  [
    "apps/git-client/electron/main/static-color-boundary.ts",
    "Electron native surfaces and standalone HTML require centralized sRGB values",
  ],
  ["apps/git-client/index.html", "browser theme-color metadata requires an sRGB value"],
  [
    "apps/engineering-docs/app/icon.svg",
    "generated app icon uses the canonical sRGB asset palette",
  ],
  ["apps/readme/app/icon.svg", "generated app icon uses the canonical sRGB asset palette"],
  ["apps/readme/app/opengraph-image.tsx", "Next ImageResponse does not parse OKLCH colors"],
  ["packages/icon/src/index.ts", "canonical SVG and PNG assets require an sRGB palette"],
]);

interface ThemeScope {
  readonly body: string;
  readonly selector: string;
}

interface JsxOpeningTag {
  readonly line: number;
  readonly text: string;
}

function relativePath(path: string): string {
  return relative(workspaceRoot, path).split(sep).join("/");
}

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (excludedDirectories.has(entry.name) || entry.name.startsWith(".playwright-artifacts-")) {
      return [];
    }

    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!productionExtensions.has(extname(entry.name)) || excludedFile.test(entry.name)) return [];
    return [path];
  });
}

function declarations(contents: string): ReadonlySet<string> {
  return new Set(Array.from(contents.matchAll(/--([\w-]+)\s*:/g), ([, token]) => token));
}

function assignedVariables(contents: string): ReadonlySet<string> {
  const patterns = [
    /--([\w-]+)\s*:/g,
    /["']--([\w-]+)["']\s*:/g,
    /\.setProperty\(\s*["']--([\w-]+)["']/g,
    /\bvariable\s*:\s*["']--([\w-]+)["']/g,
  ];
  return new Set(
    patterns.flatMap((pattern) => Array.from(contents.matchAll(pattern), ([, token]) => token)),
  );
}

function usedVariables(contents: string): ReadonlySet<string> {
  return new Set(Array.from(contents.matchAll(/var\(--([\w-]+)/g), ([, token]) => token));
}

function localThemeProviders(contents: string): ReadonlySet<string> {
  const themeBlocks = Array.from(
    contents.matchAll(/@theme\s+inline\s*\{([^}]*)\}/g),
    ([, body]) => body,
  );
  return new Set(
    themeBlocks.flatMap((body) =>
      Array.from(
        body.matchAll(/--color-[\w-]+\s*:\s*var\(--([\w-]+)\)/g),
        ([, provider]) => provider,
      ),
    ),
  );
}

function themeScopes(contents: string): readonly ThemeScope[] {
  return Array.from(
    contents.matchAll(/(:root(?:\[data-theme=["'][^"']+["']\])?)\s*\{([^}]*)\}/g),
    ([, selector, body]) => ({ selector, body }),
  );
}

function matchingLines(contents: string, pattern: RegExp): readonly number[] {
  return contents.split("\n").flatMap((line, index) => (pattern.test(line) ? [index + 1] : []));
}

function violations(pattern: RegExp, files: readonly string[]): readonly string[] {
  return files.flatMap((file) => {
    const path = relativePath(file);
    return matchingLines(readFileSync(file, "utf8"), pattern).map((line) => `${path}:${line}`);
  });
}

function jsxOpeningTags(contents: string, name: string): readonly JsxOpeningTag[] {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startPattern = new RegExp(`<${escapedName}\\b`, "g");
  return Array.from(contents.matchAll(startPattern), (match) => {
    const start = match.index;
    let braces = 0;
    let quote: '"' | "'" | "`" | null = null;
    let escaped = false;
    let end = contents.length;

    for (let index = start; index < contents.length; index += 1) {
      const character = contents[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (quote !== null) {
        if (character === "\\") {
          escaped = true;
        } else if (character === quote) {
          quote = null;
        }
        continue;
      }
      if (character === '"' || character === "'" || character === "`") {
        quote = character;
      } else if (character === "{") {
        braces += 1;
      } else if (character === "}") {
        braces -= 1;
      } else if (character === ">" && braces === 0) {
        end = index + 1;
        break;
      }
    }

    return {
      line: contents.slice(0, start).split("\n").length,
      text: contents.slice(start, end),
    };
  });
}

function namedColorViolations(files: readonly string[]): readonly string[] {
  const allowedValues = new Set([
    "color-mix",
    "conic-gradient",
    "currentcolor",
    "inherit",
    "initial",
    "light-dark",
    "linear-gradient",
    "none",
    "oklch",
    "radial-gradient",
    "revert",
    "revert-layer",
    "transparent",
    "unset",
    "url",
    "var",
  ]);
  const propertyValue =
    /\b(?:background(?:-color)?|border(?:-[\w-]+)?-color|color|fill|stroke)\s*:\s*([a-z][\w-]*)/gi;
  const svgValue = /\b(?:fill|stroke)=["']([a-z][\w-]*)["']/gi;
  const themeValue = /--[\w-]+\s*:\s*([a-z][\w-]*)/gi;

  return files.flatMap((file) => {
    const path = relativePath(file);
    if (![".css", ".html", ".svg"].includes(extname(file))) return [];
    if (literalColorBoundaries.has(path)) return [];

    return readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, index) => {
        const patterns = [propertyValue, svgValue];
        if (oklchLiteralBoundaries.has(path)) patterns.push(themeValue);
        const values = patterns.flatMap((pattern) =>
          Array.from(line.matchAll(pattern), ([, value]) => value.toLowerCase()),
        );
        return values.some((value) => !allowedValues.has(value)) ? [`${path}:${index + 1}`] : [];
      });
  });
}

describe("@jongminchung/theme-contract", () => {
  test("is a CSS-only Tailwind adapter for the core semantic vocabulary", () => {
    const contract = readFileSync(contractPath, "utf8");
    const packageManifest = JSON.parse(readFileSync(packageManifestPath, "utf8"));
    const colorMappings = Array.from(
      contract.matchAll(/--color-([\w-]+):\s*var\(--([\w-]+)\)/g),
      ([, utility, provider]) => [utility, provider],
    );

    expect(colorMappings).toEqual(coreColorTokens.map((token) => [token, token]));
    expect(contract).toContain("--font-sans: var(--font-family-body)");
    expect(contract).toContain("--font-mono: var(--font-family-code)");
    expect(contract).toContain("--radius-xs: calc(var(--radius) * 0.4)");
    expect(contract).toContain("--radius-full: 9999px");
    expect(contract).toContain("--shadow-xs: var(--elevation-low)");
    expect(contract).toContain("--shadow-sm: var(--elevation-low)");
    expect(contract).toContain("--shadow-md: var(--elevation-medium)");
    expect(contract).toContain("--shadow-lg: var(--elevation-medium)");
    expect(contract).toContain("--shadow-xl: var(--elevation-high)");
    expect(contract).toContain("--shadow-2xl: var(--elevation-high)");
    expect(contract).not.toContain("--shadow-med:");
    expect(contract).not.toContain(":root");
    expect(packageManifest).toMatchObject({
      private: true,
      exports: {
        "./tokens.css": "./src/tokens.css",
      },
    });

    const sourceEntries = readdirSync(join(packageRoot, "src"), { withFileTypes: true });
    expect(sourceEntries.every((entry) => entry.isFile() && extname(entry.name) === ".css")).toBe(
      true,
    );
  });

  test("requires complete core providers in every app-owned theme scope", () => {
    for (const themePath of appThemes) {
      const contents = readFileSync(join(workspaceRoot, themePath), "utf8");
      const scopes = themeScopes(contents);
      const rootScope = scopes.find(({ selector }) => selector === ":root");

      expect(rootScope, `${themePath} must declare a :root theme`).toBeDefined();
      expect(contents, themePath).toContain("oklch(");
      expect(contents, themePath).not.toMatch(/#[\da-f]{3,8}\b/i);

      for (const scope of scopes) {
        const definedTokens = declarations(scope.body);
        const missingTokens = coreColorTokens.filter((token) => !definedTokens.has(token));
        expect(missingTokens, `${themePath} ${scope.selector}`).toEqual([]);
      }

      const rootTokens = declarations(rootScope?.body ?? "");
      expect(
        [
          "radius",
          "font-family-body",
          "font-family-code",
          "elevation-low",
          "elevation-medium",
          "elevation-high",
        ].filter((token) => !rootTokens.has(token)),
        `${themePath} root infrastructure`,
      ).toEqual([]);
    }
  });

  test("requires every app-local Tailwind color mapping to have a provider", () => {
    const localMappings = [
      {
        mappingPath: "apps/engineering-docs/app/globals.css",
        themePath: "apps/engineering-docs/app/theme.css",
      },
      {
        mappingPath: "apps/git-client/src/styles/index.css",
        themePath: "apps/git-client/src/styles/theme.css",
      },
      {
        mappingPath: "apps/readme/app/globals.css",
        themePath: "apps/readme/app/theme.css",
      },
    ] as const;

    for (const { mappingPath, themePath } of localMappings) {
      const mappedProviders = localThemeProviders(
        readFileSync(join(workspaceRoot, mappingPath), "utf8"),
      );
      const scopes = themeScopes(readFileSync(join(workspaceRoot, themePath), "utf8"));
      const rootScope = scopes.find(({ selector }) => selector === ":root");

      expect(
        [...mappedProviders].filter((provider) => coreColorTokenSet.has(provider)),
        `${mappingPath} must not duplicate the core contract`,
      ).toEqual([]);

      for (const scope of scopes) {
        const definedTokens = new Set([
          ...declarations(rootScope?.body ?? ""),
          ...declarations(scope.body),
        ]);
        expect(
          [...mappedProviders].filter((provider) => !definedTokens.has(provider)),
          `${mappingPath} providers in ${themePath} ${scope.selector}`,
        ).toEqual([]);
      }
    }
  });

  test("requires every production CSS variable use to have a provider", () => {
    const sharedProviders = declarations(readFileSync(contractPath, "utf8"));

    for (const app of ["engineering-docs", "git-client", "readme"] as const) {
      const files = sourceFiles(join(workspaceRoot, "apps", app));
      const contents = files.map((file) => readFileSync(file, "utf8")).join("\n");
      const providers = new Set([...sharedProviders, ...assignedVariables(contents)]);
      const missingProviders = [...usedVariables(contents)]
        .filter((provider) => !providers.has(provider))
        .sort();

      expect(missingProviders, `apps/${app} CSS variable providers`).toEqual([]);
    }
  });

  test("keeps the public PlantUML stylesheet consumer-themeable", () => {
    const styles = readFileSync(
      join(workspaceRoot, "packages", "remark-plantuml", "src", "styles.css"),
      "utf8",
    );
    const starlightStyles = readFileSync(
      join(workspaceRoot, "packages", "remark-plantuml", "src", "starlight.css"),
      "utf8",
    );

    expect(styles).toContain("var(--plantuml-caption-foreground, var(--muted-foreground, oklch(");
    expect(starlightStyles).toContain("--plantuml-caption-foreground: var(--sl-color-gray-3)");
  });

  test("keeps production UI on semantic colors and perceptual mixing", () => {
    const files = [
      ...sourceFiles(join(workspaceRoot, "apps")),
      ...sourceFiles(join(workspaceRoot, "packages")),
    ];
    const literalColor =
      /#[\da-f]{3,8}\b|(?:^|[^\w-])(?:color|hsla?|lab|lch|oklab|rgba?)\s*\(|\b(?:color|background(?:-color)?|border-color|fill|stroke)\s*:\s*(?:white|black)\b|(?:^|[,(])\s*(?:white|black)(?=\s|[,)/;])/i;
    const literalViolations = files.flatMap((file) => {
      const path = relativePath(file);
      if (literalColorBoundaries.has(path)) return [];
      return matchingLines(readFileSync(file, "utf8"), literalColor).map(
        (line) => `${path}:${line}`,
      );
    });
    const paletteUtility =
      /(?:^|[\s"'`])(?:[\w-]+:)*(?:accent|bg|border|caret|decoration|divide|fill|from|outline|placeholder|ring|shadow|stroke|text|to|via)-(?:amber|black|blue|cyan|emerald|fuchsia|gray|green|indigo|lime|neutral|orange|pink|purple|red|rose|sky|slate|stone|teal|violet|white|yellow|zinc)(?:-\d{2,3})?(?:\/\d{1,3})?\b/i;
    const oklchViolations = files.flatMap((file) => {
      const path = relativePath(file);
      if (oklchLiteralBoundaries.has(path)) return [];
      return matchingLines(readFileSync(file, "utf8"), /oklch\(/i).map((line) => `${path}:${line}`);
    });

    expect(literalViolations, "literal colors outside documented runtime boundaries").toEqual([]);
    expect(namedColorViolations(files), "CSS named colors").toEqual([]);
    expect(oklchViolations, "OKLCH literals outside app themes and public CSS fallbacks").toEqual(
      [],
    );
    expect(violations(/color-mix\(\s*in[_\s-]+srgb\b/i, files), "sRGB color mixing").toEqual([]);
    expect(violations(paletteUtility, files), "Tailwind palette utilities").toEqual([]);

    for (const [path, reason] of literalColorBoundaries) {
      expect(reason.length, `${path} must document why it is exempt`).toBeGreaterThan(0);
      expect(
        matchingLines(readFileSync(join(workspaceRoot, path), "utf8"), literalColor).length,
        `${path} should leave the allowlist when it no longer contains an sRGB literal`,
      ).toBeGreaterThan(0);
      expect(
        sourceFiles(join(workspaceRoot, path, "..")).some((file) => relativePath(file) === path),
      ).toBe(true);
    }
  });

  test("rejects legacy token names and one-off radii in production UI", () => {
    const files = [
      ...sourceFiles(join(workspaceRoot, "apps")),
      ...sourceFiles(join(workspaceRoot, "packages")),
    ].filter((file) => file !== contractPath);
    const appAndProductFiles = files.filter(
      (file) => !relativePath(file).startsWith("packages/ui/"),
    );
    const sharedUiFiles = sourceFiles(join(workspaceRoot, "packages", "ui"));
    const legacyToken =
      /--(?:blue(?:-dark)?|cyan|ink|muted-copy|on-dark(?:-accent|-muted)?|paper|pink|route-mid|rule|surface|color-background-(?:card|muted|purple|surface)|color-text-(?:primary|purple|secondary)|color-border(?:-emphasized)?|color-accent)\b/;
    const numericRadius =
      /border(?:-(?:bottom-left|bottom-right|end-end|end-start|start-end|start-start|top-left|top-right))?-radius\s*:\s*(?!0(?:[;\s}]|$))(?:\d|\.\d)|\[border(?:-(?:bottom-left|bottom-right|end-end|end-start|start-end|start-start|top-left|top-right))?-radius:|rounded-\[[^\]]+\]/;
    const sharedUiArbitraryRadii = sharedUiFiles.flatMap((file) => {
      const path = relativePath(file);
      return readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) => {
          if (!/rounded-\[[^\]]+\]/.test(line)) return [];
          if (line.includes("var(--radius")) return [];
          if (path === "packages/ui/src/components/tooltip.tsx" && line.includes("rounded-[2px]")) {
            return [];
          }
          return [`${path}:${index + 1}`];
        });
    });

    expect(violations(legacyToken, files), "legacy hue or material token names").toEqual([]);
    expect(
      violations(numericRadius, appAndProductFiles),
      "numeric or arbitrary product border radii",
    ).toEqual([]);
    expect(
      sharedUiArbitraryRadii,
      "shared UI arbitrary radii must derive from the semantic radius",
    ).toEqual([]);
  });

  test("routes Button usage through the shared shadcn variant contract", () => {
    const removedButtonModules = [
      "apps/engineering-docs/components/ui/button.tsx",
      "apps/git-client/src/components/ui/button.tsx",
      "apps/readme/components/ui/button.tsx",
    ] as const;
    const sharedButtonPath = join(
      workspaceRoot,
      "packages",
      "ui",
      "src",
      "components",
      "button.tsx",
    );
    const sharedButton = readFileSync(sharedButtonPath, "utf8");
    const files = sourceFiles(join(workspaceRoot, "apps")).filter(
      (file) => extname(file) === ".tsx",
    );
    const rawButtonViolations: string[] = [];
    const importViolations: string[] = [];
    const exportViolations: string[] = [];
    const oldPropViolations: string[] = [];
    const iconNameViolations: string[] = [];
    const explicitVariantViolations: string[] = [];
    const directBaseUiViolations: string[] = [];

    for (const path of removedButtonModules) {
      expect(existsSync(join(workspaceRoot, path)), path).toBe(false);
    }
    expect(sharedButton).toContain('from "@base-ui/react/button"');
    expect(sharedButton).toContain("const buttonVariants = cva(");
    expect(sharedButton).toContain("export { Button, buttonVariants }");

    for (const file of files) {
      const contents = readFileSync(file, "utf8");
      const importsSharedButton =
        /import\s*\{[^}]*\bButton\b[^}]*\}\s*from\s*["']@jongminchung\/ui\/components\/button["']/s.test(
          contents,
        );
      if (/from\s+["']@base-ui\/react(?:\/[^"']+)?["']/.test(contents)) {
        directBaseUiViolations.push(relativePath(file));
      }
      if (
        /export\s*\{[^}]*\bButton\b[^}]*\}/s.test(contents) ||
        /(?:function|class|const|let|var)\s+Button\b/.test(contents)
      ) {
        exportViolations.push(relativePath(file));
      }

      for (const tag of jsxOpeningTags(contents, "button")) {
        rawButtonViolations.push(`${relativePath(file)}:${tag.line}`);
      }
      for (const tag of jsxOpeningTags(contents, "Button")) {
        const location = `${relativePath(file)}:${tag.line}`;
        if (!importsSharedButton) importViolations.push(location);
        if (
          /(?:^|\s)(?:clickAction|endContent|icon|isDisabled|isLoading|label|tooltip)\s*=\s*(?:["'{])/.test(
            tag.text,
          )
        ) {
          oldPropViolations.push(location);
        }
        if (!/\bvariant\s*=/.test(tag.text) || !/\bsize\s*=/.test(tag.text)) {
          explicitVariantViolations.push(location);
        }
        if (
          /\bsize\s*=\s*["']icon(?:-[a-z]+)?["']/.test(tag.text) &&
          !/\baria-label\s*=/.test(tag.text)
        ) {
          iconNameViolations.push(location);
        }
      }
    }

    expect(rawButtonViolations, "raw button elements").toEqual([]);
    expect(directBaseUiViolations, "app-level Base UI imports").toEqual([]);
    expect(importViolations, "Button imports outside @jongminchung/ui").toEqual([]);
    expect(exportViolations, "local Button declarations or re-exports").toEqual([]);
    expect(oldPropViolations, "removed Button props").toEqual([]);
    expect(iconNameViolations, "icon-only Buttons without aria-label").toEqual([]);
    expect(explicitVariantViolations, "Button calls without explicit variant and size").toEqual([]);
  });
});
