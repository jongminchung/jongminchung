import type {
    OxfmtConfig as NativeOxfmtConfig,
    OxfmtOverrideConfig,
    SortImportsUserConfig,
    SortPackageJsonUserConfig,
} from "oxfmt";

export type OxfmtConfig = NativeOxfmtConfig;
export type OxfmtOverride = OxfmtOverrideConfig;

export type ResolvedOxfmtConfig = OxfmtConfig & {
    ignorePatterns: string[];
    overrides: OxfmtOverride[];
    sortImports: SortImportsUserConfig;
    sortPackageJson: SortPackageJsonUserConfig;
};

type SortImportsOptions = Exclude<SortImportsUserConfig, boolean>;
type SortPackageJsonOptions = Exclude<SortPackageJsonUserConfig, boolean>;

// 사람이 수정하는 source만 포맷하고 생성물과 build output은 생성 도구에 맡김
// 나쁜 예: generated/materials-registry.tsx 또는 dist/index.js를 직접 포맷함
// 좋은 예: components/materials/topics/** 또는 src/index.ts를 고친 뒤 생성 명령을 실행함
const baseIgnorePatterns = [
    ".git/",
    ".husky/_/",
    "coverage/",
    "dist/",
    "build/",
    "node_modules/",
];

// Oxfmt의 권장 group 순서는 유지하되 외부·내부 import 사이에 빈 줄을 만들지 않음
// 변경 전: import { load } from "#lib/load"; <빈 줄> import { useState } from "react";
// 변경 후: import { useState } from "react"; import { load } from "#lib/load";
const baseSortImports = { newlinesBetween: false } satisfies SortImportsOptions;

// package script 이름을 정렬하여 workspace manifest마다 같은 탐색 순서를 제공함
// 변경 전: { "scripts": { "test": "vitest", "build": "tsc" } }
// 변경 후: { "scripts": { "build": "tsc", "test": "vitest" } }
const baseSortPackageJson = {
    sortScripts: true,
} satisfies SortPackageJsonOptions;

const defaultOxfmtConfig = Object.freeze({
    sortImports: baseSortImports,
    sortPackageJson: baseSortPackageJson,
    ignorePatterns: baseIgnorePatterns,
    overrides: [],
}) satisfies ResolvedOxfmtConfig;

export function defineOxfmtConfig(
    overrides: OxfmtConfig = {},
): ResolvedOxfmtConfig {
    return {
        ...defaultOxfmtConfig,
        ...overrides,
        ignorePatterns: [
            ...baseIgnorePatterns,
            ...(overrides.ignorePatterns ?? []),
        ],
        overrides: [...(overrides.overrides ?? [])],
        sortImports: mergeSortImports(overrides.sortImports),
        sortPackageJson: mergeSortPackageJson(overrides.sortPackageJson),
    };
}

function mergeSortImports(
    overrides: SortImportsUserConfig | undefined,
): SortImportsUserConfig {
    if (typeof overrides === "object")
        return { ...baseSortImports, ...overrides };
    return overrides ?? baseSortImports;
}

function mergeSortPackageJson(
    overrides: SortPackageJsonUserConfig | undefined,
): SortPackageJsonUserConfig {
    if (typeof overrides === "object")
        return { ...baseSortPackageJson, ...overrides };
    return overrides ?? baseSortPackageJson;
}
