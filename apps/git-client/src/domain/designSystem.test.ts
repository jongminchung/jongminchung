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
    test("uses Tailwind and Astryx without CSS Modules", () => {
        const removedStylesheet = join(
            sourceRoot,
            "styles",
            `App${".module"}.css`,
        );
        expect(existsSync(removedStylesheet)).toBe(false);

        const moduleImport = /from\s+["'][^"']+\.module\.css["']/;
        for (const file of sourceFiles(sourceRoot)) {
            expect(readFileSync(file, "utf8"), file).not.toMatch(moduleImport);
        }
    });

    test("keeps the shared Astryx and Tailwind CSS layer order", () => {
        const stylesheet = readFileSync(
            join(sourceRoot, "styles", "index.css"),
            "utf8",
        );
        expect(stylesheet.indexOf("tailwindcss/theme.css")).toBeLessThan(
            stylesheet.indexOf("@astryxdesign/core/reset.css"),
        );
        expect(
            stylesheet.indexOf("@astryxdesign/theme-neutral/theme.css"),
        ).toBeLessThan(stylesheet.indexOf("tailwindcss/utilities.css"));
        expect(stylesheet).not.toMatch(
            /--(?:violet|mint|coral|surface-raised|surface-sunken):/,
        );
    });

    test("does not escape quotes inside Tailwind selector variants", () => {
        const malformed = Object.entries(tw)
            .filter(([, classes]) =>
                /(?:aria-[a-z-]+|role|type)=\\"/.test(classes),
            )
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
