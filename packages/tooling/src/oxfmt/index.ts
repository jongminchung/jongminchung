import type {
    OxfmtConfig,
    OxfmtOverrideConfig,
    SortImportsUserConfig,
} from "oxfmt";

export type { OxfmtConfig, OxfmtOverrideConfig } from "oxfmt";

export type ResolvedOxfmtConfig = OxfmtConfig & {
    ignorePatterns: string[];
    overrides: OxfmtOverrideConfig[];
    sortImports: NonNullable<OxfmtConfig["sortImports"]>;
    sortPackageJson: NonNullable<OxfmtConfig["sortPackageJson"]>;
};

type SortImportsOptions = Exclude<SortImportsUserConfig, boolean>;

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

const defaultOxfmtConfig = Object.freeze({
    sortImports: baseSortImports,
    sortPackageJson: false,
    ignorePatterns: baseIgnorePatterns,
    overrides: [],
}) satisfies ResolvedOxfmtConfig;

/** `defineOxfmtConfig` 공개 기능을 제공함 */
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
    return overrides ?? { ...baseSortImports };
}

function mergeSortPackageJson(
    overrides: OxfmtConfig["sortPackageJson"],
): NonNullable<OxfmtConfig["sortPackageJson"]> {
    if (typeof overrides === "object") return { ...overrides };
    return overrides ?? false;
}
