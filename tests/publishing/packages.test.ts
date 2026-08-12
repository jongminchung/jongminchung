import { execFile } from "node:child_process";
import {
    mkdir,
    mkdtemp,
    readFile,
    readdir,
    rm,
    writeFile,
} from "node:fs/promises";
import { isAbsolute, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const rootDir = fileURLToPath(new URL("../..", import.meta.url));

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
    readonly packageDir: string;
    readonly tarballPath: string;
    readonly tempDir: string;
}

interface PublicModule {
    readonly importPath: string;
    readonly sourcePath: string;
    readonly specifier: string;
    readonly typesPath: string;
}

interface WildcardPattern {
    readonly prefix: string;
    readonly suffix: string;
}

function isUnknownRecord(
    value: unknown,
): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(
    value: unknown,
): value is Readonly<Record<string, string>> {
    return (
        isUnknownRecord(value) &&
        Object.values(value).every((item) => typeof item === "string")
    );
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
    if (!isUnknownRecord(value)) {
        throw new Error("expected packed package.json object");
    }

    return Object.freeze({
        dependencies: parsePackedStringRecord(
            value.dependencies,
            "dependencies",
        ),
        devDependencies: parsePackedStringRecord(
            value.devDependencies,
            "devDependencies",
        ),
        engines: parsePackedStringRecord(value.engines, "engines"),
        exports: value.exports,
        optionalDependencies: parsePackedStringRecord(
            value.optionalDependencies,
            "optionalDependencies",
        ),
        peerDependencies: parsePackedStringRecord(
            value.peerDependencies,
            "peerDependencies",
        ),
        type: typeof value.type === "string" ? value.type : undefined,
        version: typeof value.version === "string" ? value.version : undefined,
    });
}

function isPackResult(value: unknown): value is PackResult {
    return (
        isUnknownRecord(value) &&
        typeof value.filename === "string" &&
        Array.isArray(value.files) &&
        value.files.every(
            (file) => isUnknownRecord(file) && typeof file.path === "string",
        )
    );
}

function parsePackResult(stdout: string): PackResult {
    const trimmed = stdout.trim();
    const jsonStart = trimmed.startsWith("{") ? 0 : trimmed.indexOf("\n{");
    if (jsonStart === -1) {
        throw new Error("expected pnpm pack --json output");
    }

    const parsed: unknown = JSON.parse(
        trimmed.slice(jsonStart === 0 ? 0 : jsonStart + 1),
    );
    if (!isPackResult(parsed)) {
        throw new Error("expected pnpm pack --json result");
    }
    return parsed;
}

async function resolveTarballPath(
    tempDir: string,
    filename: string,
): Promise<string> {
    if (isAbsolute(filename)) return filename;

    const tarballs = (await readdir(tempDir)).filter((file) =>
        file.endsWith(".tgz"),
    );
    if (tarballs.length === 1 && tarballs[0] !== undefined) {
        return join(tempDir, tarballs[0]);
    }
    return join(tempDir, filename);
}

async function packWorkspace(workspace: string): Promise<PackedWorkspace> {
    const tempDir = await mkdtemp(join(rootDir, ".tmp-pnpm-pack-"));
    try {
        const { stdout } = await execFileAsync(
            "pnpm",
            [
                "--filter",
                workspace,
                "pack",
                "--json",
                "--pack-destination",
                tempDir,
            ],
            {
                cwd: rootDir,
                maxBuffer: 4 * 1024 * 1024,
                timeout: 60_000,
            },
        );
        const result = parsePackResult(stdout);
        const tarballPath = await resolveTarballPath(tempDir, result.filename);
        const consumerRoot = join(tempDir, "unpacked-consumer");
        const packageDir = join(
            consumerRoot,
            "node_modules",
            ...workspace.split("/"),
        );

        await mkdir(packageDir, { recursive: true });
        await execFileAsync(
            "tar",
            ["-xzf", tarballPath, "--strip-components", "1", "-C", packageDir],
            { cwd: rootDir, timeout: 30_000 },
        );
        const manifest: unknown = JSON.parse(
            await readFile(join(packageDir, "package.json"), "utf8"),
        );

        return {
            consumerRoot,
            files: result.files.map((file) => file.path),
            manifest: parsePackedManifest(manifest),
            packageDir,
            tarballPath,
            tempDir,
        };
    } catch (error) {
        await rm(tempDir, { force: true, recursive: true });
        throw error;
    }
}

