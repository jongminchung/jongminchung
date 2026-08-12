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
  readonly version?: string;
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
    version: typeof value.version === "string" ? value.version : undefined,
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

async function installPackedConsumer(packed: PackedWorkspace): Promise<string> {
  const consumerRoot = join(packed.tempDir, "installed-consumer");
  await mkdir(consumerRoot, { recursive: true });
  await writeFile(
    join(consumerRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "packed-package-consumer",
        private: true,
        type: "module",
        dependencies: {
          "@jongminchung/ui": `file:${packed.tarballPath}`,
          "@tailwindcss/postcss": "4.3.3",
          "@types/react": "19.2.18",
          "@types/react-dom": "19.2.4",
          postcss: "8.5.20",
          react: "19.2.8",
          "react-dom": "19.2.8",
          tailwindcss: "4.3.3",
          typescript: "6.0.3",
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await execFileAsync(
    "pnpm",
    [
      "install",
      "--prefer-offline",
      "--ignore-scripts",
      "--ignore-workspace",
      "--frozen-lockfile=false",
    ],
    {
      cwd: consumerRoot,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 120_000,
    },
  );
  await writeFile(
    join(consumerRoot, "index.tsx"),
    'import { Button } from "@jongminchung/ui/components/button";\n\nexport const button = <Button className="bg-primary data-open:block no-scrollbar">Consumer</Button>;\n',
    "utf8",
  );
  await writeFile(
    join(consumerRoot, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          jsx: "react-jsx",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          noEmit: true,
          strict: true,
        },
        files: ["index.tsx"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    join(consumerRoot, "input.css"),
    '@import "@jongminchung/ui/globals.css";\n@source "./index.tsx";\n',
    "utf8",
  );
  return consumerRoot;
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

describe("pnpm package tarball contracts", () => {
  it("packs @jongminchung/tooling with config modules and declarations", async () => {
    const packed = await packWorkspace("@jongminchung/tooling");
    try {
      expect(packed.files).toEqual(
        expect.arrayContaining(["dist/oxfmt/index.d.ts", "dist/oxfmt/index.js", "oxlint.json"]),
      );
      expect(packed.files).not.toContain("dist/oxlint.json");
      expect(packed.manifest.engines).toEqual({ node: ">=24.0.0" });
      expect(packed.manifest.type).toBe("module");
      expect(packed.manifest.peerDependencies).toEqual({ oxfmt: "^0.59.0" });
      expect(JSON.stringify(packed.manifest.exports)).toContain('"import"');
      expect(JSON.stringify(packed.manifest.exports)).not.toContain('"require"');
      expectPackedProtocolsResolved(packed.manifest);
      expect(packed.files.some((file) => file.endsWith(".cjs"))).toBe(false);

      expect(
        await moduleKeysFromConsumer(packed.consumerRoot, "@jongminchung/tooling/oxfmt"),
      ).toEqual(["defineOxfmtConfig"]);
      expect(
        await commonJsErrorCodeFromConsumer(packed.consumerRoot, "@jongminchung/tooling/oxfmt"),
      ).toBe("ERR_PACKAGE_PATH_NOT_EXPORTED");
      expect(
        await packageFileContentsFromConsumer(
          packed.consumerRoot,
          "@jongminchung/tooling/oxlint.json",
        ),
      ).toBe(await readFile(join(rootDir, "packages/tooling/oxlint.json"), "utf8"));
    } finally {
      await rm(packed.tempDir, { force: true, recursive: true });
    }
  }, 240_000);

  it("packs @jongminchung/ui with ESM components, declarations, and theme assets", async () => {
    const packed = await packWorkspace("@jongminchung/ui");
    try {
      expect(packed.files).toEqual(
        expect.arrayContaining([
          "LICENSE",
          "README.md",
          "dist/components/button.d.ts",
          "dist/components/button.js",
          "dist/lib/utils.d.ts",
          "dist/lib/utils.js",
          "src/components/button.tsx",
          "src/styles/globals.css",
          "src/styles/theme.css",
          "src/styles/tokens.css",
        ]),
      );
      expect(packed.files.some((file) => file.endsWith(".test.ts"))).toBe(false);
      expect(packed.files.some((file) => file.endsWith(".test.tsx"))).toBe(false);
      expect(packed.manifest.version).toBe("1.0.0");
      expect(packed.manifest.type).toBe("module");
      expect(packed.manifest.dependencies).not.toHaveProperty("react");
      expect(packed.manifest.dependencies).not.toHaveProperty("react-dom");
      expect(packed.manifest.peerDependencies).toMatchObject({
        react: "^19.2.0",
        "react-dom": "^19.2.0",
        tailwindcss: "^4.3.0",
      });
      expect(JSON.stringify(packed.manifest.exports)).toContain('"source"');
      expect(JSON.stringify(packed.manifest.exports)).toContain('"types"');
      expect(JSON.stringify(packed.manifest.exports)).toContain('"import"');
      expect(JSON.stringify(packed.manifest.exports)).not.toContain('"require"');
      expectPackedProtocolsResolved(packed.manifest);
      expect(packed.files.some((file) => file.endsWith(".cjs"))).toBe(false);

      for (const [sourceDirectory, sourceExtension, outputDirectory] of [
        ["src/components/", ".tsx", "dist/components/"],
        ["src/hooks/", ".ts", "dist/hooks/"],
        ["src/lib/", ".ts", "dist/lib/"],
      ] as const) {
        const sourceFiles = packed.files.filter(
          (file) => file.startsWith(sourceDirectory) && file.endsWith(sourceExtension),
        );
        expect(sourceFiles.length).toBeGreaterThan(0);
        for (const sourceFile of sourceFiles) {
          const outputBase = `${outputDirectory}${sourceFile.slice(sourceDirectory.length, -sourceExtension.length)}`;
          expect(packed.files).toContain(`${outputBase}.js`);
          expect(packed.files).toContain(`${outputBase}.d.ts`);
        }
      }

      expect(
        await commonJsErrorCodeFromConsumer(packed.consumerRoot, "@jongminchung/ui/lib/utils"),
      ).toBe("ERR_PACKAGE_PATH_NOT_EXPORTED");

      const installedConsumer = await installPackedConsumer(packed);
      expect(
        await moduleKeysFromConsumer(installedConsumer, "@jongminchung/ui/components/button"),
      ).toEqual(["Button", "buttonVariants"]);
      const { stdout: typecheckFiles } = await execFileAsync(
        "pnpm",
        ["exec", "tsc", "--project", "tsconfig.json", "--listFiles"],
        {
          cwd: installedConsumer,
          maxBuffer: 4 * 1024 * 1024,
          timeout: 60_000,
        },
      );
      expect(typecheckFiles).toContain(
        join("node_modules", "@jongminchung", "ui", "dist", "components", "button.d.ts"),
      );
      await execFileAsync(
        "node",
        [
          "--input-type=module",
          "--eval",
          `
            import { readFile } from "node:fs/promises";
            import { resolve } from "node:path";
            import tailwindcss from "@tailwindcss/postcss";
            import postcss from "postcss";

            const from = resolve("input.css");
            const result = await postcss([tailwindcss()]).process(await readFile(from, "utf8"), { from });
            if (
              !result.css.includes("background-color: var(--primary)") ||
              !result.css.includes(".bg-primary") ||
              !result.css.includes(".data-open\\\\:block") ||
              !result.css.includes(".no-scrollbar")
            ) {
              throw new Error("expected compiled UI token, variant, and utility classes");
            }
          `,
        ],
        {
          cwd: installedConsumer,
          maxBuffer: 4 * 1024 * 1024,
          timeout: 60_000,
        },
      );

      for (const stylesheet of ["globals", "theme", "tokens"] as const) {
        expect(
          await packageFileContentsFromConsumer(
            packed.consumerRoot,
            `@jongminchung/ui/${stylesheet}.css`,
          ),
        ).toBe(await readFile(join(rootDir, `packages/ui/src/styles/${stylesheet}.css`), "utf8"));
      }
    } finally {
      await rm(packed.tempDir, { force: true, recursive: true });
    }
  }, 240_000);
});
