import type {
  OxfmtConfig as NativeOxfmtConfig,
  OxfmtOverrideConfig,
  SortImportsUserConfig,
  SortPackageJsonUserConfig,
} from "oxfmt";

export type OxfmtConfig = NativeOxfmtConfig;
export type OxfmtOverride = OxfmtOverrideConfig;

type SharedOxfmtDefaults = Required<
  Pick<
    OxfmtConfig,
    | "arrowParens"
    | "bracketSameLine"
    | "bracketSpacing"
    | "endOfLine"
    | "jsxSingleQuote"
    | "printWidth"
    | "proseWrap"
    | "quoteProps"
    | "semi"
    | "singleQuote"
    | "tabWidth"
    | "trailingComma"
    | "useTabs"
  >
>;

export type ResolvedOxfmtConfig = OxfmtConfig &
  SharedOxfmtDefaults & {
    ignorePatterns: string[];
    overrides: OxfmtOverride[];
    sortImports: SortImportsUserConfig;
    sortPackageJson: SortPackageJsonUserConfig;
  };

type SortImportsOptions = Exclude<SortImportsUserConfig, boolean>;
type SortPackageJsonOptions = Exclude<SortPackageJsonUserConfig, boolean>;

const baseOverrides = [
  {
    files: ["*.json", "*.jsonc", "**/*.json", "**/*.jsonc"],
    options: {
      tabWidth: 2,
    },
  },
] satisfies OxfmtOverride[];

const baseIgnorePatterns = [".git/", ".husky/_/", "coverage/", "dist/", "build/", "node_modules/"];
const baseSortImports = { newlinesBetween: false } satisfies SortImportsOptions;
const baseSortPackageJson = { sortScripts: true } satisfies SortPackageJsonOptions;

const defaultOxfmtConfig = Object.freeze({
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  endOfLine: "lf",
  semi: true,
  singleQuote: false,
  jsxSingleQuote: false,
  quoteProps: "as-needed",
  trailingComma: "all",
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "always",
  proseWrap: "preserve",
  sortImports: baseSortImports,
  sortPackageJson: baseSortPackageJson,
  ignorePatterns: baseIgnorePatterns,
  overrides: baseOverrides,
}) satisfies ResolvedOxfmtConfig;

export function defineOxfmtConfig(overrides: OxfmtConfig = {}): ResolvedOxfmtConfig {
  return {
    ...defaultOxfmtConfig,
    ...overrides,
    ignorePatterns: [...baseIgnorePatterns, ...(overrides.ignorePatterns ?? [])],
    overrides: [...baseOverrides, ...(overrides.overrides ?? [])],
    sortImports: mergeSortImports(overrides.sortImports),
    sortPackageJson: mergeSortPackageJson(overrides.sortPackageJson),
  };
}

function mergeSortImports(overrides: SortImportsUserConfig | undefined): SortImportsUserConfig {
  if (typeof overrides === "object") return { ...baseSortImports, ...overrides };
  return overrides ?? baseSortImports;
}

function mergeSortPackageJson(
  overrides: SortPackageJsonUserConfig | undefined,
): SortPackageJsonUserConfig {
  if (typeof overrides === "object") return { ...baseSortPackageJson, ...overrides };
  return overrides ?? baseSortPackageJson;
}
