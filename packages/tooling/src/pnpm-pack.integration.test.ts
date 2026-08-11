import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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

interface PackedManifest {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly engines?: Readonly<Record<string, string>>;
  readonly exports?: unknown;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly type?: string;
}

interface PackedWorkspace {
  readonly consumerRoot: string;
  readonly files: readonly string[];
  readonly manifest: PackedManifest;
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
  const jsonStart = trimmed.startsWith("{") ? 0 : trimmed.indexOf("\n{");
  if (jsonStart === -1) {
    throw new Error("expected pnpm pack --json output");
  }

  const parsed: unknown = JSON.parse(trimmed.slice(jsonStart === 0 ? 0 : jsonStart + 1));
  if (!isPackResult(parsed)) throw new Error("expected pnpm pack --json result");

  return parsed;
}

function isStringRecord(value: unknown): value is Readonly<Record<string, string>> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

function isUnknownRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePackedStringRecord(
  value: unknown,
  field: keyof PackedManifest,
): Readonly<Record<string, string>> | undefined {
  if (value === undefined) return undefined;
  if (!isStringRecord(value)) {
    throw new Error(`expected packed ${field} to contain string values`);
  }
  return value;
}

function parsePackedManifest(value: unknown): PackedManifest {
  if (!isUnknownRecord(value)) throw new Error("expected packed package.json object");

  return Object.freeze({
    dependencies: parsePackedStringRecord(value.dependencies, "dependencies"),
    devDependencies: parsePackedStringRecord(value.devDependencies, "devDependencies"),
    engines: parsePackedStringRecord(value.engines, "engines"),
    exports: value.exports,
    optionalDependencies: parsePackedStringRecord(
      value.optionalDependencies,
      "optionalDependencies",
    ),
    peerDependencies: parsePackedStringRecord(value.peerDependencies, "peerDependencies"),
    type: typeof value.type === "string" ? value.type : undefined,
  });
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
  const tempDir = await mkdtemp(join(rootDir, ".tmp-pnpm-pack-"));
  try {
    const { stdout } = await execFileAsync(
      "pnpm",
      ["--filter", workspace, "pack", "--json", "--pack-destination", tempDir],
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
    const manifest: unknown = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));

    return {
      consumerRoot,
      files: result.files.map((file) => file.path),
      manifest: parsePackedManifest(manifest),
      tarballPath,
      tempDir,
    };
  } catch (error) {
    await rm(tempDir, { force: true, recursive: true });
    throw error;
  }
}

async function moduleKeysFromConsumer(
  consumerRoot: string,
  specifier: string,
): Promise<readonly string[]> {
  const script = `
    const loaded = await import(${JSON.stringify(specifier)});
    console.log(JSON.stringify(Object.keys(loaded).sort()));
  `;
  const { stdout } = await execFileAsync("node", ["--input-type=module", "--eval", script], {
    cwd: consumerRoot,
    timeout: 30_000,
  });

  const parsed: unknown = JSON.parse(stdout);
  if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === "string")) {
    throw new Error(`expected ${specifier} to expose string export names`);
  }
  return parsed;
}

async function packageFileContentsFromConsumer(
  consumerRoot: string,
  specifier: string,
): Promise<string> {
  const script = `
    const { readFile } = await import("node:fs/promises");
    const contents = await readFile(new URL(import.meta.resolve(${JSON.stringify(specifier)})), "utf8");
    console.log(JSON.stringify(contents));
  `;
  const { stdout } = await execFileAsync("node", ["--input-type=module", "--eval", script], {
    cwd: consumerRoot,
    timeout: 30_000,
  });

  const parsed: unknown = JSON.parse(stdout);
  if (typeof parsed !== "string") {
    throw new Error(`expected ${specifier} to resolve to a text file`);
  }
  return parsed;
}

async function commonJsErrorCodeFromConsumer(
  consumerRoot: string,
  specifier: string,
): Promise<string> {
  const script = `
    try {
      require(${JSON.stringify(specifier)});
      console.log("loaded");
    } catch (error) {
      console.log(error?.code ?? "unknown");
    }
  `;
  const { stdout } = await execFileAsync("node", ["--input-type=commonjs", "--eval", script], {
    cwd: consumerRoot,
    timeout: 30_000,
  });
  return stdout.trim();
}

function collectPackedDependencyRanges(manifest: PackedManifest): readonly string[] {
  return [
    ...Object.values(manifest.dependencies ?? {}),
    ...Object.values(manifest.devDependencies ?? {}),
    ...Object.values(manifest.optionalDependencies ?? {}),
    ...Object.values(manifest.peerDependencies ?? {}),
  ];
}

