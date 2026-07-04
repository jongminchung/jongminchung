import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findNearestConfig,
  hasExplicitConfigArg,
  resolveConfigArgs,
  shouldUseDefaultConfig,
} from "./config-priority.js";

describe("tooling config priority", () => {
  it("treats explicit config args as project-owned priority", () => {
    expect(hasExplicitConfigArg(["--config", "custom.json"])).toBe(true);
    expect(hasExplicitConfigArg(["--config=custom.json"])).toBe(true);
    expect(hasExplicitConfigArg(["-c", "custom.json"])).toBe(true);
    expect(hasExplicitConfigArg(["--check"])).toBe(false);
  });

  it("finds project config files by walking up from the current directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "rocky-tooling-"));
    try {
      const nested = join(root, "packages", "app", "src");
      mkdirSync(nested, { recursive: true });
      writeFileSync(join(root, ".oxlintrc.json"), "{}");

      expect(findNearestConfig(nested, [".oxlintrc.json"])).toBe(join(root, ".oxlintrc.json"));
      expect(
        shouldUseDefaultConfig({ args: [], configNames: [".oxlintrc.json"], cwd: nested }),
      ).toBe(false);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("passes the nearest project config explicitly when one exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "rocky-tooling-"));
    try {
      const nested = join(root, "packages", "app", "src");
      mkdirSync(nested, { recursive: true });
      const configPath = join(root, ".oxfmtrc.mjs");
      writeFileSync(configPath, "export default {};");

      expect(
        resolveConfigArgs({
          args: ["--check"],
          configNames: [".oxfmtrc.mjs"],
          defaultConfig: "default.mjs",
          cwd: nested,
        }),
      ).toEqual(["--config", configPath, "--check"]);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("adds fallback-only args only when no local config exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "rocky-tooling-"));
    try {
      const nested = join(root, "packages", "app");
      mkdirSync(nested, { recursive: true });

      expect(
        resolveConfigArgs({
          args: ["--check"],
          configNames: [".oxfmtrc.mjs"],
          cwd: nested,
          defaultArgs: ["!generated.ts"],
          defaultConfig: "/tooling/default.mjs",
        }),
      ).toEqual(["--config", "/tooling/default.mjs", "--check", "!generated.ts"]);

      const configPath = join(root, ".oxfmtrc.mjs");
      writeFileSync(configPath, "export default {}");

      expect(
        resolveConfigArgs({
          args: ["--check"],
          configNames: [".oxfmtrc.mjs"],
          cwd: nested,
          defaultArgs: ["!generated.ts"],
          defaultConfig: "/tooling/default.mjs",
        }),
      ).toEqual(["--config", configPath, "--check"]);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
