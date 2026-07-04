import nx from "@nx/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export interface DepConstraint {
  readonly onlyDependOnLibsWithTags: readonly string[];
  readonly sourceTag: string;
}

export interface PackageBoundaryEslintConfigOptions {
  readonly allow?: readonly string[];
  readonly allowCircularSelfDependency?: boolean;
  readonly depConstraints?: readonly DepConstraint[];
  readonly files?: readonly string[];
  readonly ignores?: readonly string[];
  readonly localConfigs?: readonly EslintFlatConfig[];
}

type EslintFlatConfig = Record<string, unknown>;

export const defaultEslintIgnores = Object.freeze([
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/generated/**",
  "**/.bun/**",
  "**/.astro/**",
  "**/.next/**",
  "**/.output/**",
  "**/.vinxi/**",
]);

export function onlyDependOnTagsFor(
  depConstraints: readonly DepConstraint[],
  sourceTag: string,
): readonly string[] {
  return (
    depConstraints.find((constraint) => constraint.sourceTag === sourceTag)
      ?.onlyDependOnLibsWithTags ?? []
  );
}

export function createPackageBoundaryEslintConfig({
  files = ["**/*.{js,jsx,ts,tsx,mjs}"],
  ignores = defaultEslintIgnores,
  depConstraints = [],
  allow = [],
  allowCircularSelfDependency = true,
  localConfigs = [],
}: PackageBoundaryEslintConfigOptions = {}): EslintFlatConfig[] {
  const rules =
    depConstraints.length === 0
      ? {}
      : {
          "@nx/enforce-module-boundaries": [
            "error",
            {
              allow,
              allowCircularSelfDependency,
              depConstraints,
            },
          ],
        };

  return [
    {
      ignores,
    },
    {
      files,
      languageOptions: {
        ecmaVersion: "latest",
        parser: tsParser,
        sourceType: "module",
      },
      plugins: {
        "@nx": nx,
      },
      rules,
    },
    ...localConfigs,
  ];
}

export const defaultPackageBoundaryEslintConfig = createPackageBoundaryEslintConfig();
