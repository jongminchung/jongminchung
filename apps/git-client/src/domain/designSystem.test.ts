import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { tw } from "../styles/tailwind";

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = join(sourceRoot, "..");
const workspaceRoot = join(appRoot, "..", "..");
const uiRoot = join(workspaceRoot, "packages", "ui");
const themeContractRoot = join(workspaceRoot, "packages", "theme-contract");

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

    for (const app of apps) {
      const currentAppRoot = join(workspaceRoot, "apps", app);
      const packageJson = readJson(join(currentAppRoot, "package.json"));
      const config = readJson(join(currentAppRoot, "components.json"));
      const aliases = config.aliases as Record<string, string>;
      const tailwind = config.tailwind as Record<string, string | boolean>;

      expect(config.style, app).toBe("base-nova");
      expect(config.iconLibrary, app).toBe("lucide");
      expect(tailwind.baseColor, app).toBe("neutral");
      expect(aliases.ui, app).toBe("@jongminchung/ui/components");
      expect(aliases.utils, app).toBe("@jongminchung/ui/lib/utils");
      expect(aliases.components, app).toBe("@/components");
      expect(aliases.hooks, app).toBe("@/hooks");
      expect(aliases.lib, app).toBe("@/lib");
      expect(config.rsc, app).toBe(app !== "git-client");
      expect(packageJson.dependencies, app).toMatchObject({
        "@jongminchung/ui": "workspace:*",
      });
    }
  });

  test("publishes component subpaths without a root barrel", () => {
    const packageJson = readJson(join(uiRoot, "package.json"));
    const exports = packageJson.exports as Record<string, string>;

    expect(packageJson.private).toBe(true);
    expect(exports).toMatchObject({
      "./globals.css": "./src/styles/globals.css",
      "./lib/*": "./src/lib/*.ts",
      "./components/*": "./src/components/*.tsx",
    });
    expect(exports["."]).toBeUndefined();
    expect(existsSync(join(uiRoot, "src", "index.ts"))).toBe(false);
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
    expect(sharedStyles).toContain('@import "tw-animate-css"');
    expect(sharedStyles).toContain('@import "@jongminchung/theme-contract/tokens.css"');
    expect(sharedStyles).toContain('@source "../**/*.{ts,tsx}"');
    expect(sharedStyles).not.toContain("apps/");

    for (const path of appStyles) {
      const stylesheet = readFileSync(path, "utf8");
      expect(stylesheet, path).toContain('@import "@jongminchung/ui/globals.css"');
      expect(stylesheet, path).toContain('@import "./theme.css"');
      expect(stylesheet, path).toMatch(/@source\s+"\.\.\/\*\*\/\*\.\{ts,tsx(?:,mdx)?\}"/);
    }
  });

  test("keeps theme values local and satisfies the semantic token contract", () => {
    const tokenContract = readFileSync(join(themeContractRoot, "src", "tokens.css"), "utf8");
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

  test("does not retain primitive-shaped Tailwind recipes", () => {
    const stylesheet = readFileSync(join(sourceRoot, "styles", "index.css"), "utf8");

    for (const recipe of [
      "activeButton",
      "activityPill",
      "activitySpinner",
      "appDialog",
      "appearanceControl",
      "appearanceMenu",
      "bookmarksEmptyState",
      "closeTab",
      "collectionError",
      "commitRailClose",
      "commitRailToggle",
      "conflictDialog",
      "contextMenu",
      "dangerButton",
      "dangerMenuItem",
      "detailsEmpty",
      "dialogBackdrop",
      "editorEmptyWorkspace",
      "emptyState",
      "errorBanner",
      "filterButton",
      "gitBranchesError",
      "headPill",
      "hostingMore",
      "hostingSelected",
      "iconButton",
      "inspectorDialog",
      "loadingBottom",
      "loadingMainPanes",
      "loadingVcsLog",
      "loadingWorkbench",
      "logEmpty",
      "logFilterMenu",
      "logLoadMore",
      "mainToolbarAction",
      "mainToolbarIcon",
      "operationPill",
      "primaryButton",
      "projectTreeError",
      "projectSwitcherRemove",
      "projectSelector",
      "repositoryErrorView",
      "repositoryButton",
      "repositoryDialog",
      "repositoryToolDialog",
      "restoreWorkspace",
      "statePill",
      "statusBadge",
      "terminalEmpty",
      "terminalOptionsMenu",
      "editorToolbarIcon",
      "welcomeHelpButton",
      "welcomeSettingsButton",
    ]) {
      expect(tw).not.toHaveProperty(recipe);
    }
    expect(stylesheet).not.toContain("activitySpin");
    expect(stylesheet).not.toContain(".terminalEmpty");
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
