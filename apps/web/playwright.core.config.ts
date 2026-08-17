import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

function toPatterns(value: unknown): readonly (string | RegExp)[] {
    if (value === undefined) return [];
    return Array.isArray(value)
        ? (value as readonly (string | RegExp)[])
        : [value as string | RegExp];
}

export default defineConfig({
    ...baseConfig,
    projects: baseConfig.projects?.map((project) => ({
        ...project,
        testIgnore: [
            ...toPatterns(project.testIgnore),
            /materials-all\.spec\.ts/u,
            /(?:home-)?visual\.e2e\.test\.ts/u,
        ],
    })),
});
