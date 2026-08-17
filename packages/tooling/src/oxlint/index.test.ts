import { describe, expect, it } from "vitest";
import { defineOxlintConfig, sharedOxlintConfig } from "./index.js";

describe("Oxlint config", () => {
    it("returns an independent copy of every shared collection", () => {
        const config = defineOxlintConfig();

        expect(config).toEqual({
            ...sharedOxlintConfig,
            categories: { correctness: "error" },
            plugins: ["typescript", "unicorn", "oxc", "react", "jsx-a11y"],
            options: { typeAware: true },
            rules: sharedOxlintConfig.rules,
            overrides: [],
        });
        expect(config.categories).not.toBe(sharedOxlintConfig.categories);
        expect(config.plugins).not.toBe(sharedOxlintConfig.plugins);
        expect(config.options).not.toBe(sharedOxlintConfig.options);
        expect(config.rules).not.toBe(sharedOxlintConfig.rules);
    });

    it("merges consumer categories, plugins, options, rules, and overrides", () => {
        const override = {
            files: ["**/*.test.ts"],
            rules: { "typescript/no-explicit-any": "off" as const },
        };
        const config = defineOxlintConfig({
            categories: { correctness: "warn", suspicious: "error" },
            plugins: ["jest"],
            options: { typeAware: false },
            rules: { "eslint/prefer-const": "off" },
            overrides: [override],
        });

        expect(config.categories).toEqual({
            correctness: "warn",
            suspicious: "error",
        });
        expect(config.plugins).toEqual([
            "typescript",
            "unicorn",
            "oxc",
            "react",
            "jsx-a11y",
            "jest",
        ]);
        expect(config.options).toEqual({ typeAware: false });
        expect(config.rules?.["eslint/prefer-const"]).toBe("off");
        expect(config.rules?.["typescript/no-explicit-any"]).toBe("error");
        expect(config.overrides).toEqual([override]);
    });
});
