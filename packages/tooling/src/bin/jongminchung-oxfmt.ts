#!/usr/bin/env node
import { runConfiguredTool } from "../tool-runner.js";

const configNames = [
  ".oxfmtrc.json",
  ".oxfmtrc.jsonc",
  ".oxfmtrc.js",
  ".oxfmtrc.mjs",
  ".oxfmtrc.cjs",
  ".oxfmtrc.ts",
  "oxfmt.config.js",
  "oxfmt.config.mjs",
  "oxfmt.config.cjs",
  "oxfmt.config.ts",
];

runConfiguredTool({
  packageName: "oxfmt",
  binName: "oxfmt",
  configNames,
  defaultConfig: new URL("../oxfmt/index.js", import.meta.url),
});
