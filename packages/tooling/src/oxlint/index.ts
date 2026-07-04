export interface OxlintConfig {
  readonly options?: Record<string, unknown>;
  readonly rules?: Record<string, string>;
}

export interface ResolvedOxlintConfig {
  readonly options: Record<string, unknown>;
  readonly rules: Record<string, string>;
}

export const defaultOxlintConfig = Object.freeze({
  options: {
    typeAware: true,
  },
  rules: {
    "eslint/no-unused-vars": "error",
    "eslint/prefer-const": "error",
    "typescript/no-explicit-any": "warn",
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
  },
}) satisfies Readonly<ResolvedOxlintConfig>;

export function defineOxlintConfig(overrides: OxlintConfig = {}): ResolvedOxlintConfig {
  return {
    ...defaultOxlintConfig,
    ...overrides,
    options: {
      ...defaultOxlintConfig.options,
      ...overrides.options,
    },
    rules: {
      ...defaultOxlintConfig.rules,
      ...overrides.rules,
    },
  };
}

export default defaultOxlintConfig;
