import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = join(sourceRoot, "..");
const workspaceRoot = join(appRoot, "..", "..");
const uiRoot = join(workspaceRoot, "packages", "ui");

function sourceFiles(directory: string): readonly string[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx|css)$/.test(entry.name) ? [path] : [];
  });
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

describe("workspace shadcn design system boundary", () => {
  test("routes every app to the shared primitive package", () => {
    const apps = ["engineering-docs", "git-client", "readme"] as const;
    const baseTsconfig = readJson(join(workspaceRoot, "tsconfig.base.json"));
    const baseCompilerOptions = baseTsconfig.compilerOptions as Record<string, unknown>;
    const sharedConfig = readJson(join(uiRoot, "components.json"));
    const sharedAliases = sharedConfig.aliases as Record<string, string>;
    const sharedTailwind = sharedConfig.tailwind as Record<string, string | boolean>;

    expect(baseCompilerOptions.moduleResolution).toBe("bundler");
    expect(baseCompilerOptions.resolvePackageJsonImports).toBe(true);
    expect(sharedConfig.style).toBe("base-nova");
    expect(sharedConfig.iconLibrary).toBe("lucide");
    expect(sharedConfig.rsc).toBe(true);
    expect(sharedTailwind).toMatchObject({
      config: "",
      css: "src/styles/globals.css",
      baseColor: "neutral",
      cssVariables: true,
    });
    expect(sharedAliases).toMatchObject({
      components: "#components",
      hooks: "#hooks",
      lib: "#lib",
      utils: "#lib/utils",
      ui: "#components",
    });

    for (const app of apps) {
      const currentAppRoot = join(workspaceRoot, "apps", app);
      const packageJson = readJson(join(currentAppRoot, "package.json"));
      const packageImports = packageJson.imports as Record<string, string>;
      const config = readJson(join(currentAppRoot, "components.json"));
      const tsconfig = readJson(join(currentAppRoot, "tsconfig.json"));
      const compilerOptions = tsconfig.compilerOptions as Record<string, unknown>;
      const aliases = config.aliases as Record<string, string>;
      const tailwind = config.tailwind as Record<string, string | boolean>;
      const sourcePrefix = app === "git-client" ? "./src/" : "./";

      expect(config.style, app).toBe("base-nova");
      expect(config.iconLibrary, app).toBe("lucide");
      expect(tailwind, app).toMatchObject({
        config: "",
        css: "../../packages/ui/src/styles/globals.css",
        baseColor: "neutral",
        cssVariables: true,
      });
      expect(aliases.ui, app).toBe("@jongminchung/ui/components");
      expect(aliases.utils, app).toBe("@jongminchung/ui/lib/utils");
      expect(aliases.components, app).toBe("#components");
      expect(aliases.hooks, app).toBe("@jongminchung/ui/hooks");
      expect(aliases.lib, app).toBe("#lib");
      expect(packageImports, app).toMatchObject({
        "#components/*": `${sourcePrefix}components/*.tsx`,
        "#lib/*": `${sourcePrefix}lib/*.ts`,
      });
      expect(packageImports["#hooks/*"], app).toBeUndefined();
      expect(compilerOptions.paths ?? {}, app).toEqual({});
      expect(config.rsc, app).toBe(app !== "git-client");
      expect(packageJson.dependencies, app).toMatchObject({
        "@jongminchung/ui": "workspace:*",
      });
    }
  });

  test("publishes named component subpaths without a root barrel", () => {
    const packageJson = readJson(join(uiRoot, "package.json"));
    const packageImports = packageJson.imports as Record<string, string>;
    const exports = packageJson.exports as Record<string, string>;

    expect(packageJson.private).toBe(true);
    expect(packageImports).toEqual({
      "#components/*": "./src/components/*.tsx",
      "#hooks/*": "./src/hooks/*.ts",
      "#lib/*": "./src/lib/*.ts",
    });
    expect(exports).toMatchObject({
      "./globals.css": "./src/styles/globals.css",
      "./tokens.css": "./src/styles/tokens.css",
      "./hooks/*": "./src/hooks/*.ts",
      "./lib/*": "./src/lib/*.ts",
      "./components/*": "./src/components/*.tsx",
    });
    expect(exports["."]).toBeUndefined();
    expect(existsSync(join(uiRoot, "src", "index.ts"))).toBe(false);

    for (const file of sourceFiles(join(uiRoot, "src"))) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/\bexport\s+default\b/);
    }
  });

  test("keeps Base UI and primitive copies out of applications", () => {
    for (const app of ["engineering-docs", "git-client", "readme"] as const) {
      const currentAppRoot = join(workspaceRoot, "apps", app);
      const packageJson = readFileSync(join(currentAppRoot, "package.json"), "utf8");
      const localUiRoot =
        app === "git-client"
          ? join(currentAppRoot, "src", "components", "ui")
          : join(currentAppRoot, "components", "ui");
      const runtimeRoots =
        app === "git-client"
          ? [join(currentAppRoot, "src")]
          : [
              join(currentAppRoot, "app"),
              join(currentAppRoot, "components"),
              join(currentAppRoot, "lib"),
            ];

      expect(packageJson, app).not.toContain('"@base-ui/react"');
      expect(sourceFiles(localUiRoot), app).toEqual([]);

      for (const file of runtimeRoots.flatMap(sourceFiles)) {
        expect(readFileSync(file, "utf8"), file).not.toMatch(
          /from\s+["']@base-ui\/react(?:\/[^"']+)?["']/,
        );
      }
    }
  });

  test("separates shared Tailwind input from app-owned themes", () => {
    const sharedStyles = readFileSync(join(uiRoot, "src", "styles", "globals.css"), "utf8");
    const appStyles = [
      join(workspaceRoot, "apps", "engineering-docs", "app", "globals.css"),
      join(workspaceRoot, "apps", "git-client", "src", "styles", "index.css"),
      join(workspaceRoot, "apps", "readme", "app", "globals.css"),
    ] as const;

    expect(sharedStyles).toContain('@import "tailwindcss"');
    expect(sharedStyles).toContain('@import "shadcn/tailwind.css"');
    expect(sharedStyles).toContain('@import "tw-animate-css"');
    expect(sharedStyles).toContain('@import "./tokens.css"');
    expect(sharedStyles).toContain('@source "../**/*.{ts,tsx}"');
    expect(sharedStyles).toContain("@apply border-border outline-ring/50");
    expect(sharedStyles).toContain("@apply bg-background text-foreground");
    expect(sharedStyles).not.toContain("apps/");

    for (const path of appStyles) {
      const stylesheet = readFileSync(path, "utf8");
      expect(stylesheet, path).toContain('@import "@jongminchung/ui/globals.css"');
      expect(stylesheet, path).toContain('@import "./theme.css"');
      expect(stylesheet, path).toMatch(/@source\s+"\.\.\/\*\*\/\*\.\{ts,tsx(?:,mdx)?\}"/);
    }
  });

  test("keeps theme values local and satisfies the semantic token contract", () => {
    const tokenContract = readFileSync(join(uiRoot, "src", "styles", "tokens.css"), "utf8");
    const themePaths = [
      join(workspaceRoot, "apps", "engineering-docs", "app", "theme.css"),
      join(workspaceRoot, "apps", "git-client", "src", "styles", "theme.css"),
      join(workspaceRoot, "apps", "readme", "app", "theme.css"),
    ] as const;
    const requiredTokens = [
      "background",
      "foreground",
      "card",
      "card-foreground",
      "primary",
      "primary-foreground",
      "muted",
      "muted-foreground",
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
      "radius",
      "overlay",
    ] as const;

    expect(tokenContract).toContain("--color-background: var(--background)");
    expect(tokenContract).toContain("--color-overlay: var(--overlay)");
    expect(tokenContract).not.toContain(":root");

    for (const path of themePaths) {
      const theme = readFileSync(path, "utf8");
      expect(theme, path).toContain("oklch(");
      expect(theme, path).not.toMatch(/#[\da-f]{3,8}\b/i);
      for (const token of requiredTokens) expect(theme, path).toContain(`--${token}:`);
    }
  });

  test("exposes the official Button variants and composes loading explicitly", () => {
    const button = readFileSync(join(uiRoot, "src", "components", "button.tsx"), "utf8");
    const spinner = readFileSync(join(uiRoot, "src", "components", "spinner.tsx"), "utf8");

    for (const variant of ["default", "outline", "secondary", "ghost", "destructive", "link"]) {
      expect(button).toMatch(new RegExp(`\\b${variant}:`));
    }
    for (const size of [
      "default",
      "xs",
      "sm",
      "lg",
      "icon",
      '"icon-xs"',
      '"icon-sm"',
      '"icon-lg"',
    ]) {
      expect(button).toMatch(new RegExp(`${size}:`));
    }
    expect(button).not.toContain("isLoading");
    expect(spinner).toContain('role="status"');
  });

  test("publishes the shadcn primitives used by dense Git Client surfaces", () => {
    for (const component of ["table", "scroll-area", "button-group"] as const) {
      expect(existsSync(join(uiRoot, "src", "components", `${component}.tsx`)), component).toBe(
        true,
      );
    }
    expect(existsSync(join(uiRoot, "src", "components", "native-select.tsx"))).toBe(false);
  });

  test("keeps product behavior in app-local compositions", () => {
    const dialog = readFileSync(join(sourceRoot, "components", "ProductDialog.tsx"), "utf8");
    const form = readFileSync(join(sourceRoot, "components", "ProductFormControls.tsx"), "utf8");
    const collections = readFileSync(
      join(sourceRoot, "components", "ProductCollections.tsx"),
      "utf8",
    );
    const overlays = readFileSync(join(sourceRoot, "components", "ProductOverlays.tsx"), "utf8");
    const terminalTabs = readFileSync(
      join(sourceRoot, "components", "TerminalTabStrip.tsx"),
      "utf8",
    );
    const main = readFileSync(join(sourceRoot, "main.tsx"), "utf8");

    expect(dialog).toContain('eventDetails.reason === "escape-key"');
    expect(dialog).toContain("eventDetails.cancel()");
    expect(dialog).toContain('disablePointerDismissal={purpose !== "info"}');
    expect(form).toContain("aria-describedby");
    expect(form).toContain("aria-invalid");
    expect(form).toContain('indeterminate={value === "indeterminate"}');
    expect(collections).toContain('from "@jongminchung/ui/components/item"');
    expect(collections).toContain('from "@jongminchung/ui/components/radio-group"');
    expect(collections).toContain('from "@jongminchung/ui/components/badge"');
    expect(collections).toContain('from "@jongminchung/ui/components/empty"');
    expect(collections).toContain('from "@jongminchung/ui/components/spinner"');
    expect(overlays).toContain('from "@jongminchung/ui/components/popover"');
    expect(overlays).toContain('from "@jongminchung/ui/components/dropdown-menu"');
    expect(terminalTabs).toContain('from "@jongminchung/ui/components/tabs"');
    expect(terminalTabs).toContain("activateOnFocus");
    expect(main).toContain("<TooltipProvider>");
  });

  test("keeps component styling out of a central Tailwind registry", () => {
    expect(existsSync(join(sourceRoot, "styles", "tailwind.ts"))).toBe(false);

    const applicationSources = sourceFiles(sourceRoot).filter(
      (path) => !path.endsWith("designSystem.test.ts"),
    );
    expect(applicationSources.filter((path) => path.endsWith(".module.css"))).toEqual([]);

    for (const path of applicationSources.filter((path) => /\.tsx?$/.test(path))) {
      const source = readFileSync(path, "utf8");
      expect(source, path).not.toMatch(/from\s+["'][^"']*styles\/tailwind["']/);
      expect(source, path).not.toMatch(/from\s+["'][^"']*\.module\.css["']/);
      expect(source, path).not.toMatch(/\btw\.[A-Za-z0-9_]+/);
      expect(source, path).not.toMatch(/Native(?:)Select/);
      expect(source, path).not.toMatch(/<(?:select|option)\b/);
      if (!/\.test\.tsx?$/.test(path)) {
        expect(source, path).not.toMatch(/<(?:button|input|select|textarea)\b/);
      }
    }

    const indexCss = readFileSync(join(sourceRoot, "styles", "index.css"), "utf8");
    expect(indexCss).not.toContain("@layer components");
    expect(indexCss).not.toMatch(/\.(?:appShell|titlebar|toolStripe|workbench|local-history-)/);
    expect(indexCss).not.toContain("@apply");
    expect(indexCss).not.toMatch(/#[\da-f]{3,8}\b/i);
  });
});
