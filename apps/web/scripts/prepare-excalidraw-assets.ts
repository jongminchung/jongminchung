import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const targetRoot = resolve(appRoot, "public/excalidraw-assets");
const targetFontRoot = resolve(targetRoot, "fonts");
const sourceMarkerPath = resolve(targetRoot, ".source-marker");
const require = createRequire(import.meta.url);

async function directoryExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function readSourceMarker(): Promise<string | null> {
    try {
        return await readFile(sourceMarkerPath, "utf8");
    } catch {
        return null;
    }
}

/** `prepareExcalidrawAssets` 공개 기능을 제공함 */
export async function prepareExcalidrawAssets(): Promise<
    "prepared" | "current"
> {
    const packageEntry = require.resolve("@excalidraw/excalidraw");
    const fontRoot = resolve(dirname(packageEntry), "fonts");
    const sourceMarker = `${packageEntry}\n`;

    if (
        (await readSourceMarker()) === sourceMarker &&
        (await directoryExists(targetFontRoot))
    ) {
        return "current";
    }

    await rm(targetRoot, { force: true, recursive: true });
    await mkdir(targetRoot, { recursive: true });
    await cp(fontRoot, targetFontRoot, { force: true, recursive: true });
    await writeFile(sourceMarkerPath, sourceMarker, "utf8");
    return "prepared";
}

function isMainModule(): boolean {
    const entryPath = process.argv[1];
    return (
        entryPath !== undefined && resolve(entryPath) === import.meta.filename
    );
}

if (isMainModule()) {
    const result = await prepareExcalidrawAssets();
    process.stdout.write(
        result === "prepared"
            ? "Prepared Excalidraw font assets.\n"
            : "Excalidraw font assets are current.\n",
    );
}
