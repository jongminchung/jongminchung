import { defineConfig } from "vitest/config";

const vitestExclude = [
    "**/node_modules/**",
    "**/dist/**",
    "**/.output/**",
    "**/.tmp-*/**",
    "**/.wxt/**",
    "**/tests/live/**",
];

const packageIntegration = [
    "packages/**/*.integration.test.{ts,tsx}",
    "tests/publishing/**/*.test.{ts,tsx}",
];

const appIntegration = [
    "apps/**/*.integration.test.{mjs,ts,tsx}",
    "apps/git-client/electron/main/{diagnostics-log,hosting-credential-store,settings-store}.test.ts",
    "apps/git-client/electron/utility/git/**/*.test.{ts,tsx}",
    "apps/git-client/electron/utility/terminal/terminal-launch-target-resolver.test.ts",
    "apps/git-client/scripts/**/*.test.{ts,tsx}",
    "apps/engineering-docs/scripts/content-contract.test.ts",
];

export default defineConfig({
    resolve: {
        conditions: ["source", "module", "browser", "development|production"],
    },
    test: {
        coverage: {
            exclude: [
                "**/*.{test,spec}.{mjs,ts,tsx}",
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
                "apps/engineering-docs/lib/**/*.ts",
                "apps/readme/app/home-content.ts",
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
                        ...packageIntegration,
                        "**/*.e2e.test.ts",
                    ],
                    include: ["packages/**/*.test.{ts,tsx}"],
                    name: "packages-unit",
                    testTimeout: 10_000,
                },
            },
            {
                extends: true,
                test: {
                    fileParallelism: false,
                    include: packageIntegration,
                    name: "packages-integration",
                    testTimeout: 60_000,
                },
            },
            {
                extends: true,
                test: {
                    exclude: [...vitestExclude, ...appIntegration],
                    include: ["apps/**/*.test.{mjs,ts,tsx}"],
                    name: "apps-unit",
                    testTimeout: 10_000,
                },
            },
            {
                extends: true,
                test: {
                    fileParallelism: false,
                    include: appIntegration,
                    name: "apps-integration",
                    testTimeout: 60_000,
                },
            },
            {
                extends: true,
                test: {
                    include: ["tests/architecture/**/*.test.{ts,tsx}"],
                    name: "architecture",
                    testTimeout: 30_000,
                },
            },
        ],
        testTimeout: 30_000,
    },
});
