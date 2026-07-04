import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  createTsconfigAliasConfig,
  createViteResolveAliases,
} from "@jongminchung/tooling/package-map";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const rootDir = fileURLToPath(new URL("../../..", import.meta.url));

async function loadConfigAliases(
  configPath: string,
): Promise<Array<{ find: string; replacement: string }>> {
  const script = `
    const config = await import(${JSON.stringify(pathToFileURL(configPath).href)});
    const aliases = config.default?.resolve?.alias;
    if (!Array.isArray(aliases)) {
      throw new Error("expected config resolve.alias array");
    }
    console.log(JSON.stringify(aliases.map((entry) => ({
      find: String(entry.find),
      replacement: String(entry.replacement),
    }))));
  `;

  const { stdout } = await execFileAsync("bun", ["--eval", script], {
    cwd: rootDir,
    timeout: 30_000,
  });

  return JSON.parse(stdout) as Array<{ find: string; replacement: string }>;
}

function serializeAliases(alias: unknown): Array<{ find: string; replacement: string }> {
  if (!Array.isArray(alias)) {
    throw new Error("expected Vite alias array");
  }

  return alias.map((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("find" in entry) ||
      !("replacement" in entry)
    ) {
      throw new Error("expected Vite alias entry");
    }

    return {
      find: String(entry.find),
      replacement: String(entry.replacement),
    };
  });
}

describe("workspace package map integration", () => {
  it("keeps the generated tsconfig alias file in sync with package manifests", async () => {
    const generated = JSON.parse(
      await readFile(join(rootDir, "tsconfig.package-aliases.json"), "utf8"),
    );

    expect(generated).toEqual(createTsconfigAliasConfig({ rootDir }));
  });

  it("exposes generated aliases through the real TypeScript project config", async () => {
    const { stdout } = await execFileAsync("bunx", ["tsc", "--showConfig", "--project", "."], {
      cwd: rootDir,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 30_000,
    });

    const shownConfig = JSON.parse(stdout);
    expect(shownConfig.compilerOptions.paths).toEqual(
      createTsconfigAliasConfig({ rootDir }).compilerOptions.paths,
    );
  });

  it("uses the package-map aliases in Vitest config", async () => {
    const expectedAliases = serializeAliases(createViteResolveAliases({ rootDir }));

    expect(await loadConfigAliases(join(rootDir, "vitest.config.ts"))).toEqual(expectedAliases);
  });
});
