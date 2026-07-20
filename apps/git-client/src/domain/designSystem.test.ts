import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { tw } from "../styles/tailwind";

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = join(sourceRoot, "..", "..", "..");
const uiRoot = join(workspaceRoot, "packages", "ui");

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

  test("owns shadcn components locally and consumes shared design tokens", () => {
    const stylesheet = readFileSync(join(sourceRoot, "styles", "index.css"), "utf8");
    const packageJson = readFileSync(join(sourceRoot, "..", "package.json"), "utf8");
    const uiPackageJson = readFileSync(join(uiRoot, "package.json"), "utf8");
    const shadcnConfig = readFileSync(join(sourceRoot, "..", "components.json"), "utf8");
    const localComponents = join(sourceRoot, "components", "ui");
    const removedDesignSystem = ["@astryx", "design"].join("");
    const removedStyleRuntime = ["@stylexjs", "stylex"].join("/");
    const removedPrimitive = ["radix", "ui"].join("-");

    expect(stylesheet).toContain('@import "tailwindcss"');
    expect(stylesheet).toContain('@import "tw-animate-css"');
    expect(stylesheet).toContain('@import "@jongminchung/ui/git-client.css"');
    expect(stylesheet).not.toContain(removedDesignSystem);
    expect(packageJson).not.toContain(removedDesignSystem);
    expect(packageJson).not.toContain(removedStyleRuntime);
    expect(packageJson).not.toContain(`"${removedPrimitive}"`);
    expect(uiPackageJson).not.toContain(`"${removedPrimitive}"`);
    expect(packageJson).toContain('"@base-ui/react"');
    expect(uiPackageJson).toContain('"@base-ui/react"');
    expect(shadcnConfig).toContain('"style": "base-nova"');
    expect(shadcnConfig).toContain('"ui": "@/components/ui"');
    expect(shadcnConfig).toContain('"utils": "@/lib/utils"');
    expect(existsSync(localComponents)).toBe(true);
    expect(existsSync(join(uiRoot, "src", "git-client"))).toBe(false);
    expect(uiPackageJson).not.toContain('"./git-client"');
    expect(uiPackageJson).toContain('"./git-client.css"');
    for (const file of sourceFiles(sourceRoot)) {
      expect(readFileSync(file, "utf8"), file).not.toContain(removedDesignSystem);
    }
    expect(stylesheet).not.toMatch(/--(?:violet|mint|coral|surface-raised|surface-sunken):/);
  });

  test("uses the shadcn semantic token convention", () => {
    const theme = readFileSync(join(uiRoot, "src", "styles", "git-client.css"), "utf8");
    const tokenContract = readFileSync(join(uiRoot, "src", "styles", "tokens.css"), "utf8");
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
    expect(theme).toContain('@import "./tokens.css"');
    expect(tokenContract).toContain("--color-background: var(--background)");
    expect(tokenContract).toContain("--color-card-foreground: var(--card-foreground)");
    expect(docsTheme).not.toContain("@jongminchung/ui/git-client.css");

    const legacyToken =
      /--(?:color-background-(?:body|surface|card|popover|feedback|muted|inverted)|color-text-|color-icon-|status-|welcome-(?:sidebar|navigation)|color-tab-)/;
    const removedPrimitiveImport = `from "${["radix", "ui"].join("-")}"`;
    for (const file of sourceFiles(sourceRoot)) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(legacyToken);
      expect(readFileSync(file, "utf8"), file).not.toContain(removedPrimitiveImport);
    }

    const sharedEntrypoint = "@jongminchung/ui/" + "git-client";
    for (const file of sourceFiles(join(sourceRoot, "components"))) {
      expect(readFileSync(file, "utf8"), file).not.toContain(sharedEntrypoint);
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
