import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveConfiguredToolArgs } from "./tool-runner.js";

describe("configured tool runner", () => {
  it("resolves URL default configs and fallback-only args", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "jongminchung-tool-runner-"));
    try {
      const args = resolveConfiguredToolArgs({
        args: ["--check"],
        configNames: [".missing-config"],
        cwd,
        defaultArgs: ["!generated.ts"],
        defaultConfig: new URL("./oxfmt/index.js", import.meta.url),
      });

      expect(args[0]).toBe("--config");
      expect(args[1]).toMatch(/packages\/tooling\/src\/oxfmt\/index\.js$/);
      expect(args.slice(2)).toEqual(["--check", "!generated.ts"]);
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
});
