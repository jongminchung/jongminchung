import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { appOwnedMaterialFileSet, upstreamMaterialNotice } from "./material-ownership.ts";

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const destinationRoot = resolve(appRoot, "components/materials/topics");
const sourceArgument = process.argv.find((argument) => argument.startsWith("--source="));

if (sourceArgument === undefined) {
  throw new Error("Usage: node scripts/import-kciter-materials.ts --source=/path/to/src/materials");
}

const sourceRoot = resolve(sourceArgument.slice("--source=".length));
const sourceRepositoryRoot = resolve(sourceRoot, "../..");

function toPosixPath(value: string): string {
  return value.split(sep).join("/");
}

async function listFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry): Promise<readonly string[]> => {
      const entryPath = resolve(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    }),
  );
  return nested.flat().sort();
}

function usesNativeCanvas(relativePath: string): boolean {
  return (
    relativePath.startsWith("building-nes-emulator/") ||
    relativePath === "the-expensive-main-thread/DynamicPriorityDemo.tsx" ||
    relativePath === "the-expensive-main-thread/SeamCarvingDemo.tsx"
  );
}

function prependImports(source: string, imports: readonly string[]): string {
  const directive = '"use client";\n\n';
  const body = source.startsWith(directive) ? source.slice(directive.length) : source;
  return `${upstreamMaterialNotice}\n${directive}${imports.join("\n")}\n${body}`;
}

function transformSource(source: string, relativePath: string): string {
  const extension = extname(relativePath);
  const isComponent = extension === ".tsx";
  const nativeCanvas = usesNativeCanvas(relativePath);
  const hadFrameScheduling = /\b(?:requestAnimationFrame|cancelAnimationFrame)\s*\(/u.test(source);
  const hadRandom = source.includes("Math.random(");
  const hadCanvas =
    !nativeCanvas &&
    (source.includes("<canvas") ||
      source.includes("HTMLCanvasElement") ||
      source.includes("CanvasRenderingContext2D") ||
      source.includes("CanvasGradient"));

  let transformed = source
    .replaceAll("requestAnimationFrame(", "scheduleMaterialFrame(")
    .replaceAll("cancelAnimationFrame(", "cancelMaterialFrame(")
    .replace(
      /`https:\/\/picsum\.photos\/seed\/emt-\$\{i\}\/\$\{FETCH\}\/\$\{FETCH\}`/gu,
      "'/materials/samples/main-thread.jpg'",
    )
    .replace(
      /`https:\/\/picsum\.photos\/\$\{IMG_W\}\/\$\{IMG_H\}`/gu,
      "'/materials/samples/main-thread.jpg'",
    );

  if (relativePath === "building-nes-emulator/wasmInit.ts") {
    transformed = transformed.replace(
      "import wasmUrl from './pkg/nes_core_bg.wasm?url';",
      "const wasmUrl = '/materials/building-nes-emulator/nes_core_bg.wasm';",
    );
  }
  if (relativePath === "the-expensive-main-thread/DynamicPriorityDemo.tsx") {
    transformed = transformed
      .replace(
        "color: mode === m ? '#1971c2' : '#868e96'",
        "color: mode === m ? '#1971c2' : '#495057'",
      )
      .replace("fontSize: 11, color: '#868e96'", "fontSize: 11, color: '#495057'")
      .replace(
        "background: running || loading ? '#ced4da' : '#228be6'",
        "background: running || loading ? '#ced4da' : '#1971c2'",
      );
  }

  if (hadRandom) {
    const id = toPosixPath(relativePath).replace(/\.(?:ts|tsx)$/u, "");
    transformed = transformed.replaceAll("Math.random()", `seededMaterialRandom("${id}")`);
  }

  if (hadCanvas) {
    transformed = transformed
      .replaceAll("<canvas", "<SvgCanvas")
      .replaceAll("</canvas>", "</SvgCanvas>")
      .replaceAll("HTMLCanvasElement", "SvgCanvasHandle")
      .replaceAll("CanvasRenderingContext2D", "SvgDrawingContext")
      .replaceAll("CanvasGradient", "SvgGradient");
  }

  transformed = transformed
    .replaceAll("lang?: Lang", "locale?: Lang")
    .replace(/\{\s*caption,\s*lang\s*=\s*(['"])ko\1\s*\}/gu, "{ caption, locale: lang = 'ko' }")
    .replace(/\{\s*lang\s*=\s*(['"])ko\1\s*\}/gu, "{ locale: lang = 'ko' }");

  if (relativePath === "how-to-design-animation/index.ts") {
    transformed += "\nexport { ProgressMappingDemo } from './ProgressMappingDemo';\n";
  }

  const imports: string[] = [];
  if (hadCanvas) {
    imports.push(
      'import { SvgCanvas, type SvgCanvasHandle, type SvgDrawingContext, type SvgGradient } from "@/components/materials/runtime/svg-canvas";',
    );
  }
  if (hadFrameScheduling) {
    imports.push(
      'import { cancelMaterialFrame, scheduleMaterialFrame } from "@/components/materials/runtime/scheduler";',
    );
  }
  if (hadRandom) {
    imports.push('import { seededMaterialRandom } from "@/components/materials/runtime/random";');
  }

  return isComponent
    ? prependImports(transformed, imports)
    : `${upstreamMaterialNotice}\n${imports.join("\n")}\n${transformed}`;
}

const files = await listFiles(sourceRoot);
for (const sourcePath of files) {
  const relativePath = toPosixPath(relative(sourceRoot, sourcePath));
  const destinationPath = resolve(destinationRoot, relativePath);
  await mkdir(resolve(destinationPath, ".."), { recursive: true });
  if (appOwnedMaterialFileSet.has(relativePath)) {
    const existingOverride = await readFile(destinationPath, "utf8").catch(() => null);
    if (existingOverride !== null) continue;
  }
  const extension = extname(sourcePath);
  if (extension !== ".ts" && extension !== ".tsx") {
    await copyFile(sourcePath, destinationPath);
    continue;
  }
  const source = await readFile(sourcePath, "utf8");
  await writeFile(destinationPath, transformSource(source, relativePath));
}

console.log(`Imported ${files.length} material source files from ${sourceRoot}.`);

const sampleRoot = resolve(appRoot, "public/materials/samples");
await mkdir(sampleRoot, { recursive: true });
await copyFile(
  resolve(sourceRepositoryRoot, "public/images/2023-07-17-railway-oriented-programming/trip.jpg"),
  resolve(sampleRoot, "main-thread.jpg"),
);

const nesAssetRoot = resolve(appRoot, "public/materials/building-nes-emulator");
await mkdir(nesAssetRoot, { recursive: true });
await copyFile(
  resolve(sourceRoot, "building-nes-emulator/pkg/nes_core_bg.wasm"),
  resolve(nesAssetRoot, "nes_core_bg.wasm"),
);
