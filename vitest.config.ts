import { defineConfig } from "vitest/config";

const vitestExclude = [
    "**/node_modules/**",
    "**/dist/**",
    "**/.output/**",
    "**/.tmp-*/**",
    "**/.wxt/**",
    "**/tests/live/**",
];

const integrationTests = ["{apps,packages}/**/*.integration.test.{ts,tsx}"];

export default defineConfig({
    resolve: {
        conditions: ["source", "module", "browser", "development|production"],
    },
    test: {
        coverage: {
            exclude: [
                "**/*.{test,spec}.{ts,tsx}",
                "**/*.d.ts",
                "**/generated/**",
                "**/fixtures/**",
                "**/__fixtures__/**",
                "apps/git-client/src/adapters/**",
            ],
            include: [
                "packages/tooling/src/**/*.ts",
                "packages/ui/src/**/*.{ts,tsx}",
                "apps/git-client/src/domain/**/*.ts",
                "apps/git-client/src/application/**/*.{ts,tsx}",
                "apps/web/lib/**/*.ts",
            ],
            provider: "v8",
            reporter: ["text-summary", "json-summary"],
            reportsDirectory: "coverage",
        },
        environment: "node",
        exclude: vitestExclude,
        globals: false,
        hookTimeout: 30_000,
        projects: [
            {
                extends: true,
                test: {
                    exclude: [
                        ...vitestExclude,
                        ...integrationTests,
                        "**/*.e2e.test.ts",
                    ],
                    include: ["{apps,packages}/**/*.test.{ts,tsx}"],
                    name: "unit",
                    testTimeout: 10_000,
                },
            },
            {
                extends: true,
                test: {
                    fileParallelism: false,
                    include: integrationTests,
                    name: "integration",
                    testTimeout: 60_000,
                },
            },
        ],
        testTimeout: 30_000,
    },
});
