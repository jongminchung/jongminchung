#!/usr/bin/env node
import { runConfiguredTool } from "../tool-runner.js";

const configNames = [
  ".oxlintrc.json",
  ".oxlintrc.jsonc",
  "oxlint.config.js",
  "oxlint.config.mjs",
  "oxlint.config.cjs",
  "oxlint.config.ts",
];

runConfiguredTool({
  packageName: "oxlint",
  binName: "oxlint",
  configNames,
  defaultConfig: new URL("../oxlint/base.json", import.meta.url),
  pathDependencies: [
    {
      packageName: "oxlint-tsgolint",
      binName: "tsgolint",
    },
  ],
});
