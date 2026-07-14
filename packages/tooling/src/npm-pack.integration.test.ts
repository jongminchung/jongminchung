import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const rootDir = fileURLToPath(new URL("../../..", import.meta.url));

interface PackedFile {
  readonly path: string;
}

interface PackResult {
  readonly filename: string;
  readonly files: readonly PackedFile[];
}

interface PackedWorkspace {
  readonly consumerRoot: string;
  readonly files: readonly string[];
  readonly tarballPath: string;
  readonly tempDir: string;
}

function isPackedFile(value: unknown): value is PackedFile {
  return (
    typeof value === "object" && value !== null && "path" in value && typeof value.path === "string"
  );
}

function isPackResult(value: unknown): value is PackResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "filename" in value &&
    typeof value.filename === "string" &&
    "files" in value &&
    Array.isArray(value.files) &&
    value.files.every(isPackedFile)
  );
}

function parsePackResult(stdout: string): PackResult {
  const trimmed = stdout.trim();
  const jsonStart = trimmed.startsWith("[") ? 0 : trimmed.lastIndexOf("\n[");
  if (jsonStart === -1) {
    throw new Error("expected npm pack --json output");
  }

  const parsed: unknown = JSON.parse(trimmed.slice(jsonStart === 0 ? 0 : jsonStart + 1));
  if (!Array.isArray(parsed) || !parsed.every(isPackResult)) {
    throw new Error("expected npm pack --json result");
  }

  const [result] = parsed;
  if (result === undefined) {
    throw new Error("expected npm pack result");
  }

  return result;
}

async function resolveTarballPath(tempDir: string, filename: string): Promise<string> {
  if (isAbsolute(filename)) return filename;

  const tarballFiles = (await readdir(tempDir)).filter((file) => file.endsWith(".tgz"));
  if (tarballFiles.length === 1 && tarballFiles[0] !== undefined) {
    return join(tempDir, tarballFiles[0]);
  }

  return join(tempDir, filename);
}

async function packWorkspace(workspace: string): Promise<PackedWorkspace> {
  const tempDir = await mkdtemp(join(rootDir, ".tmp-npm-pack-"));
  try {
    const { stdout } = await execFileAsync(
      "npm",
      ["pack", "--json", "--workspace", workspace, "--pack-destination", tempDir],
      {
        cwd: rootDir,
        maxBuffer: 4 * 1024 * 1024,
        timeout: 60_000,
      },
    );
    const result = parsePackResult(stdout);
    const tarballPath = await resolveTarballPath(tempDir, result.filename);
    const consumerRoot = join(tempDir, "consumer");
    const packageDir = join(consumerRoot, "node_modules", ...workspace.split("/"));

    await mkdir(packageDir, { recursive: true });
    await execFileAsync("tar", ["-xzf", tarballPath, "--strip-components", "1", "-C", packageDir], {
      cwd: rootDir,
      timeout: 30_000,
    });

    return {
      consumerRoot,
      files: result.files.map((file) => file.path),
      tarballPath,
      tempDir,
    };
  } catch (error) {
    await rm(tempDir, { force: true, recursive: true });
    throw error;
  }
}

async function importKeysFromConsumer(
  consumerRoot: string,
  specifier: string,
): Promise<readonly string[]> {
  const script = `
    const module = await import(${JSON.stringify(specifier)});
    console.log(JSON.stringify(Object.keys(module).sort()));
  `;
  const { stdout } = await execFileAsync("node", ["--input-type=module", "--eval", script], {
    cwd: consumerRoot,
    timeout: 30_000,
  });

  return JSON.parse(stdout) as readonly string[];
}

async function installToolingTarballInWorkspaceConsumer(packed: PackedWorkspace): Promise<string> {
  const consumerRoot = join(packed.tempDir, "tooling-npm-consumer");
  await mkdir(join(consumerRoot, "packages", "app", "src"), { recursive: true });
  await writeFile(
    join(consumerRoot, "package.json"),
    `${JSON.stringify({ private: true, type: "module", workspaces: ["packages/*"] }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    join(consumerRoot, "packages", "app", "package.json"),
    `${JSON.stringify(
      {
        name: "@consumer/app",
        exports: {
          ".": {
            source: "./src/index.ts",
            default: "./dist/index.js",
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    join(consumerRoot, "packages", "app", "src", "index.ts"),
    "export const app = 1;\n",
  );
  await execFileAsync(
    "npm",
    ["install", "--ignore-scripts", "--package-lock=false", packed.tarballPath],
    {
      cwd: consumerRoot,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 180_000,
    },
  );

  return consumerRoot;
}

describe("npm package tarball contracts", () => {
  it("packs @jongminchung/tooling with config modules and declarations", async () => {
    const packed = await packWorkspace("@jongminchung/tooling");
    try {
      expect(packed.files).toEqual(
        expect.arrayContaining([
          "LICENSE",
          "README.md",
          "dist/oxfmt/index.d.ts",
          "dist/oxfmt/index.js",
          "dist/oxlint/base.json",
          "dist/oxlint/index.d.ts",
          "dist/oxlint/index.js",
          "dist/package-map.d.ts",
          "dist/package-map.js",
          "package.json",
          "src/oxfmt/index.ts",
          "src/oxlint/base.json",
          "src/oxlint/index.ts",
          "src/package-map.ts",
        ]),
      );
      expect(packed.files.some((file) => file.startsWith("dist/bin/"))).toBe(false);
      expect(packed.files.some((file) => file.startsWith("dist/eslint/"))).toBe(false);
      expect(packed.files.some((file) => file.endsWith(".mjs"))).toBe(false);
      expect(packed.files.some((file) => file.endsWith(".test.ts"))).toBe(false);

      expect(
        await importKeysFromConsumer(packed.consumerRoot, "@jongminchung/tooling/oxfmt"),
      ).toEqual(expect.arrayContaining(["defaultOxfmtConfig", "defineOxfmtConfig"]));
      expect(
        await importKeysFromConsumer(packed.consumerRoot, "@jongminchung/tooling/oxlint"),
      ).toEqual(expect.arrayContaining(["defaultOxlintConfig", "defineOxlintConfig"]));
      expect(
        await importKeysFromConsumer(packed.consumerRoot, "@jongminchung/tooling/package-map"),
      ).toEqual(expect.arrayContaining(["createTsconfigAliasConfig"]));

      const consumerRoot = await installToolingTarballInWorkspaceConsumer(packed);
      expect(
        await importKeysFromConsumer(consumerRoot, "@jongminchung/tooling/package-map"),
      ).toEqual(expect.arrayContaining(["createTsconfigAliasConfig"]));
      const { stdout: aliasStdout } = await execFileAsync(
        "node",
        [
          "--input-type=module",
          "--eval",
          `
              const { createTsconfigAliasConfig } = await import("@jongminchung/tooling/package-map");
              console.log(JSON.stringify(createTsconfigAliasConfig().compilerOptions.paths));
            `,
        ],
        {
          cwd: consumerRoot,
          timeout: 30_000,
        },
      );
      expect(JSON.parse(aliasStdout)).toMatchObject({
        "@consumer/app": ["./packages/app/src/index.ts"],
      });
    } finally {
      await rm(packed.tempDir, { force: true, recursive: true });
    }
  }, 240_000);
});
