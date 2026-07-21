import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { tw } from "../styles/tailwind";

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = join(sourceRoot, "..", "..", "..");
const themeContractRoot = join(workspaceRoot, "packages", "theme-contract");

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx|css)$/.test(entry.name) ? [path] : [];
  });
}

describe("Git Client design system boundary", () => {
  test("uses Tailwind and shadcn without CSS Modules", () => {
    const removedStylesheet = join(sourceRoot, "styles", `App${".module"}.css`);
    expect(existsSync(removedStylesheet)).toBe(false);

    const moduleImport = /from\s+["'][^"']+\.module\.css["']/;
    for (const file of sourceFiles(sourceRoot)) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(moduleImport);
    }
  });

  test("owns shadcn components and theme values locally", () => {
    const stylesheet = readFileSync(join(sourceRoot, "styles", "index.css"), "utf8");
    const packageJson = readFileSync(join(sourceRoot, "..", "package.json"), "utf8");
    const contractPackageJson = readFileSync(join(themeContractRoot, "package.json"), "utf8");
    const shadcnConfig = readFileSync(join(sourceRoot, "..", "components.json"), "utf8");
    const localComponents = join(sourceRoot, "components", "ui");
    const localTheme = join(sourceRoot, "styles", "theme.css");
    const removedDesignSystem = ["@astryx", "design"].join("");
    const removedStyleRuntime = ["@stylexjs", "stylex"].join("/");
    const removedPrimitive = ["radix", "ui"].join("-");

    expect(stylesheet).toContain('@import "tailwindcss"');
    expect(stylesheet).toContain('@import "tw-animate-css"');
    expect(stylesheet).toContain('@import "@jongminchung/theme-contract/tokens.css"');
    expect(stylesheet).toContain('@import "./theme.css"');
    expect(stylesheet).not.toContain(removedDesignSystem);
    expect(packageJson).not.toContain(removedDesignSystem);
    expect(packageJson).not.toContain(removedStyleRuntime);
    expect(packageJson).not.toContain(`"${removedPrimitive}"`);
    expect(contractPackageJson).not.toContain('"react"');
    expect(contractPackageJson).not.toContain('"@base-ui/react"');
    expect(packageJson).toContain('"@base-ui/react"');
    expect(shadcnConfig).toContain('"style": "base-nova"');
    expect(shadcnConfig).toContain('"ui": "@/components/ui"');
    expect(shadcnConfig).toContain('"utils": "@/lib/utils"');
    expect(existsSync(localComponents)).toBe(true);
    expect(existsSync(localTheme)).toBe(true);
    expect(existsSync(join(workspaceRoot, "packages", "ui", "package.json"))).toBe(false);
    for (const file of sourceFiles(sourceRoot)) {
      expect(readFileSync(file, "utf8"), file).not.toContain(removedDesignSystem);
    }
    expect(stylesheet).not.toMatch(/--(?:violet|mint|coral|surface-raised|surface-sunken):/);
  });

  test("uses the shared semantic token convention with app-owned values", () => {
    const theme = readFileSync(join(sourceRoot, "styles", "theme.css"), "utf8");
    const tokenContract = readFileSync(join(themeContractRoot, "src", "tokens.css"), "utf8");
    const docsTheme = readFileSync(
      join(workspaceRoot, "apps", "docs", "app", "globals.css"),
      "utf8",
    );
    const requiredPairs = [
      "card",
      "popover",
      "primary",
      "secondary",
      "muted",
      "accent",
      "destructive",
      "sidebar",
      "success",
      "success-muted",
      "warning",
      "warning-muted",
      "destructive-muted",
      "feedback",
      "inverse",
    ] as const;

    expect(theme).toContain("--background:");
    expect(theme).toContain("--foreground:");
    for (const token of requiredPairs) {
      expect(theme).toContain(`--${token}:`);
      expect(theme).toContain(`--${token}-foreground:`);
    }
    expect(theme).toContain("--border:");
    expect(theme).toContain("--input:");
    expect(theme).toContain("--ring:");
    expect(theme).toContain("--radius:");
    expect(theme).toContain(':root[data-theme="dark"]');
    expect(theme).toContain("oklch(");
    expect(theme).not.toMatch(/#[\da-f]{3,8}\b/i);
    expect(tokenContract).toContain("--color-background: var(--background)");
    expect(tokenContract).toContain("--color-card-foreground: var(--card-foreground)");
    expect(tokenContract).not.toContain(":root");
    expect(docsTheme).toContain("@jongminchung/theme-contract/tokens.css");

    const legacyToken =
      /--(?:color-background-(?:body|surface|card|popover|feedback|muted|inverted)|color-text-|color-icon-|status-|welcome-(?:sidebar|navigation)|color-tab-)/;
    const removedPrimitiveImport = `from "${["radix", "ui"].join("-")}"`;
    for (const file of sourceFiles(sourceRoot)) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(legacyToken);
      expect(readFileSync(file, "utf8"), file).not.toContain(removedPrimitiveImport);
    }

    const sharedEntrypoint = "@jongminchung/theme-contract/";
    for (const file of sourceFiles(join(sourceRoot, "components"))) {
      expect(readFileSync(file, "utf8"), file).not.toContain(sharedEntrypoint);
    }
  });

  test("keeps app components out of the theme contract package", () => {
    const contractFiles = sourceFiles(themeContractRoot);
    expect(contractFiles.every((file) => !/\.(?:ts|tsx)$/.test(file))).toBe(true);

    for (const app of ["docs", "git-client", "readme"] as const) {
      const appRoot = join(workspaceRoot, "apps", app);
      const packageJson = readFileSync(join(appRoot, "package.json"), "utf8");
      const shadcnConfig = readFileSync(join(appRoot, "components.json"), "utf8");
      expect(packageJson).toContain('"@jongminchung/theme-contract"');
      expect(packageJson).not.toContain('"@jongminchung/ui"');
      expect(shadcnConfig).toContain('"style": "base-nova"');
      expect(shadcnConfig).toContain('"ui": "@/components/ui"');
      expect(shadcnConfig).toContain('"utils": "@/lib/utils"');
    }
  });

  test("keeps theme values local and OKLCH-based", () => {
    const themePaths = [
      join(workspaceRoot, "apps", "docs", "app", "theme.css"),
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
      "radius",
    ] as const;

    for (const themePath of themePaths) {
      const theme = readFileSync(themePath, "utf8");
      expect(theme, themePath).toContain("oklch(");
      expect(theme, themePath).not.toMatch(/#[\da-f]{3,8}\b/i);
      for (const token of requiredTokens) expect(theme, themePath).toContain(`--${token}:`);
    }
  });

  test("keeps app UI components on semantic color tokens", () => {
    const literalColor = /#[\da-f]{3,8}\b/i;
    const paletteUtility =
      /\b(?:bg|border|ring|text)-(?:amber|blue|green|purple|red|white|black)(?:-\d+)?(?:\/\d+)?\b/;

    for (const app of ["docs", "git-client", "readme"] as const) {
      const appRoot = join(workspaceRoot, "apps", app);
      const componentsRoot =
        app === "git-client"
          ? join(appRoot, "src", "components", "ui")
          : join(appRoot, "components", "ui");
      for (const file of sourceFiles(componentsRoot)) {
        const contents = readFileSync(file, "utf8");
        expect(contents, file).not.toMatch(literalColor);
        expect(contents, file).not.toMatch(paletteUtility);
      }
    }
  });

  test("uses Base UI state and dismissal contracts", () => {
    const componentsRoot = join(sourceRoot, "components", "ui");
    const dialog = readFileSync(join(componentsRoot, "dialog.tsx"), "utf8");
    const collections = readFileSync(join(componentsRoot, "collections.tsx"), "utf8");
    const overlays = readFileSync(join(componentsRoot, "overlays.tsx"), "utf8");

    expect(dialog).toContain('eventDetails.reason === "escape-key"');
    expect(dialog).toContain("eventDetails.cancel()");
    expect(dialog).toContain('disablePointerDismissal={purpose !== "info"}');
    expect(collections).toContain("data-active:");
    expect(collections).toContain("data-pressed:");
    expect(overlays).toContain("<PopoverPrimitive.Positioner");
    expect(overlays).toContain('className="z-[110]"');
  });

  test("does not escape quotes inside Tailwind selector variants", () => {
    const malformed = Object.entries(tw)
      .filter(([, classes]) => /(?:aria-[a-z-]+|role|type)=\\"/.test(classes))
      .map(([name]) => name);

    expect(malformed).toEqual([]);
  });

  test("uses explicit combinators for every HTML descendant variant", () => {
    const htmlElement =
      "(?:a|article|b|button|code|div|em|figcaption|figure|form|h1|h3|hr|i|img|input|kbd|label|p|path|pre|section|select|small|span|strong|summary|svg|textarea|time)";
    const missingDescendantCombinator = new RegExp(
      `(?:^|\\s)(?:max-\\[[^\\]]+\\]:)?\\[&${htmlElement}(?=\\]|[_.:\\[])`,
    );
    const malformed = Object.entries(tw)
      .filter(([, classes]) => missingDescendantCombinator.test(classes))
      .map(([name]) => name);

    expect(malformed).toEqual([]);
  });
});
