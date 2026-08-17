import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const topicsRoot = resolve(appRoot, "components/materials/topics");
const registryPath = resolve(appRoot, "generated/materials-registry.tsx");
const manifestPath = resolve(appRoot, "generated/materials-manifest.json");
const typesPath = resolve(appRoot, "generated/materials-types.ts");
const mode = process.argv.includes("--write") ? "write" : "check";

interface MaterialExport {
    readonly exportName: string;
    readonly fileName: string;
    readonly id: string;
    readonly minHeight: number;
    readonly moduleExport: string;
    readonly modulePath: string;
    readonly renderer: "svg-motion" | "dom-motion" | "canvas";
    readonly topic: string;
}

interface ExportedName {
    readonly exportName: string;
    readonly localName: string;
}

function toPosixPath(value: string): string {
    return value.split(sep).join("/");
}

async function exists(filePath: string): Promise<boolean> {
    try {
        return (await stat(filePath)).isFile();
    } catch {
        return false;
    }
}

async function resolveModuleFile(
    topicRoot: string,
    specifier: string,
): Promise<string> {
    const base = resolve(topicRoot, specifier);
    for (const extension of [".tsx", ".ts"]) {
        const candidate = `${base}${extension}`;
        if (await exists(candidate)) return candidate;
    }
    throw new Error(
        `Cannot resolve material module ${specifier} from ${topicRoot}.`,
    );
}

