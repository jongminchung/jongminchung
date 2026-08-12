import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const topicsRoot = resolve(appRoot, "components/materials/topics");
const registryPath = resolve(appRoot, "generated/materials-registry.tsx");
const manifestPath = resolve(appRoot, "generated/materials-manifest.json");
const mode = process.argv.includes("--write") ? "write" : "check";
const expectedTopicCount = 24;
const expectedDemoCount = 179;

interface MaterialExport {
    readonly exportName: string;
    readonly fileName: string;
    readonly id: string;
    readonly minHeight: number;
    readonly moduleExport: string;
    readonly modulePath: string;
    readonly renderer: "svg-motion" | "dom-motion" | "canvas" | "wasm";
    readonly topic: string;
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

function namedExports(source: string): readonly string[] {
    const names = new Set<string>();
    const declarationPattern =
        /export\s+(?:default\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gu;
    for (const match of source.matchAll(declarationPattern)) {
        if (match[1] !== undefined) names.add(match[1]);
    }
    return [...names];
}

function rendererFor(
    topic: string,
    fileName: string,
    source: string,
): MaterialExport["renderer"] {
    if (topic === "building-nes-emulator") return "wasm";
    if (
        topic === "the-expensive-main-thread" &&
        (fileName === "DynamicPriorityDemo" || fileName === "SeamCarvingDemo")
    ) {
        return "canvas";
    }
    if (source.includes("<SvgCanvas") || source.includes("<svg"))
        return "svg-motion";
    return "dom-motion";
}

function minHeightFor(
    topic: string,
    renderer: MaterialExport["renderer"],
): number {
    if (topic === "building-nes-emulator") return 520;
    if (topic === "building-llm" || topic === "it-is-the-boundary-stupid")
        return 400;
    if (renderer === "dom-motion") return 240;
    return 320;
}

async function readTopicExports(
    topic: string,
): Promise<readonly MaterialExport[]> {
    const topicRoot = resolve(topicsRoot, topic);
    const indexSource = await readFile(resolve(topicRoot, "index.ts"), "utf8");
    const exports: MaterialExport[] = [];
    const declarationPattern =
        /export\s+(\*|\{[^}]+\})\s+from\s+['"]([^'"]+)['"]/gu;

    for (const declaration of indexSource.matchAll(declarationPattern)) {
        const clause = declaration[1];
        const specifier = declaration[2];
        if (clause === undefined || specifier === undefined) continue;
        const filePath = await resolveModuleFile(topicRoot, specifier);
        const fileSource = await readFile(filePath, "utf8");
        const fileName = specifier.split("/").at(-1);
        if (fileName === undefined)
            throw new Error(`Invalid material specifier: ${specifier}`);

        const items =
            clause === "*"
                ? namedExports(fileSource).map((name) => ({
                      exportName: name,
                      localName: name,
                  }))
                : clause
                      .slice(1, -1)
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean)
                      .map((item) => {
                          const alias =
                              /^(default|[A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/u.exec(
                                  item,
                              );
                          return alias === null
                              ? { exportName: item, localName: item }
                              : {
                                    exportName: alias[2] ?? item,
                                    localName: alias[1] ?? item,
                                };
                      });

        for (const item of items) {
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

function isCanvasException(relativePath: string): boolean {
    return (
        relativePath.startsWith("building-nes-emulator/") ||
        relativePath === "the-expensive-main-thread/DynamicPriorityDemo.tsx" ||
        relativePath === "the-expensive-main-thread/SeamCarvingDemo.tsx"
    );
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
        if (hasCanvas && !isCanvasException(relativePath)) {
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
        .map((entry) => {
            return `  ${JSON.stringify(entry.id)}: {\n    id: ${JSON.stringify(entry.id)},\n    topic: ${JSON.stringify(entry.topic)},\n    name: ${JSON.stringify(entry.exportName)},\n    renderer: ${JSON.stringify(entry.renderer)},\n    minHeight: ${entry.minHeight},\n    component: dynamic<MaterialComponentProps>(\n      () => import(${JSON.stringify(entry.modulePath)}).then((module) => module.${entry.moduleExport}),\n      { ssr: false },\n    ),\n    preload: () => import(${JSON.stringify(entry.modulePath)}),\n  } satisfies MaterialManifestEntry,`;
        })
        .join("\n");
    return `/* This file is generated by scripts/build-materials.ts. */\n\nimport dynamic from "next/dynamic";\nimport type { MaterialComponentProps, MaterialId, MaterialManifestEntry } from "#components/materials/types";\n\nexport const materialRegistry: Readonly<Record<string, MaterialManifestEntry>> = {\n${entries}\n};\n\nexport const materialIds = Object.freeze(Object.keys(materialRegistry) as MaterialId[]);\n`;
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
if (topics.length !== expectedTopicCount) {
    throw new Error(
        `Expected ${expectedTopicCount} material topics, found ${topics.length}.`,
    );
}

const exports = (await Promise.all(topics.map(readTopicExports)))
    .flat()
    .sort((left, right) => left.id.localeCompare(right.id));
if (exports.length !== expectedDemoCount) {
    throw new Error(
        `Expected ${expectedDemoCount} public material demos, found ${exports.length}.`,
    );
}
if (new Set(exports.map((entry) => entry.id)).size !== exports.length) {
    throw new Error("Material IDs must be unique.");
}

await validateRenderingPolicy();
await checkOrWrite(registryPath, createRegistry(exports));
await checkOrWrite(manifestPath, createManifest(exports));
console.log(
    `Validated ${topics.length} material topics and ${exports.length} public demos.`,
);
