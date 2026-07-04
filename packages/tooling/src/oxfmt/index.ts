export interface OxfmtOverride {
  readonly files?: readonly string[];
  readonly options?: Record<string, unknown>;
}

export interface OxfmtConfig {
  readonly arrowParens?: string;
  readonly bracketSameLine?: boolean;
  readonly bracketSpacing?: boolean;
  readonly endOfLine?: string;
  readonly ignorePatterns?: readonly string[];
  readonly jsxSingleQuote?: boolean;
  readonly overrides?: readonly OxfmtOverride[];
  readonly printWidth?: number;
  readonly proseWrap?: string;
  readonly quoteProps?: string;
  readonly semi?: boolean;
  readonly singleQuote?: boolean;
  readonly sortImports?: Record<string, unknown>;
  readonly sortPackageJson?: Record<string, unknown>;
  readonly tabWidth?: number;
  readonly trailingComma?: string;
  readonly useTabs?: boolean;
}

export interface ResolvedOxfmtConfig {
  readonly arrowParens: string;
  readonly bracketSameLine: boolean;
  readonly bracketSpacing: boolean;
  readonly endOfLine: string;
  readonly ignorePatterns: readonly string[];
  readonly jsxSingleQuote: boolean;
  readonly overrides: readonly OxfmtOverride[];
  readonly printWidth: number;
  readonly proseWrap: string;
  readonly quoteProps: string;
  readonly semi: boolean;
  readonly singleQuote: boolean;
  readonly sortImports: Record<string, unknown>;
  readonly sortPackageJson: Record<string, unknown>;
  readonly tabWidth: number;
  readonly trailingComma: string;
  readonly useTabs: boolean;
}

const baseOverrides = [
  {
    files: ["*.json", "*.jsonc", "**/*.json", "**/*.jsonc"],
    options: {
      tabWidth: 2,
    },
  },
];

const baseIgnorePatterns = [".git/", ".husky/_/", "coverage/", "dist/", "build/", "node_modules/"];

export const defaultOxfmtConfig = Object.freeze({
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
  sortImports: {
    newlinesBetween: false,
  },
  sortPackageJson: {
    sortScripts: true,
  },
  ignorePatterns: baseIgnorePatterns,
  overrides: baseOverrides,
}) satisfies Readonly<ResolvedOxfmtConfig>;

export function defineOxfmtConfig(overrides: OxfmtConfig = {}): ResolvedOxfmtConfig {
  return {
    ...defaultOxfmtConfig,
    ...overrides,
    ignorePatterns: [...baseIgnorePatterns, ...(overrides.ignorePatterns ?? [])],
    overrides: [...baseOverrides, ...(overrides.overrides ?? [])],
  };
}

export default defaultOxfmtConfig;