function parseWildcard(pattern: string): WildcardPattern {
    const normalized = pattern.replace(/^\.\//u, "");
    const wildcard = normalized.indexOf("*");
    if (wildcard === -1 || normalized.indexOf("*", wildcard + 1) !== -1) {
        throw new Error(`expected one wildcard in ${pattern}`);
    }
    return {
        prefix: normalized.slice(0, wildcard),
        suffix: normalized.slice(wildcard + 1),
    };
}

function matchWildcard(
    path: string,
    pattern: WildcardPattern,
): string | undefined {
    if (!path.startsWith(pattern.prefix) || !path.endsWith(pattern.suffix)) {
        return undefined;
    }
    const value = path.slice(
        pattern.prefix.length,
        path.length - pattern.suffix.length,
    );
    return value.length > 0 && !value.includes("/") ? value : undefined;
}

function fillWildcard(pattern: string, value: string): string {
    return pattern.replace("*", value).replace(/^\.\//u, "");
}

async function enumeratePublicUiModules(
    manifest: PackedManifest,
): Promise<readonly PublicModule[]> {
    if (!isUnknownRecord(manifest.exports)) {
        throw new Error("expected @jongminchung/ui exports object");
    }

    const modules: PublicModule[] = [];
    for (const [subpath, targetValue] of Object.entries(manifest.exports)) {
        if (!/^\.\/(?:components|hooks|lib)\/\*$/u.test(subpath)) continue;
        if (!isUnknownRecord(targetValue)) {
            throw new Error(`expected conditional export for ${subpath}`);
        }
        const source = targetValue.source;
        const types = targetValue.types;
        const importTarget = targetValue.import;
        if (
            typeof source !== "string" ||
            typeof types !== "string" ||
            typeof importTarget !== "string"
        ) {
            throw new Error(
                `expected source, types, and import for ${subpath}`,
            );
        }

        const sourcePattern = parseWildcard(source);
        const sourceDirectory = posix.dirname(`${sourcePattern.prefix}_`);
        const files = await readdir(
            join(rootDir, "packages/ui", sourceDirectory),
        );
        for (const filename of files) {
            const sourcePath = posix.join(sourceDirectory, filename);
            const wildcardValue = matchWildcard(sourcePath, sourcePattern);
            if (wildcardValue === undefined) continue;
            modules.push({
                importPath: fillWildcard(importTarget, wildcardValue),
                sourcePath,
                specifier: `@jongminchung/ui/${fillWildcard(
                    subpath,
                    wildcardValue,
                ).replace(/^\.\//u, "")}`,
                typesPath: fillWildcard(types, wildcardValue),
            });
        }
    }

    return modules.toSorted((left, right) =>
        left.specifier.localeCompare(right.specifier),
    );
}

function expectPublicModuleFiles(
    packedFiles: readonly string[],
    modules: readonly PublicModule[],
): void {
    expect(modules.length).toBeGreaterThan(0);
    for (const module of modules) {
        expect(packedFiles, module.specifier).toEqual(
            expect.arrayContaining([
                module.sourcePath,
                module.importPath,
                module.typesPath,
            ]),
        );
    }

    const expectedOutputs = modules
        .flatMap((module) => [module.importPath, module.typesPath])
        .toSorted();
    const actualOutputs = packedFiles
        .filter((file) =>
            /^dist\/(?:components|hooks|lib)\/.+\.(?:d\.ts|js)$/u.test(file),
        )
        .toSorted();
    expect(actualOutputs).toEqual(expectedOutputs);
}

async function moduleKeysFromConsumer(
    consumerRoot: string,
    specifier: string,
): Promise<readonly string[]> {
    const script = `
      const loaded = await import(${JSON.stringify(specifier)});
      console.log(JSON.stringify(Object.keys(loaded).sort()));
    `;
    const { stdout } = await execFileAsync(
        "node",
        ["--input-type=module", "--eval", script],
        { cwd: consumerRoot, timeout: 30_000 },
    );
    const parsed: unknown = JSON.parse(stdout);
    if (
        !Array.isArray(parsed) ||
        !parsed.every((item) => typeof item === "string")
    ) {
        throw new Error(`expected ${specifier} to expose string export names`);
    }
    return parsed;
}

async function importAllModules(
    consumerRoot: string,
    specifiers: readonly string[],
): Promise<void> {
    const script = `
      const specifiers = ${JSON.stringify(specifiers)};
      for (const specifier of specifiers) await import(specifier);
    `;
    await execFileAsync("node", ["--input-type=module", "--eval", script], {
        cwd: consumerRoot,
        maxBuffer: 4 * 1024 * 1024,
        timeout: 60_000,
    });
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
    const { stdout } = await execFileAsync(
        "node",
        ["--input-type=module", "--eval", script],
        { cwd: consumerRoot, timeout: 30_000 },
    );
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
    const { stdout } = await execFileAsync(
        "node",
        ["--input-type=commonjs", "--eval", script],
        { cwd: consumerRoot, timeout: 30_000 },
    );
    return stdout.trim();
}

async function installUiConsumer(
    packed: PackedWorkspace,
    modules: readonly PublicModule[],
): Promise<string> {
    const consumerRoot = join(packed.tempDir, "installed-consumer");
    await mkdir(consumerRoot, { recursive: true });
    await writeFile(
        join(consumerRoot, "package.json"),
        `${JSON.stringify(
            {
                name: "packed-ui-consumer",
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
            timeout: 60_000,
        },
    );

    const moduleImports = modules
        .map(
            (module, index) =>
                `import * as PublicModule${index} from ${JSON.stringify(module.specifier)};\nvoid PublicModule${index};`,
        )
        .join("\n");
    await writeFile(
        join(consumerRoot, "index.tsx"),
        `${moduleImports}\nimport { Button } from "@jongminchung/ui/components/button";\nexport const button = <Button className="bg-primary data-open:block no-scrollbar">Consumer</Button>;\n`,
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

function collectPackedDependencyRanges(
    manifest: PackedManifest,
): readonly string[] {
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

describe("published package contracts", () => {
    it("packs tooling as an ESM-only package with explicit tool peers", async () => {
        const packed = await packWorkspace("@jongminchung/tooling");
        try {
            expect(packed.files).toEqual(
                expect.arrayContaining([
                    "dist/oxfmt/index.d.ts",
                    "dist/oxfmt/index.js",
                    "oxlint.json",
                ]),
            );
            expect(packed.files).not.toContain("dist/oxlint.json");
            expect(packed.manifest.engines).toEqual({ node: ">=24.0.0" });
            expect(packed.manifest.type).toBe("module");
            expect(packed.manifest.peerDependencies).toEqual({
                oxfmt: "^0.59.0",
                oxlint: "^1.74.0",
                "oxlint-tsgolint": "^0.25.0",
            });
            expect(JSON.stringify(packed.manifest.exports)).toContain(
                '"import"',
            );
            expect(JSON.stringify(packed.manifest.exports)).not.toContain(
                '"require"',
            );
            expectPackedProtocolsResolved(packed.manifest);
            expect(packed.files.some((file) => file.endsWith(".cjs"))).toBe(
                false,
            );

            expect(
                await moduleKeysFromConsumer(
                    packed.consumerRoot,
                    "@jongminchung/tooling/oxfmt",
                ),
            ).toEqual(["defineOxfmtConfig"]);
            expect(
                await commonJsErrorCodeFromConsumer(
                    packed.consumerRoot,
                    "@jongminchung/tooling/oxfmt",
                ),
            ).toBe("ERR_PACKAGE_PATH_NOT_EXPORTED");
            expect(
                await packageFileContentsFromConsumer(
                    packed.consumerRoot,
                    "@jongminchung/tooling/oxlint.json",
                ),
            ).toBe(
                await readFile(
                    join(rootDir, "packages/tooling/oxlint.json"),
                    "utf8",
                ),
            );
        } finally {
            await rm(packed.tempDir, { force: true, recursive: true });
        }
    }, 60_000);

    it("verifies every public UI module from source through an installed consumer", async () => {
        const packed = await packWorkspace("@jongminchung/ui");
        try {
            const modules = await enumeratePublicUiModules(packed.manifest);
            expectPublicModuleFiles(packed.files, modules);
            expect(packed.files).toEqual(
                expect.arrayContaining([
                    "LICENSE",
                    "README.md",
                    "src/styles/globals.css",
                    "src/styles/theme.css",
                    "src/styles/tokens.css",
                ]),
            );
            expect(
                packed.files.some((file) => /\.test\.tsx?$/u.test(file)),
            ).toBe(false);
            expect(packed.manifest.version).toBe("1.0.0");
            expect(packed.manifest.type).toBe("module");
            expect(packed.manifest.dependencies).not.toHaveProperty("react");
            expect(packed.manifest.dependencies).not.toHaveProperty(
                "react-dom",
            );
            expect(packed.manifest.peerDependencies).toMatchObject({
                react: "^19.2.0",
                "react-dom": "^19.2.0",
                tailwindcss: "^4.3.0",
            });
            expect(JSON.stringify(packed.manifest.exports)).toContain(
                '"source"',
            );
            expect(JSON.stringify(packed.manifest.exports)).toContain(
                '"types"',
            );
            expect(JSON.stringify(packed.manifest.exports)).toContain(
                '"import"',
            );
            expect(JSON.stringify(packed.manifest.exports)).not.toContain(
                '"require"',
            );
            expectPackedProtocolsResolved(packed.manifest);
            expect(packed.files.some((file) => file.endsWith(".cjs"))).toBe(
                false,
            );
            expect(
                await commonJsErrorCodeFromConsumer(
                    packed.consumerRoot,
                    "@jongminchung/ui/lib/utils",
                ),
            ).toBe("ERR_PACKAGE_PATH_NOT_EXPORTED");

            const installedConsumer = await installUiConsumer(packed, modules);
            await importAllModules(
                installedConsumer,
                modules.map((module) => module.specifier),
            );
            const { stdout: typecheckFiles } = await execFileAsync(
                "pnpm",
                ["exec", "tsc", "--project", "tsconfig.json", "--listFiles"],
                {
                    cwd: installedConsumer,
                    maxBuffer: 4 * 1024 * 1024,
                    timeout: 60_000,
                },
            );
            for (const module of modules) {
                expect(typecheckFiles, module.specifier).toContain(
                    join(
                        "node_modules",
                        "@jongminchung",
                        "ui",
                        module.typesPath,
                    ),
                );
            }

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
                      ) throw new Error("expected compiled UI token, variant, and utility classes");
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
                ).toBe(
                    await readFile(
                        join(
                            rootDir,
                            `packages/ui/src/styles/${stylesheet}.css`,
                        ),
                        "utf8",
                    ),
                );
            }
        } finally {
            await rm(packed.tempDir, { force: true, recursive: true });
        }
    }, 60_000);
});
