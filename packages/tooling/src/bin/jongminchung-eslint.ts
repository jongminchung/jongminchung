#!/usr/bin/env node
import { runConfiguredTool } from "../tool-runner.js";

const configNames = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
];

runConfiguredTool({
  packageName: "eslint",
  binName: "eslint",
  configNames,
  defaultConfig: new URL("../eslint/default.js", import.meta.url),
});
