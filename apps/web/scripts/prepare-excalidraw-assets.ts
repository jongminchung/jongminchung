import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import { Window } from "happy-dom";
import { listStandaloneExcalidrawAssets } from "../lib/tech/excalidraw-files.ts";
import {
  excalidrawSceneId,
  parseExcalidrawSource,
  type ExcalidrawScene,
} from "../lib/tech/excalidraw-scene.ts";
import { findExcalidrawFences } from "./check-excalidraw.ts";
import { listFiles } from "./generation-utils.ts";

const appRoot = resolve(import.meta.dirname, "..");
const contentRoot = resolve(appRoot, "content");
const targetRoot = resolve(appRoot, "public/excalidraw-assets");
const diagramRoot = resolve(targetRoot, "diagrams");
const generatedRoot = resolve(appRoot, "generated");

interface ExcalidrawExporter {
  exportToSvg(
    options: Readonly<Record<string, unknown>>,
  ): Promise<SVGSVGElement>;
}

interface GeneratedScene {
  readonly id: string;
  readonly source: string;
  readonly sourceName: string;
}

function installDomShim(): void {
  const window = new Window();
  class FontFaceShim {
    constructor(..._args: readonly unknown[]) {}

    load(): Promise<this> {
      return Promise.resolve(this);
    }
  }
  window.HTMLCanvasElement.prototype.getContext = () =>
    ({ measureText: () => ({ width: 0 }) }) as never;
  Object.defineProperty(window.document, "fonts", {
    configurable: true,
    value: { add: () => undefined },
  });
  const globals = {
    DOMParser: window.DOMParser,
    Element: window.Element,
    FontFace: FontFaceShim,
    HTMLCanvasElement: window.HTMLCanvasElement,
    Image: window.Image,
    SVGElement: window.SVGElement,
    devicePixelRatio: 1,
    document: window.document,
    navigator: window.navigator,
    window,
  };
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value,
    });
  }
}

async function loadExporter(): Promise<ExcalidrawExporter> {
  installDomShim();
  const bundlePath = resolve(generatedRoot, "excalidraw-export.mjs");
  await mkdir(generatedRoot, { recursive: true });
  await build({
    bundle: true,
    entryPoints: ["@excalidraw/excalidraw"],
    format: "esm",
    loader: { ".json": "json" },
    outfile: bundlePath,
    platform: "node",
  });
  return (await import(
    `${bundlePath}?cache=${Date.now()}`
  )) as ExcalidrawExporter;
}

async function collectScenes(): Promise<readonly GeneratedScene[]> {
  const standalone = await listStandaloneExcalidrawAssets();
  const standaloneScenes = await Promise.all(
    standalone.map(async (asset) => ({
      source: await readFile(asset.filePath, "utf8"),
      sourceName: asset.filePath,
    })),
  );
  const mdxFiles = await listFiles(contentRoot, ".mdx");
  const inlineScenes = (
    await Promise.all(
      mdxFiles.map(async (path) => {
        const markdown = await readFile(path, "utf8");
        return findExcalidrawFences(markdown).map((fence) => ({
          source: fence.source,
          sourceName: `${path}#excalidraw-${fence.index + 1}`,
        }));
      }),
    )
  ).flat();
  const scenes = new Map<string, GeneratedScene>();
  for (const candidate of [...standaloneScenes, ...inlineScenes]) {
    parseExcalidrawSource(candidate.source, candidate.sourceName);
    const id = excalidrawSceneId(candidate.source);
    const existing = scenes.get(id);
    if (existing !== undefined && existing.source !== candidate.source)
      throw new Error(`Excalidraw scene hash collision: ${id}`);
    scenes.set(id, { ...candidate, id });
  }
  return [...scenes.values()];
}

async function writeScene(
  exporter: ExcalidrawExporter,
  scene: GeneratedScene,
  theme: "light" | "dark",
): Promise<void> {
  const parsed: ExcalidrawScene = parseExcalidrawSource(
    scene.source,
    scene.sourceName,
  );
  const svg = await exporter.exportToSvg({
    appState: {
      ...parsed.appState,
      exportBackground: true,
      exportWithDarkMode: theme === "dark",
      viewBackgroundColor: theme === "dark" ? "#1d1d1d" : "#ffffff",
    },
    elements: parsed.elements,
    exportPadding: 24,
    files: parsed.files,
    skipInliningFonts: true,
  });
  await writeFile(
    resolve(diagramRoot, `${scene.id}.${theme}.svg`),
    svg.outerHTML,
    "utf8",
  );
}

/** Excalidraw 원본과 MDX fence에서 정적 SVG를 생성함 */
export async function prepareExcalidrawAssets(): Promise<number> {
  const scenes = await collectScenes();
  const exporter = await loadExporter();
  await rm(targetRoot, { force: true, recursive: true });
  await mkdir(diagramRoot, { recursive: true });
  await Promise.all(
    scenes.flatMap((scene) => [
      writeScene(exporter, scene, "light"),
      writeScene(exporter, scene, "dark"),
    ]),
  );
  const manifest = scenes.map(({ id, sourceName }) => ({
    dark: `/excalidraw-assets/diagrams/${id}.dark.svg`,
    id,
    light: `/excalidraw-assets/diagrams/${id}.light.svg`,
    sourceName,
  }));
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(resolve(targetRoot, "manifest.json"), manifestJson, "utf8");
  await writeFile(
    resolve(generatedRoot, "excalidraw-manifest.json"),
    manifestJson,
    "utf8",
  );
  return scenes.length;
}

function isMainModule(): boolean {
  const entryPath = process.argv[1];
  return entryPath !== undefined && resolve(entryPath) === import.meta.filename;
}

if (isMainModule()) {
  const count = await prepareExcalidrawAssets();
  process.stdout.write(`Prepared ${count} Excalidraw SVG scenes.\n`);
}
