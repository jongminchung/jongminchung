import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { tw } from "../styles/tailwind";

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

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

  test("owns the shadcn boundary and has no Astryx runtime", () => {
    const stylesheet = readFileSync(join(sourceRoot, "styles", "index.css"), "utf8");
    const packageJson = readFileSync(join(sourceRoot, "..", "package.json"), "utf8");
    const shadcnConfig = join(sourceRoot, "..", "components.json");
    const removedDesignSystem = ["@astryx", "design"].join("");
    const removedStyleRuntime = ["@stylexjs", "stylex"].join("/");

    expect(stylesheet).toContain('@import "tailwindcss"');
    expect(stylesheet).toContain('@import "tw-animate-css"');
    expect(stylesheet).not.toContain(removedDesignSystem);
    expect(packageJson).not.toContain(removedDesignSystem);
    expect(packageJson).not.toContain(removedStyleRuntime);
    expect(existsSync(shadcnConfig)).toBe(true);
    for (const file of sourceFiles(sourceRoot)) {
      expect(readFileSync(file, "utf8"), file).not.toContain(removedDesignSystem);
    }
    expect(stylesheet).not.toMatch(/--(?:violet|mint|coral|surface-raised|surface-sunken):/);
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
