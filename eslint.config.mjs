import {
  createPackageBoundaryEslintConfig,
  defaultEslintIgnores,
} from "@jongminchung/tooling/eslint";

const packageTags = Object.freeze({
  tooling: "pkg:tooling",
  ui: "pkg:ui",
});

const depConstraints = Object.freeze([
  {
    sourceTag: packageTags.tooling,
    onlyDependOnLibsWithTags: [packageTags.tooling],
  },
  {
    sourceTag: packageTags.ui,
    onlyDependOnLibsWithTags: [packageTags.ui],
  },
]);

export default createPackageBoundaryEslintConfig({
  files: ["packages/**/*.{js,jsx,ts,tsx,mjs}"],
  ignores: defaultEslintIgnores,
  depConstraints,
});
