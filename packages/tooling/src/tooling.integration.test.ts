import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const rootDir = fileURLToPath(new URL("../../..", import.meta.url));
const eslintBinPath = fileURLToPath(new URL("../dist/bin/jongminchung-eslint.js", import.meta.url));
const toolBinPaths: Readonly<Record<string, string>> = {
  "jongminchung-eslint": eslintBinPath,
  "jongminchung-oxfmt": fileURLToPath(
    new URL("../dist/bin/jongminchung-oxfmt.js", import.meta.url),
  ),
  "jongminchung-oxlint": fileURLToPath(
    new URL("../dist/bin/jongminchung-oxlint.js", import.meta.url),
  ),
};

async function buildToolingPackage(): Promise<void> {
  await execFileAsync("bun", ["run", "--cwd", "packages/tooling", "build"], {
    cwd: rootDir,
    timeout: 30_000,
  });
}

async function runTool(args: readonly string[]) {
  await buildToolingPackage();
  const [binName, ...binArgs] = args;
  const binPath = binName === undefined ? undefined : toolBinPaths[binName];
  if (binPath === undefined) {
    throw new Error(`unknown tooling bin: ${binName ?? "<missing>"}`);
  }

  return await execFileAsync("node", [binPath, ...binArgs], {
    cwd: rootDir,
    timeout: 30_000,
  });
}

describe("shared repo tooling integration", () => {
  it("loads the shared ESLint package-boundary config through the root config", async () => {
    const { stdout } = await runTool([
      "jongminchung-eslint",
      "--print-config",
      "packages/ui/src/components/ui/button.tsx",
    ]);

    expect(stdout).toContain("@nx/enforce-module-boundaries");
    expect(stdout).toContain("pkg:ui");
  });

  it("loads package-boundary constraints from an external consumer config", async () => {
    const consumerRoot = await mkdtemp(join(rootDir, ".tmp-tooling-consumer-"));
    try {
      await mkdir(join(consumerRoot, "packages/app/src"), { recursive: true });
      await writeFile(join(consumerRoot, "packages/app/src/index.ts"), "export const app = 1;\n");
      await writeFile(
        join(consumerRoot, "eslint.config.mjs"),
        `
          import { createPackageBoundaryEslintConfig } from "@jongminchung/tooling/eslint";

          export default createPackageBoundaryEslintConfig({
            files: ["packages/**/*.ts"],
            depConstraints: [
              {
                sourceTag: "external:app",
                onlyDependOnLibsWithTags: ["external:app"],
              },
            ],
          });
        `,
      );

      await buildToolingPackage();
      const { stdout } = await execFileAsync(
        "node",
        [eslintBinPath, "--print-config", "packages/app/src/index.ts"],
        {
          cwd: consumerRoot,
          timeout: 30_000,
        },
      );

      expect(stdout).toContain("@nx/enforce-module-boundaries");
      expect(stdout).toContain("external:app");
    } finally {
      await rm(consumerRoot, { force: true, recursive: true });
    }
  });

  it("loads oxlint rules through the shared oxlint config", async () => {
    const { stdout } = await runTool(["jongminchung-oxlint", "--print-config"]);

    expect(stdout).toContain("typescript/no-floating-promises");
    expect(stdout).toContain("typescript/no-misused-promises");
  });

  it("loads oxfmt options through the shared oxfmt config module", async () => {
    const { stdout, stderr } = await runTool([
      "jongminchung-oxfmt",
      "--check",
      "packages/tooling/src/oxfmt/index.ts",
    ]);

    expect(`${stdout}\n${stderr}`).toContain("All matched files use the correct format");
  });
});
