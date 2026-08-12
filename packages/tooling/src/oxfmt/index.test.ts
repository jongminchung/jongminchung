import { describe, expect, it } from "vitest";
import { defineOxfmtConfig } from "./index.js";

describe("oxfmt config", () => {
    it("adds local ignore patterns after shared defaults", () => {
        const config = defineOxfmtConfig({
            ignorePatterns: ["fixtures/generated/"],
        });

        expect(config.ignorePatterns).toContain("node_modules/");
        expect(config.ignorePatterns.at(-1)).toBe("fixtures/generated/");
    });

    it("leaves formatting style on Oxfmt zero-config defaults", () => {
        const config = defineOxfmtConfig();

        expect(config).not.toHaveProperty("printWidth");
        expect(config).not.toHaveProperty("singleQuote");
        expect(config).not.toHaveProperty("semi");
        expect(config).not.toHaveProperty("tabWidth");
        expect(config).not.toHaveProperty("trailingComma");
        expect(config.sortImports).toEqual({ newlinesBetween: false });
        expect(config.sortPackageJson).toEqual({ sortScripts: true });
    });

    it("accepts current Oxfmt options and merges nested sort configuration", () => {
        const config = defineOxfmtConfig({
            insertFinalNewline: false,
            objectWrap: "collapse",
            sortImports: { order: "desc" },
            sortPackageJson: { sortScripts: false },
            sortTailwindcss: true,
        });

        expect(config.insertFinalNewline).toBe(false);
        expect(config.objectWrap).toBe("collapse");
        expect(config.sortImports).toEqual({
            newlinesBetween: false,
            order: "desc",
        });
        expect(config.sortPackageJson).toEqual({ sortScripts: false });
        expect(config.sortTailwindcss).toBe(true);
    });

    it("allows sort configuration to be disabled without merging object defaults", () => {
        const config = defineOxfmtConfig({
            sortImports: false,
            sortPackageJson: false,
        });

        expect(config.sortImports).toBe(false);
        expect(config.sortPackageJson).toBe(false);
    });

    it("uses the official Oxfmt type constraints", () => {
        const compileTimeOnly = () => {
            // @ts-expect-error Oxfmt only accepts its documented arrowParens values.
            defineOxfmtConfig({ arrowParens: "sometimes" });
            // @ts-expect-error Oxfmt overrides require at least one files pattern.
            defineOxfmtConfig({ overrides: [{ options: { tabWidth: 4 } }] });
        };

        expect(compileTimeOnly).toBeTypeOf("function");
    });
});