function parseSource(filePath: string, source: string): ts.SourceFile {
    return ts.createSourceFile(
        filePath,
        source,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
}

function hasExportModifier(node: ts.Node): boolean {
    return ts.canHaveModifiers(node)
        ? (ts
              .getModifiers(node)
              ?.some(
                  (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
              ) ?? false)
        : false;
}

function exportedValueNames(
    sourceFile: ts.SourceFile,
): readonly ExportedName[] {
    const names: ExportedName[] = [];
    for (const statement of sourceFile.statements) {
        if (!hasExportModifier(statement)) continue;
        if (
            (ts.isFunctionDeclaration(statement) ||
                ts.isClassDeclaration(statement)) &&
            statement.name !== undefined
        ) {
            names.push({
                exportName: statement.name.text,
                localName: statement.name.text,
            });
            continue;
        }
        if (ts.isVariableStatement(statement)) {
            for (const declaration of statement.declarationList.declarations) {
                if (!ts.isIdentifier(declaration.name)) continue;
                names.push({
                    exportName: declaration.name.text,
                    localName: declaration.name.text,
                });
            }
        }
    }
    return names;
}

function exportedNames(
    sourceFile: ts.SourceFile,
    declaration: ts.ExportDeclaration,
    moduleSourceFile: ts.SourceFile,
): readonly ExportedName[] {
    if (declaration.exportClause === undefined) {
        return exportedValueNames(moduleSourceFile);
    }
    if (!ts.isNamedExports(declaration.exportClause)) {
        throw new Error(
            `${sourceFile.fileName}: namespace material exports are unsupported.`,
        );
    }
    return declaration.exportClause.elements.map((element) => ({
        exportName: element.name.text,
        localName: element.propertyName?.text ?? element.name.text,
    }));
}

function rendererFor(
    topic: string,
    fileName: string,
    source: string,
): MaterialExport["renderer"] {
    if (
        topic === "the-expensive-main-thread" &&
        fileName === "DynamicPriorityDemo"
    ) {
        return "canvas";
    }
    if (source.includes("<svg")) return "svg-motion";
    return "dom-motion";
}

function minHeightFor(
    topic: string,
    renderer: MaterialExport["renderer"],
): number {
    if (topic === "building-llm") return 400;
    return renderer === "dom-motion" ? 240 : 320;
}

async function readTopicExports(
    topic: string,
): Promise<readonly MaterialExport[]> {
    const topicRoot = resolve(topicsRoot, topic);
    const indexPath = resolve(topicRoot, "index.ts");
    const indexSource = await readFile(indexPath, "utf8");
    const indexFile = parseSource(indexPath, indexSource);
    const exports: MaterialExport[] = [];

    for (const declaration of indexFile.statements) {
        if (
            !ts.isExportDeclaration(declaration) ||
            declaration.moduleSpecifier === undefined ||
            !ts.isStringLiteral(declaration.moduleSpecifier)
        ) {
            continue;
        }
        const specifier = declaration.moduleSpecifier.text;
        const filePath = await resolveModuleFile(topicRoot, specifier);
        const fileSource = await readFile(filePath, "utf8");
        const fileName = basename(filePath).replace(/\.tsx?$/u, "");
        const moduleFile = parseSource(filePath, fileSource);

        for (const item of exportedNames(indexFile, declaration, moduleFile)) {
            const renderer = rendererFor(topic, fileName, fileSource);
            exports.push({
                exportName: item.exportName,
                fileName,
                id: `${topic}/${item.exportName}`,
                minHeight: minHeightFor(topic, renderer),
                moduleExport: item.localName,
                modulePath: `../components/materials/topics/${topic}/${fileName}`,
                renderer,
                topic,
            });
        }
    }

    if (exports.length === 0) {
        throw new Error(
            `${toPosixPath(relative(appRoot, indexPath))} exports no demos.`,
        );
    }
    return exports;
}

async function listTopicDirectories(): Promise<readonly string[]> {
    const entries = await readdir(topicsRoot, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
}

async function listSourceFiles(directory: string): Promise<readonly string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map(async (entry): Promise<readonly string[]> => {
            const entryPath = resolve(directory, entry.name);
            return entry.isDirectory()
                ? listSourceFiles(entryPath)
                : [entryPath];
        }),
    );
    return nested
        .flat()
        .filter((filePath) => /\.tsx?$/u.test(filePath))
        .sort();
}

async function validateRenderingPolicy(): Promise<void> {
    const violations: string[] = [];
    for (const filePath of await listSourceFiles(topicsRoot)) {
        const relativePath = toPosixPath(relative(topicsRoot, filePath));
        const source = await readFile(filePath, "utf8");
        const hasCanvas =
            source.includes("<canvas") ||
            source.includes("CanvasRenderingContext2D") ||
            source.includes("HTMLCanvasElement") ||
            /createElement\(\s*['"]canvas['"]\s*\)/u.test(source);
        if (
            hasCanvas &&
            relativePath !== "the-expensive-main-thread/DynamicPriorityDemo.tsx"
        ) {
            violations.push(
                `${relativePath}: native Canvas is outside the allowlist`,
            );
        }
        if (
            /\b(?:requestAnimationFrame|cancelAnimationFrame)\s*\(/u.test(
                source,
            )
        ) {
            violations.push(
                `${relativePath}: direct animation frame scheduling is forbidden`,
            );
        }
        if (/@keyframes|\banimation(?:Name)?\s*:/u.test(source)) {
            violations.push(
                `${relativePath}: CSS keyframe animation must use Motion`,
            );
        }
        if (
            /https?:\/\/(?:picsum\.photos|images\.unsplash\.com)/u.test(source)
        ) {
            violations.push(
                `${relativePath}: runtime sample images must be local`,
            );
        }
    }
    if (violations.length > 0) throw new Error(violations.join("\n"));
}

function createRegistry(exports: readonly MaterialExport[]): string {
    const entries = exports
        .map(
            (entry) =>
                `  ${JSON.stringify(entry.id)}: {\n    id: ${JSON.stringify(entry.id)},\n    topic: ${JSON.stringify(entry.topic)},\n    name: ${JSON.stringify(entry.exportName)},\n    renderer: ${JSON.stringify(entry.renderer)},\n    minHeight: ${entry.minHeight},\n    component: dynamic<MaterialComponentProps>(\n      () => import(${JSON.stringify(entry.modulePath)}).then((module) => module.${entry.moduleExport}),\n      { ssr: false },\n    ),\n    preload: () => import(${JSON.stringify(entry.modulePath)}),\n  } satisfies MaterialManifestEntry,`,
        )
        .join("\n");
    return `/* This file is generated by scripts/build-materials.ts. */\n\nimport dynamic from "next/dynamic";\nimport type { MaterialComponentProps, MaterialId, MaterialManifestEntry } from "#components/materials/types";\n\nexport const materialRegistry: Readonly<Record<MaterialId, MaterialManifestEntry>> = {\n${entries}\n};\n\nexport const materialIds = Object.freeze(Object.keys(materialRegistry) as MaterialId[]);\n`;
}

function createManifest(exports: readonly MaterialExport[]): string {
    const manifest = exports.map(
        ({ exportName, fileName, id, minHeight, renderer, topic }) => ({
            id,
            topic,
            name: exportName,
            fileName,
            renderer,
            minHeight,
        }),
    );
    return `${JSON.stringify(manifest, null, 2)}\n`;
}

function createTypes(exports: readonly MaterialExport[]): string {
    const ids = exports
        .map((entry) => `    | ${JSON.stringify(entry.id)}`)
        .join("\n");
    const topics = [...new Set(exports.map((entry) => entry.topic))]
        .map((topic) => `    | ${JSON.stringify(topic)}`)
        .join("\n");
    return `/* This file is generated by scripts/build-materials.ts. */\n\nexport type MaterialId =\n${ids};\n\nexport type MaterialTopic =\n${topics};\n`;
}

async function readLocaleIds(locale: "ko" | "en"): Promise<readonly string[]> {
    const directory = resolve(appRoot, `content/tech/${locale}/deep-dive`);
    const files = (await readdir(directory))
        .filter((fileName) => fileName.endsWith(".mdx"))
        .sort();
    const ids: string[] = [];
    for (const fileName of files) {
        const source = await readFile(resolve(directory, fileName), "utf8");
        ids.push(
            ...[...source.matchAll(/<MaterialDemo\s+id="([^"]+)"\s*\/>/gu)].map(
                (match) => match[1] ?? "",
            ),
        );
    }
    return ids;
}

async function validateLocalizedReferences(
    exports: readonly MaterialExport[],
): Promise<void> {
    const expected = exports.map((entry) => entry.id).sort();
    for (const locale of ["ko", "en"] as const) {
        const ids = [...(await readLocaleIds(locale))].sort();
        const duplicates = ids.filter((id, index) => id === ids[index - 1]);
        if (duplicates.length > 0) {
            throw new Error(
                `${locale} material IDs must be unique: ${[...new Set(duplicates)].join(", ")}`,
            );
        }
        if (JSON.stringify(ids) !== JSON.stringify(expected)) {
            const actual = new Set(ids);
            const expectedSet = new Set(expected);
            const missing = expected.filter((id) => !actual.has(id));
            const unknown = ids.filter((id) => !expectedSet.has(id));
            throw new Error(
                `${locale} material references differ from the registry. Missing: ${missing.join(", ") || "none"}. Unknown: ${unknown.join(", ") || "none"}.`,
            );
        }
    }
}

async function checkOrWrite(filePath: string, contents: string): Promise<void> {
    const existing = await readFile(filePath, "utf8").catch(() => null);
    if (mode === "write") {
        if (existing !== contents) await writeFile(filePath, contents);
        return;
    }
    if (existing !== contents) {
        throw new Error(
            `${toPosixPath(relative(appRoot, filePath))} is stale. Run pnpm materials:build.`,
        );
    }
}

const topics = await listTopicDirectories();
const exports = (await Promise.all(topics.map(readTopicExports)))
    .flat()
    .sort((left, right) => left.id.localeCompare(right.id));
if (new Set(exports.map((entry) => entry.id)).size !== exports.length) {
    throw new Error("Material IDs must be unique.");
}

await validateRenderingPolicy();
await validateLocalizedReferences(exports);
await checkOrWrite(registryPath, createRegistry(exports));
await checkOrWrite(manifestPath, createManifest(exports));
await checkOrWrite(typesPath, createTypes(exports));
console.log(
    `Validated ${topics.length} material topics and ${exports.length} public demos.`,
);