function expectPackedProtocolsResolved(manifest: PackedManifest): void {
  for (const range of collectPackedDependencyRanges(manifest)) {
    expect(range).not.toMatch(/^(?:catalog|workspace):/u);
  }
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

describe("pnpm package tarball contracts", () => {
  it("packs @jongminchung/remark-plantuml with ESM modules and declarations", async () => {
    const packed = await packWorkspace("@jongminchung/remark-plantuml");
    try {
      expect(packed.files).toEqual(
        expect.arrayContaining([
          "dist/astro.d.ts",
          "dist/astro.js",
          "dist/index.d.ts",
          "dist/index.js",
          "src/starlight.css",
          "src/styles.css",
        ]),
      );
      expect(packed.files).not.toContain("dist/starlight.css");
      expect(packed.files).not.toContain("dist/styles.css");
      expect(packed.manifest.engines).toEqual({ node: ">=24.0.0" });
      expect(packed.manifest.type).toBe("module");
      expect(JSON.stringify(packed.manifest.exports)).toContain('"import"');
      expect(JSON.stringify(packed.manifest.exports)).not.toContain('"require"');
      expectPackedProtocolsResolved(packed.manifest);
      expect(packed.files.some((file) => file.endsWith(".cjs"))).toBe(false);

      const rootExports = [
        "createPlantUmlSvgUrl",
        "encodePlantUmlSource",
        "publicPlantUmlSvgServerBaseUrl",
        "remarkPlantUml",
      ];
      const astroExports = ["createPlantUmlRemarkPlugin"];
      expect(
        await moduleKeysFromConsumer(packed.consumerRoot, "@jongminchung/remark-plantuml"),
      ).toEqual(rootExports);
      expect(
        await moduleKeysFromConsumer(packed.consumerRoot, "@jongminchung/remark-plantuml/astro"),
      ).toEqual(astroExports);
      expect(
        await commonJsErrorCodeFromConsumer(packed.consumerRoot, "@jongminchung/remark-plantuml"),
      ).toBe("ERR_PACKAGE_PATH_NOT_EXPORTED");
      expect(
        await packageFileContentsFromConsumer(
          packed.consumerRoot,
          "@jongminchung/remark-plantuml/styles.css",
        ),
      ).toBe(await readFile(join(rootDir, "packages/remark-plantuml/src/styles.css"), "utf8"));
      expect(
        await packageFileContentsFromConsumer(
          packed.consumerRoot,
          "@jongminchung/remark-plantuml/starlight.css",
        ),
      ).toBe(await readFile(join(rootDir, "packages/remark-plantuml/src/starlight.css"), "utf8"));
    } finally {
      await rm(packed.tempDir, { force: true, recursive: true });
    }
  }, 240_000);

  it("packs @jongminchung/tooling with config modules and declarations", async () => {
    const packed = await packWorkspace("@jongminchung/tooling");
    try {
      expect(packed.files).toEqual(
        expect.arrayContaining([
          "dist/oxfmt/index.d.ts",
          "dist/oxfmt/index.js",
          "dist/oxlint/index.d.ts",
          "dist/oxlint/index.js",
          "dist/package-map.d.ts",
          "dist/package-map.js",
          "src/oxlint/base.json",
        ]),
      );
      expect(packed.files).not.toContain("dist/oxlint/base.json");
      expect(packed.manifest.engines).toEqual({ node: ">=24.0.0" });
      expect(packed.manifest.type).toBe("module");
      expect(JSON.stringify(packed.manifest.exports)).toContain('"import"');
      expect(JSON.stringify(packed.manifest.exports)).not.toContain('"require"');
      expectPackedProtocolsResolved(packed.manifest);
      expect(packed.files.some((file) => file.endsWith(".cjs"))).toBe(false);

      for (const [specifier, expectedExports] of [
        ["@jongminchung/tooling/oxfmt", ["defaultOxfmtConfig", "defineOxfmtConfig"]],
        ["@jongminchung/tooling/oxlint", ["defaultOxlintConfig", "defineOxlintConfig"]],
        [
          "@jongminchung/tooling/package-map",
          [
            "createPackageExportAliases",
            "createTsconfigAliasConfig",
            "createTsconfigPaths",
            "createViteResolveAliases",
            "formatTsconfigAliasConfig",
            "loadWorkspacePackageMap",
            "writeTsconfigAliasConfig",
          ],
        ],
      ] as const) {
        expect(await moduleKeysFromConsumer(packed.consumerRoot, specifier)).toEqual(
          expectedExports,
        );
      }
      expect(
        await commonJsErrorCodeFromConsumer(packed.consumerRoot, "@jongminchung/tooling/oxlint"),
      ).toBe("ERR_PACKAGE_PATH_NOT_EXPORTED");
      expect(
        await packageFileContentsFromConsumer(
          packed.consumerRoot,
          "@jongminchung/tooling/oxlint.json",
        ),
      ).toBe(await readFile(join(rootDir, "packages/tooling/src/oxlint/base.json"), "utf8"));

      const consumerRoot = await installToolingTarballInWorkspaceConsumer(packed);
      expect(
        await moduleKeysFromConsumer(consumerRoot, "@jongminchung/tooling/package-map"),
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
